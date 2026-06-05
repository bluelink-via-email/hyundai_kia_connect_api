import { ApiImplType1, checkResponseForErrors } from "../ApiImplType1.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle } from "../../types/Vehicle.js";
import {
  BRAND_HYUNDAI,
  BRAND_KIA,
  BRANDS,
  DISTANCE_UNITS,
  ENGINE_TYPES,
  LOGIN_TOKEN_LIFETIME_HOURS,
  SEAT_STATUS,
  TEMPERATURE_UNITS,
} from "../../constants/index.js";
import { AuthenticationError } from "../../exceptions/index.js";
import { getChildValue, getHexTempIntoIndex, parseIsoDatetime } from "../../utils/index.js";

const USER_AGENT_OK_HTTP = "okhttp/3.12.0";

export class KiaUvoApiCN extends ApiImplType1 {
  temperature_range: number[];
  SPA_API_URL: string;
  SPA_API_URL_V2: string;
  USER_API_URL: string;
  BASE_URL: string;
  CCSP_SERVICE_ID: string;
  APP_ID: string;
  BASIC_AUTHORIZATION: string;
  CFB: Uint8Array = new Uint8Array(0);
  LANGUAGE: string = "en";
  PUSH_TYPE: string = "GCM";

  private CLIENT_ID: string;

  constructor(region: number, brand: number, language: string) {
    super();
    this.temperature_range = Array.from({ length: 32 }, (_, i) => (i + 28) * 0.5);

    if (BRANDS[brand] === BRAND_KIA) {
      this.BASE_URL = "prd.cn-ccapi.kia.com";
      this.CCSP_SERVICE_ID = "9d5df92a-06ae-435f-b459-8304f2efcc67";
      this.APP_ID = "eea8762c-adfc-4ee4-8d7a-6e2452ddf342";
      this.BASIC_AUTHORIZATION = "Basic OWQ1ZGY5MmEtMDZhZS00MzVmLWI0NTktODMwNGYyZWZjYzY3OnRzWGRrVWcwOEF2MlpaelhPZ1d6Snl4VVQ2eWVTbk5OUWtYWFBSZEtXRUFOd2wxcA==";
    } else {
      this.BASE_URL = "prd.cn-ccapi.hyundai.com";
      this.CCSP_SERVICE_ID = "72b3d019-5bc7-443d-a437-08f307cf06e2";
      this.APP_ID = "ed01581a-380f-48cd-83d4-ed1490c272d0";
      this.BASIC_AUTHORIZATION = "Basic NzJiM2QwMTktNWJjNy00NDNkLWE0MzctMDhmMzA3Y2YwNmUyOnNlY3JldA==";
    }

    this.USER_API_URL = `https://${this.BASE_URL}/api/v1/user/`;
    this.SPA_API_URL = `https://${this.BASE_URL}/api/v1/spa/`;
    this.SPA_API_URL_V2 = `https://${this.BASE_URL}/api/v2/spa/`;
    this.CLIENT_ID = this.CCSP_SERVICE_ID;
  }

  protected _getAuthenticatedHeaders(token: Token, ccs2Support: number | null = null): Record<string, string> {
    return {
      Authorization: token.access_token!,
      "ccsp-service-id": this.CCSP_SERVICE_ID,
      "ccsp-application-id": this.APP_ID,
      "ccsp-device-id": token.device_id!,
      Host: this.BASE_URL,
      Connection: "Keep-Alive",
      "Accept-Encoding": "gzip",
      "User-Agent": USER_AGENT_OK_HTTP,
    };
  }

  async login(username: string, password: string, pin?: string | null): Promise<Token> {
    const deviceId = await this._getDeviceIdCN();
    const cookies = await this._getCookies();
    let code: string | null = null;
    try {
      code = await this._getAuthCodeWithRedirect(username, password, cookies);
    } catch { /* falls through */ }
    if (!code) throw new AuthenticationError("Login failed");

    const [, accessToken, newCode] = await this._getAccessTokenCN(code);
    const [, refreshToken] = await this._getRefreshTokenCN(newCode);
    const valid_until = new Date(Date.now() + LOGIN_TOKEN_LIFETIME_HOURS * 3600 * 1000);

    return makeToken({
      username, password,
      access_token: accessToken,
      refresh_token: refreshToken,
      device_id: deviceId,
      valid_until,
      pin: pin ?? null,
    });
  }

