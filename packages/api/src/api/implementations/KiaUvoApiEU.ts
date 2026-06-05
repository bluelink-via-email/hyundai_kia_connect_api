import { ApiImplType1, checkResponseForErrors } from "../ApiImplType1.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle, DailyDrivingStats } from "../../types/Vehicle.js";
import {
  BRAND_GENESIS,
  BRAND_HYUNDAI,
  BRAND_KIA,
  BRANDS,
  DISTANCE_UNITS,
  ENGINE_TYPES,
  SEAT_STATUS,
  TEMPERATURE_UNITS,
} from "../../constants/index.js";
import { AuthenticationError, ConsentRequiredError } from "../../exceptions/index.js";
import {
  getChildValue,
  getHexTempIntoIndex,
  getIndexIntoHexTemp,
  getTimeFromString,
  parseIsoDatetime,
} from "../../utils/index.js";

const USER_AGENT_MOZILLA =
  "Mozilla/5.0 (Linux; Android 4.1.1; Galaxy Nexus Build/JRO03C) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.166 Mobile Safari/535.19";

const SUPPORTED_LANGUAGES = [
  "en","de","fr","it","es","sv","nl","no","cs","sk","hu","da","pl","fi","pt",
];

export class KiaUvoApiEU extends ApiImplType1 {
  temperature_range: number[];
  SPA_API_URL: string;
  SPA_API_URL_V2: string;
  USER_API_URL: string;
  BASE_URL: string;
  CCSP_SERVICE_ID: string;
  APP_ID: string;
  BASIC_AUTHORIZATION: string;
  CFB: Uint8Array;
  LANGUAGE: string;
  PUSH_TYPE: string;

  private BASE_DOMAIN: string;
  private PORT: number;
  private CCS_SERVICE_SECRET: string;
  private LOGIN_FORM_HOST: string;
  private CLIENT_ID: string;
  private brand: number;
  private _oauth_redirect_uri: string;

  constructor(region: number, brand: number, language: string) {
    super();
    this.brand = brand;
    this.temperature_range = Array.from({ length: 32 }, (_, i) => (i + 28) * 0.5);

    let lang = language.toLowerCase();
    if (lang.length > 2) lang = lang.slice(0, 2);
    if (!SUPPORTED_LANGUAGES.includes(lang)) lang = "en";
    this.LANGUAGE = lang;

    if (BRANDS[brand] === BRAND_KIA) {
      this.BASE_DOMAIN = "prd.eu-ccapi.kia.com";
      this.PORT = 8080;
      this.CCSP_SERVICE_ID = "fdc85c00-0a2f-4c64-bcb4-2cfb1500730a";
      this.CCS_SERVICE_SECRET = "secret";
      this.APP_ID = "a2b8469b-30a3-4361-8e13-6fceea8fbe74";
      this.CFB = this._b64decode("wLTVxwidmH8CfJYBWSnHD6E0huk0ozdiuygB4hLkM5XCgzAL1Dk5sE36d/bx5PFMbZs=");
      this.BASIC_AUTHORIZATION = "Basic ZmRjODVjMDAtMGEyZi00YzY0LWJjYjQtMmNmYjE1MDA3MzBhOnNlY3JldA==";
      this.LOGIN_FORM_HOST = "https://idpconnect-eu.kia.com";
      this.PUSH_TYPE = "APNS";
    } else if (BRANDS[brand] === BRAND_HYUNDAI) {
      this.BASE_DOMAIN = "prd.eu-ccapi.hyundai.com";
      this.PORT = 8080;
      this.CCSP_SERVICE_ID = "6d477c38-3ca4-4cf3-9557-2a1929a94654";
      this.CCS_SERVICE_SECRET = "KUy49XxPzLpLuoK0xhBC77W6VXhmtQR9iQhmIFjjoY4IpxsV";
      this.APP_ID = "014d2225-8495-4735-812d-2616334fd15d";
      this.CFB = this._b64decode("RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ=");
      this.BASIC_AUTHORIZATION = "Basic NmQ0NzdjMzgtM2NhNC00Y2YzLTk1NTctMmExOTI5YTk0NjU0OktVeTQ5WHhQekxwTHVvSzB4aEJDNzdXNlZYaG10UVI5aVFobUlGampvWTRJcHhzVg==";
      this.LOGIN_FORM_HOST = "https://idpconnect-eu.hyundai.com";
      this.PUSH_TYPE = "GCM";
    } else {
      // GENESIS
      this.BASE_DOMAIN = "prd-eu-ccapi.genesis.com";
      this.PORT = 443;
      this.CCSP_SERVICE_ID = "3020afa2-30ff-412a-aa51-d28fbe901e10";
      this.CCS_SERVICE_SECRET = "FKDdlef2ffdleFEweELFKERiLER2FED21sDdwdgQz6hFESE3";
      this.APP_ID = "f11f2b86-e0e7-4851-90df-5600b01d8b70";
      this.CFB = this._b64decode("RFtoRq/vDXJmRndoZaZQyYo3/qFLtVReW8P7utRPcc0ZxOzOELm9mexvviBk/qqIp4A=");
      this.BASIC_AUTHORIZATION = "Basic MzAyMGFmYTItMzBmZi00MTJhLWFhNTEtZDI4ZmJlOTAxZTEwOkZLRGRsZWYyZmZkbGVGRXdlRUxGS0VSaUxFUjJGRUQyMXNEZHdkZ1F6NmhGRVNFMw==";
      this.LOGIN_FORM_HOST = "https://idpconnect-eu.genesis.com";
      this.PUSH_TYPE = "GCM";
    }

    this.BASE_URL = `${this.BASE_DOMAIN}:${this.PORT}`;
    this.USER_API_URL = `https://${this.BASE_URL}/api/v1/user/`;
    this.SPA_API_URL = `https://${this.BASE_URL}/api/v1/spa/`;
    this.SPA_API_URL_V2 = `https://${this.BASE_URL}/api/v2/spa/`;
    this.CLIENT_ID = this.CCSP_SERVICE_ID;

    if (BRANDS[brand] === BRAND_KIA) {
      this._oauth_redirect_uri = this.USER_API_URL + "oauth2/redirect";
    } else if (BRANDS[brand] === BRAND_HYUNDAI) {
      this._oauth_redirect_uri = this.USER_API_URL + "oauth2/token";
    } else {
      this._oauth_redirect_uri = "https://accounts-eu.genesis.com/realms/eugenesisidm/ga-api/redirect2";
    }
  }

