import { ApiImplType1, checkResponseForErrors } from "../ApiImplType1.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle } from "../../types/Vehicle.js";
import {
  BRAND_HYUNDAI,
  BRAND_KIA,
  BRANDS,
  DISTANCE_UNITS,
  ENGINE_TYPES,
  SEAT_STATUS,
  TEMPERATURE_UNITS,
  REGION_AUSTRALIA,
  REGION_NZ,
  REGIONS,
} from "../../constants/index.js";
import { AuthenticationError } from "../../exceptions/index.js";
import { getChildValue, getHexTempIntoIndex, parseIsoDatetime } from "../../utils/index.js";

const USER_AGENT_MOZILLA =
  "Mozilla/5.0 (Linux; Android 4.1.1; Galaxy Nexus Build/JRO03C) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.166 Mobile Safari/535.19";

export class KiaUvoApiAU extends ApiImplType1 {
  temperature_range: number[];
  SPA_API_URL: string;
  SPA_API_URL_V2: string;
  USER_API_URL: string;
  BASE_URL: string;
  CCSP_SERVICE_ID: string;
  APP_ID: string;
  BASIC_AUTHORIZATION: string;
  CFB: Uint8Array;
  LANGUAGE: string = "en";
  PUSH_TYPE: string = "APNS";

  private CLIENT_ID: string;
  private brand: number;

  constructor(region: number, brand: number, language: string) {
    super();
    this.brand = brand;
    this.temperature_range = Array.from({ length: 20 }, (_, i) => (i + 34) * 0.5);

    if (BRANDS[brand] === BRAND_KIA && REGIONS[region] === REGION_AUSTRALIA) {
      this.BASE_URL = "au-apigw.ccs.kia.com.au:8082";
      this.CCSP_SERVICE_ID = "8acb778a-b918-4a8d-8624-73a0beb64289";
      this.APP_ID = "4ad4dcde-be23-48a8-bc1c-91b94f5c06f8";
      this.BASIC_AUTHORIZATION = "Basic OGFjYjc3OGEtYjkxOC00YThkLTg2MjQtNzNhMGJlYjY0Mjg5OjdTY01NbTZmRVlYZGlFUEN4YVBhUW1nZVlkbFVyZndvaDRBZlhHT3pZSVMyQ3U5VA==";
      this.CFB = this._b64(
        "SGGCDRvrzmRa2WTNFQPUaNfSFdtPklZ48xUuVckigYasxmeOQqVgCAC++YNrI1vVabI="
      );
    } else if (BRANDS[brand] === BRAND_HYUNDAI) {
      this.BASE_URL = "au-apigw.ccs.hyundai.com.au:8080";
      this.CCSP_SERVICE_ID = "855c72df-dfd7-4230-ab03-67cbf902bb1c";
      this.APP_ID = "f9ccfdac-a48d-4c57-bd32-9116963c24ed";
      this.BASIC_AUTHORIZATION = "Basic ODU1YzcyZGYtZGZkNy00MjMwLWFiMDMtNjdjYmY5MDJiYjFjOmU2ZmJ3SE0zMllOYmhRbDBwdmlhUHAzcmY0dDNTNms5MWVjZUEzTUpMZGJkVGhDTw==";
      this.CFB = this._b64(
        "nGDHng3k4Cg9gWV+C+A6Yk/ecDopUNTkGmDpr2qVKAQXx9bvY2/YLoHPfObliK32mZQ="
      );
    } else {
      // NZ
      this.BASE_URL = "au-apigw.ccs.kia.com.au:8082";
      this.CCSP_SERVICE_ID = "4ab606a7-cea4-48a0-a216-ed9c14a4a38c";
      this.APP_ID = "97745337-cac6-4a5b-afc3-e65ace81c994";
      this.BASIC_AUTHORIZATION = "Basic NGFiNjA2YTctY2VhNC00OGEwLWEyMTYtZWQ5YzE0YTRhMzhjOjBoYUZxWFRrS2t0Tktmemt4aFowYWt1MzFpNzRnMHlRRm01b2QybXo0TGRJNW1MWQ==";
      this.CFB = this._b64(
        "SGGCDRvrzmRa2WTNFQPUaC1OsnAhQgPgcQETEfbY8abEjR/ICXK0p+Rayw5tHCGyiUA="
      );
    }

    this.USER_API_URL = `https://${this.BASE_URL}/api/v1/user/`;
    this.SPA_API_URL = `https://${this.BASE_URL}/api/v1/spa/`;
    this.SPA_API_URL_V2 = `https://${this.BASE_URL}/api/v2/spa/`;
    this.CLIENT_ID = this.CCSP_SERVICE_ID;
  }