  private async _getDeviceIdCN(): Promise<string> {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const registrationId = hex.slice(0, 64);
    const url = this.SPA_API_URL + "notifications/register";
    const payload = { pushRegId: registrationId, pushType: this.PUSH_TYPE, uuid: crypto.randomUUID() };
    const headers: Record<string, string> = {
      "ccsp-service-id": this.CCSP_SERVICE_ID,
      "ccsp-application-id": this.APP_ID,
      "Content-Type": "application/json;charset=UTF-8",
      Host: this.BASE_URL,
      "User-Agent": USER_AGENT_OK_HTTP,
    };
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    return (data["resMsg"] as Record<string, string>)["deviceId"];
  }

  private async _getCookies(): Promise<Record<string, string>> {
    const url = `${this.USER_API_URL}oauth2/authorize?response_type=code&state=test&client_id=${this.CLIENT_ID}&redirect_uri=${this.USER_API_URL}oauth2/redirect`;
    const resp = await fetch(url, { redirect: "follow" });
    const jar: Record<string, string> = {};
    const cooks = resp.headers.getSetCookie?.() ?? [];
    for (const c of cooks) {
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
      headers: { "Content-Type": "application/json", Cookie: cookieStr },
      body: JSON.stringify({ username, password }),
    });
    const location = resp.headers.get("location") ?? "";
    const code = new URL(location.startsWith("http") ? location : `https://x.com${location}`).searchParams.get("code");
    if (!code) throw new AuthenticationError("No auth code");
    return code;
  }

  private async _getAccessTokenCN(code: string): Promise<[string, string, string]> {
    const url = `${this.USER_API_URL}oauth2/token`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.BASIC_AUTHORIZATION,
        "Content-type": "application/x-www-form-urlencoded",
        Host: this.BASE_URL,
        "User-Agent": USER_AGENT_OK_HTTP,
      },
      body: `grant_type=authorization_code&redirect_uri=${encodeURIComponent(this.USER_API_URL + "oauth2/redirect")}&code=${code}`,
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    const tokenType = data["token_type"] as string;
    return [tokenType, `${tokenType} ${data["access_token"]}`, data["refresh_token"] as string];
  }

  private async _getRefreshTokenCN(refreshCode: string): Promise<[string, string]> {
    const url = `${this.USER_API_URL}oauth2/token`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.BASIC_AUTHORIZATION,
        "Content-type": "application/x-www-form-urlencoded",
        Host: this.BASE_URL,
        "User-Agent": USER_AGENT_OK_HTTP,
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
    const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    if (isCcs2) {
      const state = ((data["resMsg"] as Record<string, unknown>)["state"] as Record<string, unknown>)["Vehicle"] as Record<string, unknown>;
      this._updateVehiclePropertiesCcs2(vehicle, state);
    } else {
      this._updateVehiclePropertiesCN(vehicle, data);
    }
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/status";
    const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    this._updateVehiclePropertiesCN(vehicle, data);
  }

  private _updateVehiclePropertiesCN(vehicle: Vehicle, data: Record<string, unknown>): void {
    const msg = data["resMsg"] as Record<string, unknown> ?? {};
    vehicle.last_updated_at = parseIsoDatetime(getChildValue(msg, "time") as string) ?? new Date();
    vehicle.engine_is_running = getChildValue(msg, "engine") as boolean | null;
    vehicle.is_locked = getChildValue(msg, "doorLock") as boolean | null;
    vehicle.ev_battery_percentage = getChildValue(msg, "evStatus.batteryStatus") as number | null;
    vehicle.ev_battery_is_charging = getChildValue(msg, "evStatus.batteryCharge") as boolean | null;
    vehicle.ev_battery_is_plugged_in = getChildValue(msg, "evStatus.batteryPlugin") as boolean | null;
    vehicle.fuel_level = getChildValue(msg, "fuelLevel") as number | null;
    vehicle.data = data;
  }
}