  private _b64decode(s: string): Uint8Array {
    const bin = atob(s);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  async login(username: string, password: string, pin?: string | null): Promise<Token> {
    const stamp = this._getStamp();
    const deviceId = await this._getDeviceId(stamp);

    const isRefreshToken = /^[A-Z0-9]{48}$/.test(password);

    let accessToken: string;
    let refreshToken: string;
    let expiresIn: number;

    if (isRefreshToken) {
      const [, at, , ei] = await this._getAccessToken(stamp, password);
      accessToken = at;
      refreshToken = password;
      expiresIn = ei;
    } else {
      [accessToken, refreshToken, expiresIn] = await this._loginWithPassword(username, password);
    }

    const valid_until = new Date(Date.now() + expiresIn * 1000);

    return makeToken({
      username,
      password,
      access_token: accessToken,
      refresh_token: refreshToken,
      device_id: deviceId,
      valid_until,
      pin: pin ?? null,
    });
  }

  private async _loginWithPassword(username: string, password: string): Promise<[string, string, number]> {
    const host = this.LOGIN_FORM_HOST;
    const clientId = this.CCSP_SERVICE_ID;
    const clientSecret = this.CCS_SERVICE_SECRET;
    const redirectUri = this._oauth_redirect_uri;
    const mobileUa = USER_AGENT_MOZILLA + "_CCS_APP_AOS";

    const authUrl =
      `${host}/auth/api/v2/user/oauth2/authorize` +
      `?response_type=code&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&lang=en&state=ccsp&country=de`;

    const cookieJar: Record<string, string> = {};

    const step1 = await fetch(authUrl, {
      redirect: "follow",
      headers: { "User-Agent": mobileUa },
    });
    const setCookies = step1.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const [kv] = c.split(";");
      const [k, v] = kv.split("=");
      if (k && v) cookieJar[k.trim()] = v.trim();
    }

    const certsResp = await fetch(`${host}/auth/api/v1/accounts/certs`, {
      headers: { "User-Agent": mobileUa, Cookie: this._cookieString(cookieJar) },
    });
    if (!certsResp.ok) {
      throw new AuthenticationError(`Failed to fetch RSA certs: HTTP ${certsResp.status}`);
    }
    const certsData = (await certsResp.json()) as Record<string, unknown>;
    const jwk = certsData["retValue"] as Record<string, string>;
    const kid = jwk["kid"] ?? "";

    const encryptedPw = await this._rsaEncryptPassword(password, jwk);

    const cookieStr = this._cookieString(cookieJar);
    const signinResp = await fetch(`${host}/auth/account/signin`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "User-Agent": mobileUa,
        Cookie: cookieStr,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        encryptedPassword: "true",
        password: encryptedPw,
        redirect_uri: redirectUri,
        scope: "",
        nonce: "",
        state: "ccsp",
        username,
        connector_session_key: "",
        kid,
        _csrf: "",
      }).toString(),
    });

    if (signinResp.status !== 302) {
      throw new AuthenticationError(`Signin failed: HTTP ${signinResp.status}. Check username and password.`);
    }

    const location = signinResp.headers.get("location") ?? "";
    const locationUrl = new URL(location.startsWith("http") ? location : `https://x.com${location}`);
    const code = locationUrl.searchParams.get("code");

    if (!code) {
      if (location.includes("error")) {
        const desc = locationUrl.searchParams.get("error_description") ?? "unknown";
        throw new AuthenticationError(`Authentication rejected: ${desc}`);
      }
      if (location.includes("/web/v1/user/authorization")) {
        throw new ConsentRequiredError(
          "Account consent required. Log in via browser once to accept terms."
        );
      }
      throw new AuthenticationError(`Unexpected redirect after signin: ${location.slice(0, 250)}`);
    }

    const tokenResp = await fetch(`${host}/auth/api/v2/user/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResp.ok) {
      throw new AuthenticationError(`Token exchange failed: HTTP ${tokenResp.status}`);
    }

    const tokens = (await tokenResp.json()) as Record<string, unknown>;
    const accessToken = `${tokens["token_type"]} ${tokens["access_token"]}`;
    const refreshToken = tokens["refresh_token"] as string;
    const expiresIn = parseInt(String(tokens["expires_in"] ?? "86400"), 10);

    return [accessToken, refreshToken, expiresIn];
  }

  private async _rsaEncryptPassword(password: string, jwk: Record<string, string>): Promise<string> {
    const nBytes = Uint8Array.from(atob(jwk["n"].replace(/-/g, "+").replace(/_/g, "/") + "=="), (c) => c.charCodeAt(0));
    const eBytes = Uint8Array.from(atob(jwk["e"].replace(/-/g, "+").replace(/_/g, "/") + "=="), (c) => c.charCodeAt(0));

    const pubKey = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "RSA",
        n: jwk["n"],
        e: jwk["e"],
        alg: "RSA-OAEP",
        ext: true,
      },
      { name: "RSA-OAEP", hash: "SHA-1" },
      false,
      ["encrypt"]
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      pubKey,
      new TextEncoder().encode(password)
    );
    return Array.from(new Uint8Array(encrypted))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private _cookieString(jar: Record<string, string>): string {
    return Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async refreshAccessToken(token: Token): Promise<Token> {
    if (token.refresh_token) {
      try {
        const stamp = this._getStamp();
        const [, accessToken, newRefreshToken, expiresIn] = await this._getAccessToken(stamp, token.refresh_token);
        const valid_until = new Date(Date.now() + expiresIn * 1000);
        return makeToken({
          username: token.username,
          password: token.password,
          access_token: accessToken,
          refresh_token: newRefreshToken || token.refresh_token,
          device_id: token.device_id,
          valid_until,
          pin: token.pin,
        });
      } catch {
        // fall back to full login
      }
    }
    return this.login(token.username, token.password, token.pin) as Promise<Token>;
  }

  private async _getAccessToken(stamp: string, authorizationCode: string): Promise<[string, string, string, number]> {
    if (BRANDS[this.brand] === BRAND_GENESIS) {
      const url = this.USER_API_URL + "oauth2/token";
      const headers: Record<string, string> = {
        Authorization: this.BASIC_AUTHORIZATION,
        Stamp: stamp,
        "Content-type": "application/x-www-form-urlencoded",
        Host: this.BASE_URL,
        "User-Agent": "okhttp/3.12.0",
      };
      const data = `grant_type=refresh_token&redirect_uri=https%3A%2F%2Fwww.getpostman.com%2Foauth2%2Fcallback&refresh_token=${authorizationCode}`;
      const resp = await fetch(url, { method: "POST", headers, body: data });
      const json = (await resp.json()) as Record<string, unknown>;
      checkResponseForErrors(json);
      const tokenType = json["token_type"] as string;
      return [tokenType, `${tokenType} ${json["access_token"]}`, authorizationCode, json["expires_in"] as number];
    }

    const url = this.LOGIN_FORM_HOST + "/auth/api/v2/user/oauth2/token";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: authorizationCode,
        client_id: this.CCSP_SERVICE_ID,
        client_secret: this.CCS_SERVICE_SECRET,
      }).toString(),
      redirect: "manual",
    });
    const json = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(json);
    const tokenType = json["token_type"] as string;
    const newRefresh = (json["refresh_token"] as string) ?? authorizationCode;
    return [tokenType, `${tokenType} ${json["access_token"]}`, newRefresh, json["expires_in"] as number];
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

    if (!isCcs2) {
      this._updateVehicleProperties(vehicle, (data["resMsg"] as Record<string, unknown>)["vehicleStatusInfo"] as Record<string, unknown>);
    } else {
      const state = ((data["resMsg"] as Record<string, unknown>)["state"] as Record<string, unknown>)["Vehicle"] as Record<string, unknown>;
      this._updateVehiclePropertiesCcs2(vehicle, state);
    }

    await this._setCachedLocationPark(token, vehicle);

    if (vehicle.engine_type === ENGINE_TYPES.EV || vehicle.engine_type === ENGINE_TYPES.PHEV) {
      try {
        const state = await this._getDrivingInfo(token, vehicle);
        if (state) this._updateVehicleDriveInfo(vehicle, state);
      } catch {
        // optional data
      }
    }
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const isCcs2 = (vehicle.ccu_ccs2_protocol_support ?? 0) !== 0;
    if (isCcs2) {
      await this._forceRefreshCcs2(token, vehicle);
    } else {
      const state = await this._getForcedVehicleState(token, vehicle);
      const loc = await this._getLocation(token, vehicle);
      if (loc) (state as Record<string, unknown>)["vehicleLocation"] = loc;
      this._updateVehicleProperties(vehicle, state);
    }

    if (vehicle.engine_type === ENGINE_TYPES.EV || vehicle.engine_type === ENGINE_TYPES.PHEV) {
      try {
        const state = await this._getDrivingInfo(token, vehicle);
        if (state) this._updateVehicleDriveInfo(vehicle, state);
      } catch {
        // optional
      }
    }
  }

  private async _forceRefreshCcs2(token: Token, vehicle: Vehicle): Promise<void> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/ccs2/carstatus/latest";
    const resp = await fetch(url, {
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    const state = ((data["resMsg"] as Record<string, unknown>)["state"] as Record<string, unknown>)["Vehicle"] as Record<string, unknown>;
    this._updateVehiclePropertiesCcs2(vehicle, state);
    await this._setCachedLocationPark(token, vehicle);
  }

  private async _setCachedLocationPark(token: Token, vehicle: Vehicle): Promise<void> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/location/park";
    try {
      const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
      const data = (await resp.json()) as Record<string, unknown>;
      checkResponseForErrors(data);
      const loc = data["resMsg"] as Record<string, unknown>;
      if (loc && getChildValue(loc, "coord.lat")) {
        vehicle.location_latitude = getChildValue(loc, "coord.lat") as number;
        vehicle.location_longitude = getChildValue(loc, "coord.lon") as number;
        vehicle.location_last_updated_at = parseIsoDatetime(getChildValue(loc, "time") as string);
      }
    } catch {
      // location not critical
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
      return ((data["resMsg"] as Record<string, unknown>)?.["gpsDetail"] as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }

  private async _getForcedVehicleState(token: Token, vehicle: Vehicle): Promise<Record<string, unknown>> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/status";
    const resp = await fetch(url, {
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    return { vehicleStatus: data["resMsg"] };
  }

  private _updateVehicleProperties(vehicle: Vehicle, state: Record<string, unknown>): void {
    const timeStr = getChildValue(state, "vehicleStatus.time") as string | null;
    vehicle.last_updated_at = timeStr ? parseIsoDatetime(timeStr) : new Date();

    const odoVal = getChildValue(state, "odometer.value");
    if (odoVal != null) {
      vehicle.odometer = parseFloat(odoVal as string);
      vehicle.odometer_unit = DISTANCE_UNITS[getChildValue(state, "odometer.unit") as number] ?? null;
    }

    vehicle.car_battery_percentage = getChildValue(state, "vehicleStatus.battery.batSoc") as number | null;
    vehicle.engine_is_running = getChildValue(state, "vehicleStatus.engine") as boolean | null;

    const airTempVal = getChildValue(state, "vehicleStatus.airTemp.value") as string | null;
    if (airTempVal) {
      const tempIdx = getHexTempIntoIndex(airTempVal);
      if (tempIdx != null) {
        vehicle.air_temperature = this.temperature_range[tempIdx] ?? null;
        vehicle.air_temperature_unit = TEMPERATURE_UNITS[getChildValue(state, "vehicleStatus.airTemp.unit") as number] ?? null;
      }
    }

    vehicle.defrost_is_on = getChildValue(state, "vehicleStatus.defrost") as boolean | null;
    const steerHeat = getChildValue(state, "vehicleStatus.steerWheelHeat") as number | null;
    if (steerHeat === 0 || steerHeat === 2) vehicle.steering_wheel_heater_is_on = false;
    else if (steerHeat === 1) vehicle.steering_wheel_heater_is_on = true;

    vehicle.back_window_heater_is_on = getChildValue(state, "vehicleStatus.sideBackWindowHeat") as boolean | null;
    vehicle.side_mirror_heater_is_on = getChildValue(state, "vehicleStatus.sideMirrorHeat") as boolean | null;
    vehicle.front_left_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.flSeatHeatState") as number] ?? null;
    vehicle.front_right_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.frSeatHeatState") as number] ?? null;
    vehicle.rear_left_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.rlSeatHeatState") as number] ?? null;
    vehicle.rear_right_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.rrSeatHeatState") as number] ?? null;

    vehicle.headlamp_status = getChildValue(state, "vehicleStatus.lampWireStatus.headLamp.headLampStatus") as string | null;
    vehicle.headlamp_left_low = getChildValue(state, "vehicleStatus.lampWireStatus.headLamp.leftLowLamp") as boolean | null;
    vehicle.headlamp_right_low = getChildValue(state, "vehicleStatus.lampWireStatus.headLamp.rightLowLamp") as boolean | null;
    vehicle.headlamp_left_high = getChildValue(state, "vehicleStatus.lampWireStatus.headLamp.leftHighLamp") as boolean | null;
    vehicle.headlamp_right_high = getChildValue(state, "vehicleStatus.lampWireStatus.headLamp.rightHighLamp") as boolean | null;
    vehicle.headlamp_left_bifunc = getChildValue(state, "vehicleStatus.lampWireStatus.headLamp.leftBifuncLamp") as boolean | null;
    vehicle.headlamp_right_bifunc = getChildValue(state, "vehicleStatus.lampWireStatus.headLamp.rightBifuncLamp") as boolean | null;
    vehicle.stop_lamp_left = getChildValue(state, "vehicleStatus.lampWireStatus.stopLamp.leftLamp") as boolean | null;
    vehicle.stop_lamp_right = getChildValue(state, "vehicleStatus.lampWireStatus.stopLamp.rightLamp") as boolean | null;
    vehicle.turn_signal_left_front = getChildValue(state, "vehicleStatus.lampWireStatus.turnSignalLamp.leftFrontLamp") as boolean | null;
    vehicle.turn_signal_right_front = getChildValue(state, "vehicleStatus.lampWireStatus.turnSignalLamp.rightFrontLamp") as boolean | null;
    vehicle.turn_signal_left_rear = getChildValue(state, "vehicleStatus.lampWireStatus.turnSignalLamp.leftRearLamp") as boolean | null;
    vehicle.turn_signal_right_rear = getChildValue(state, "vehicleStatus.lampWireStatus.turnSignalLamp.rightRearLamp") as boolean | null;

    vehicle.is_locked = getChildValue(state, "vehicleStatus.doorLock") as boolean | null;
    vehicle.front_left_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.frontLeft") as boolean | null;
    vehicle.front_right_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.frontRight") as boolean | null;
    vehicle.back_left_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.backLeft") as boolean | null;
    vehicle.back_right_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.backRight") as boolean | null;
    vehicle.hood_is_open = getChildValue(state, "vehicleStatus.hoodOpen") as boolean | null;
    vehicle.front_left_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.frontLeft") as boolean | null;
    vehicle.front_right_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.frontRight") as boolean | null;
    vehicle.back_left_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.backLeft") as boolean | null;
    vehicle.back_right_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.backRight") as boolean | null;

    vehicle.tire_pressure_rear_left_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureLampRL"));
    vehicle.tire_pressure_front_left_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureLampFL"));
    vehicle.tire_pressure_front_right_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureLampFR"));
    vehicle.tire_pressure_rear_right_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureLampRR"));
    vehicle.tire_pressure_all_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureLampAll"));
    vehicle.trunk_is_open = getChildValue(state, "vehicleStatus.trunkOpen") as boolean | null;

    vehicle.ev_battery_percentage = getChildValue(state, "vehicleStatus.evStatus.batteryStatus") as number | null;
    vehicle.ev_battery_is_charging = getChildValue(state, "vehicleStatus.evStatus.batteryCharge") as boolean | null;
    vehicle.ev_battery_is_plugged_in = getChildValue(state, "vehicleStatus.evStatus.batteryPlugin") as boolean | null;

    const portDoor = getChildValue(state, "vehicleStatus.evStatus.chargePortDoorOpenStatus") as number | null;
    if (portDoor === 1) vehicle.ev_charge_port_door_is_open = true;
    else if (portDoor === 2) vehicle.ev_charge_port_door_is_open = false;

    const chargePower = getChildValue(state, "vehicleStatus.evStatus.batteryPower.batteryStndChrgPower");
    if (chargePower != null) vehicle.ev_charging_power = chargePower as number;

    const totalRange = getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.totalAvailableRange.value");
    if (totalRange != null) {
      vehicle.total_driving_range = parseFloat(totalRange as string);
      vehicle.total_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.totalAvailableRange.unit") as number] ?? null;
    }

    const evRange = getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.evModeRange.value");
    if (evRange != null) {
      vehicle.ev_driving_range = parseFloat(evRange as string);
      vehicle.ev_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.evModeRange.unit") as number] ?? null;
    }

    vehicle.ev_estimated_current_charge_duration = getChildValue(state, "vehicleStatus.evStatus.remainTime2.atc.value") as number | null;
    vehicle.ev_estimated_fast_charge_duration = getChildValue(state, "vehicleStatus.evStatus.remainTime2.etc1.value") as number | null;
    vehicle.ev_estimated_portable_charge_duration = getChildValue(state, "vehicleStatus.evStatus.remainTime2.etc2.value") as number | null;
    vehicle.ev_estimated_station_charge_duration = getChildValue(state, "vehicleStatus.evStatus.remainTime2.etc3.value") as number | null;

    const targetSocList = getChildValue(state, "vehicleStatus.evStatus.reservChargeInfos.targetSOClist") as Array<Record<string, number>> | null;
    if (targetSocList) {
      try {
        const acSoc = targetSocList.filter((x) => x["plugType"] === 1).pop();
        const dcSoc = targetSocList.filter((x) => x["plugType"] === 0).pop();
        if (acSoc) vehicle.ev_charge_limits_ac = acSoc["targetSOClevel"];
        if (dcSoc) vehicle.ev_charge_limits_dc = dcSoc["targetSOClevel"];
      } catch { /* not an EV */ }
    }

    const gasModeRange = getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.gasModeRange.value");
    if (gasModeRange != null) {
      vehicle.fuel_driving_range = gasModeRange as number;
      vehicle.fuel_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.gasModeRange.unit") as number] ?? null;
    } else {
      const dte = getChildValue(state, "vehicleStatus.dte.value");
      if (dte != null) {
        vehicle.fuel_driving_range = dte as number;
        vehicle.fuel_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.dte.unit") as number] ?? null;
      }
    }

    vehicle.washer_fluid_warning_is_on = getChildValue(state, "vehicleStatus.washerFluidStatus") as boolean | null;
    vehicle.brake_fluid_warning_is_on = getChildValue(state, "vehicleStatus.breakOilStatus") as boolean | null;
    vehicle.fuel_level = getChildValue(state, "vehicleStatus.fuelLevel") as number | null;
    vehicle.fuel_level_is_low = getChildValue(state, "vehicleStatus.lowFuelLight") as boolean | null;
    vehicle.air_control_is_on = getChildValue(state, "vehicleStatus.airCtrlOn") as boolean | null;
    vehicle.smart_key_battery_warning_is_on = getChildValue(state, "vehicleStatus.smartKeyBatteryWarning") as boolean | null;

    const lat = getChildValue(state, "vehicleLocation.coord.lat");
    if (lat) {
      vehicle.location_latitude = lat as number;
      vehicle.location_longitude = getChildValue(state, "vehicleLocation.coord.lon") as number;
      vehicle.location_last_updated_at = parseIsoDatetime(getChildValue(state, "vehicleLocation.time") as string);
    }

    vehicle.data = state;
  }

  private _updateVehicleDriveInfo(vehicle: Vehicle, state: Record<string, unknown>): void {
    vehicle.total_power_consumed = getChildValue(state, "totalPwrCsp") as number | null;
    vehicle.total_power_regenerated = getChildValue(state, "regenPwr") as number | null;
    vehicle.power_consumption_30d = getChildValue(state, "consumption30d") as number | null;
    const dailyStats = getChildValue(state, "dailyStats") as DailyDrivingStats[] | null;
    if (dailyStats) {
      vehicle.daily_stats = dailyStats.sort(
        (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)
      );
    }
  }

  private async _getDrivingInfo(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/drvhistory";
    const headers = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);

    const [r1, r2] = await Promise.all([
      fetch(url, { method: "POST", headers, body: JSON.stringify({ periodTarget: 1 }) }),
      fetch(url, { method: "POST", headers, body: JSON.stringify({ periodTarget: 0 }) }),
    ]);
    const alltime = (await r1.json()) as Record<string, unknown>;
    const month30 = (await r2.json()) as Record<string, unknown>;
    checkResponseForErrors(alltime);
    checkResponseForErrors(month30);

    const allInfo = getChildValue(alltime, "resMsg.drivingInfo.0") as Record<string, unknown> | null;
    if (!allInfo) return null;

    const drivingInfo = { ...allInfo, dailyStats: [] as DailyDrivingStats[] };

    const detail30 = getChildValue(month30, "resMsg.drivingInfoDetail") as Array<Record<string, unknown>> | null;
    if (detail30) {
      drivingInfo.dailyStats = detail30.map((day) => ({
        date: new Date(
          (day["drivingDate"] as string).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
        ),
        total_consumed: getChildValue(day, "totalPwrCsp") as number | null,
        engine_consumption: getChildValue(day, "motorPwrCsp") as number | null,
        climate_consumption: getChildValue(day, "climatePwrCsp") as number | null,
        onboard_electronics_consumption: getChildValue(day, "eDPwrCsp") as number | null,
        battery_care_consumption: getChildValue(day, "batteryMgPwrCsp") as number | null,
        regenerated_energy: getChildValue(day, "regenPwr") as number | null,
        distance: getChildValue(day, "calculativeOdo") as number | null,
        distance_unit: vehicle.odometer_unit ?? "km",
      }));
    }

    const drivingInfo30 = getChildValue(month30, "resMsg.drivingInfo") as Array<Record<string, unknown>> | null;
    if (drivingInfo30) {
      for (const item of drivingInfo30) {
        if (item["drivingPeriod"] === 0) {
          const calculativeOdo = Object.entries(item).find(([k]) => k.toLowerCase() === "calculativeodo")?.[1] as number ?? 0;
          if (calculativeOdo > 0) {
            (drivingInfo as Record<string, unknown>)["consumption30d"] = Math.round((item["totalPwrCsp"] as number) / calculativeOdo);
            break;
          }
        }
      }
    }

    return drivingInfo as Record<string, unknown>;
  }
}