  private _b64(s: string): Uint8Array {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  }

  async login(username: string, password: string, pin?: string | null): Promise<Token> {
    const stamp = this._getStamp();
    const deviceId = await this._getDeviceId(stamp);
    const cookies = await this._getCookies();
    let code: string | null = null;
    try {
      code = await this._getAuthCodeWithRedirect(username, password, cookies);
    } catch { /* falls through */ }
    if (!code) throw new AuthenticationError("Login failed");

    const [, accessToken, newCode] = await this._getAccessToken(code, stamp);
    const [, refreshToken] = await this._getRefreshToken(newCode, stamp);
    const valid_until = new Date(Date.now() + 23 * 3600 * 1000);

    return makeToken({
      username, password,
      access_token: accessToken,
      refresh_token: refreshToken,
      device_id: deviceId,
      valid_until,
      pin: pin ?? null,
    });
  }

  private async _getCookies(): Promise<Record<string, string>> {
    const url = `${this.USER_API_URL}oauth2/authorize?response_type=code&state=test&client_id=${this.CLIENT_ID}&redirect_uri=${this.USER_API_URL}oauth2/redirect`;
    const resp = await fetch(url, { redirect: "follow" });
    const jar: Record<string, string> = {};
    const cookies = resp.headers.getSetCookie?.() ?? [];
    for (const c of cookies) {
      const [kv] = c.split(";");
      const idx = kv.indexOf("=");
      if (idx > 0) jar[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
    }
    return jar;
  }

  private async _getAuthCodeWithRedirect(username: string, password: string, cookies: Record<string, string>): Promise<string> {
    const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    const resp = await fetch(`${this.USER_API_URL}oauth2/authorize`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStr,
        "User-Agent": USER_AGENT_MOZILLA,
      },
      body: JSON.stringify({ username, password }),
    });
    const location = resp.headers.get("location") ?? "";
    const code = new URL(location.startsWith("http") ? location : `https://x.com${location}`).searchParams.get("code");
    if (!code) throw new AuthenticationError("No auth code in redirect");
    return code;
  }

  private async _getAccessToken(code: string, stamp: string): Promise<[string, string, string]> {
    const url = `${this.USER_API_URL}oauth2/token`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.BASIC_AUTHORIZATION,
        Stamp: stamp,
        "Content-type": "application/x-www-form-urlencoded",
        Host: this.BASE_URL,
        "User-Agent": "okhttp/3.12.0",
      },
      body: `grant_type=authorization_code&redirect_uri=${encodeURIComponent(this.USER_API_URL + "oauth2/redirect")}&code=${code}`,
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    const tokenType = data["token_type"] as string;
    return [tokenType, `${tokenType} ${data["access_token"]}`, data["refresh_token"] as string];
  }

  private async _getRefreshToken(refreshCode: string, stamp: string): Promise<[string, string]> {
    const url = `${this.USER_API_URL}oauth2/token`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.BASIC_AUTHORIZATION,
        Stamp: stamp,
        "Content-type": "application/x-www-form-urlencoded",
        Host: this.BASE_URL,
        "User-Agent": "okhttp/3.12.0",
      },
      body: `grant_type=refresh_token&redirect_uri=${encodeURIComponent(this.USER_API_URL + "oauth2/redirect")}&refresh_token=${refreshCode}`,
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    const tokenType = data["token_type"] as string;
    return [tokenType, `${tokenType} ${data["access_token"]}`];
  }

  async updateVehicleWithCachedState(token: Token, vehicle: Vehicle): Promise<void> {
    const isCcs2 = (vehicle.ccu_ccs2_protocol_support ?? 0) !== 0;
    let url = this.SPA_API_URL + "vehicles/" + vehicle.id;
    url += isCcs2 ? "/ccs2/carstatus/latest" : "/status/latest";

    const resp = await fetch(url, {
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);

    const loc = await this._getLocation(token, vehicle);

    if (isCcs2) {
      const state = ((data["resMsg"] as Record<string, unknown>)["state"] as Record<string, unknown>)["Vehicle"] as Record<string, unknown>;
      this._updateVehiclePropertiesCcs2(vehicle, state);
      if (loc && getChildValue(loc, "coord.lat")) {
        vehicle.location_latitude = getChildValue(loc, "coord.lat") as number;
        vehicle.location_longitude = getChildValue(loc, "coord.lon") as number;
        vehicle.location_last_updated_at = parseIsoDatetime(getChildValue(loc, "time") as string);
      }
    } else {
      const status = data["resMsg"] as Record<string, unknown>;
      this._updateVehiclePropertiesAU(vehicle, { status, vehicleLocation: loc });
    }

    if (vehicle.engine_type === ENGINE_TYPES.EV || vehicle.engine_type === ENGINE_TYPES.PHEV) {
      try {
        const drvState = await this._getDrivingInfoAU(token, vehicle);
        if (drvState) this._applyDrivingInfo(vehicle, drvState);
      } catch { /* optional */ }
    }
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const isCcs2 = (vehicle.ccu_ccs2_protocol_support ?? 0) !== 0;
    const loc = await this._getLocation(token, vehicle);
    if (isCcs2) {
      const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/ccs2/carstatus/latest";
      const resp = await fetch(url, {
        headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      checkResponseForErrors(data);
      const state = ((data["resMsg"] as Record<string, unknown>)["state"] as Record<string, unknown>)["Vehicle"] as Record<string, unknown>;
      this._updateVehiclePropertiesCcs2(vehicle, state);
    } else {
      const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/status";
      const resp = await fetch(url, {
        headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      checkResponseForErrors(data);
      this._updateVehiclePropertiesAU(vehicle, { status: data["resMsg"], vehicleLocation: loc });
    }
  }

  private async _getLocation(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/location";
    try {
      const resp = await fetch(url, {
        headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      checkResponseForErrors(data);
      return (data["resMsg"] as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }

  private _updateVehiclePropertiesAU(vehicle: Vehicle, state: Record<string, unknown>): void {
    const status = state["status"] as Record<string, unknown> ?? {};
    const loc = state["vehicleLocation"] as Record<string, unknown> | null;

    vehicle.last_updated_at = parseIsoDatetime(getChildValue(status, "time") as string) ?? new Date();
    vehicle.car_battery_percentage = getChildValue(status, "battery.batSoc") as number | null;
    vehicle.engine_is_running = getChildValue(status, "engine") as boolean | null;
    vehicle.is_locked = getChildValue(status, "doorLock") as boolean | null;
    vehicle.front_left_door_is_open = getChildValue(status, "doorOpen.frontLeft") as boolean | null;
    vehicle.front_right_door_is_open = getChildValue(status, "doorOpen.frontRight") as boolean | null;
    vehicle.back_left_door_is_open = getChildValue(status, "doorOpen.backLeft") as boolean | null;
    vehicle.back_right_door_is_open = getChildValue(status, "doorOpen.backRight") as boolean | null;
    vehicle.trunk_is_open = getChildValue(status, "trunkOpen") as boolean | null;
    vehicle.hood_is_open = getChildValue(status, "hoodOpen") as boolean | null;
    vehicle.ev_battery_percentage = getChildValue(status, "evStatus.batteryStatus") as number | null;
    vehicle.ev_battery_is_charging = getChildValue(status, "evStatus.batteryCharge") as boolean | null;
    vehicle.ev_battery_is_plugged_in = getChildValue(status, "evStatus.batteryPlugin") as boolean | null;
    vehicle.fuel_level = getChildValue(status, "fuelLevel") as number | null;
    vehicle.fuel_level_is_low = getChildValue(status, "lowFuelLight") as boolean | null;

    if (loc && getChildValue(loc, "coord.lat")) {
      vehicle.location_latitude = getChildValue(loc, "coord.lat") as number;
      vehicle.location_longitude = getChildValue(loc, "coord.lon") as number;
      vehicle.location_last_updated_at = parseIsoDatetime(getChildValue(loc, "time") as string);
    }
    vehicle.data = state;
  }

  private async _getDrivingInfoAU(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/drvhistory";
    const headers = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ periodTarget: 1 }) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    const info = getChildValue(data, "resMsg.drivingInfo.0") as Record<string, unknown> | null;
    return info;
  }

  private _applyDrivingInfo(vehicle: Vehicle, state: Record<string, unknown>): void {
    vehicle.total_power_consumed = getChildValue(state, "totalPwrCsp") as number | null;
    vehicle.total_power_regenerated = getChildValue(state, "regenPwr") as number | null;
  }
}
