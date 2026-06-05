import { ApiImplType1, checkResponseForErrors } from "../ApiImplType1.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle } from "../../types/Vehicle.js";
import { BRAND_HYUNDAI, BRAND_KIA, BRANDS, ENGINE_TYPES } from "../../constants/index.js";
import { AuthenticationError } from "../../exceptions/index.js";
import { getChildValue, parseIsoDatetime } from "../../utils/index.js";

export class KiaUvoApiIN extends ApiImplType1 {
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
  PUSH_TYPE: string = "GCM";

  private CLIENT_ID: string;

  constructor(brand: number) {
    super();
    this.temperature_range = Array.from({ length: 32 }, (_, i) => (i + 28) * 0.5);

    if (BRANDS[brand] === BRAND_HYUNDAI) {
      const BASE_DOMAIN = "prd.in-ccapi.hyundai.connected-car.io";
      const PORT = 8080;
      this.BASE_URL = `${BASE_DOMAIN}:${PORT}`;
      this.CCSP_SERVICE_ID = "e5b3f6d0-7f83-43c9-aff3-a254db7af368";
      this.APP_ID = "5a27df80-4ca1-4154-8c09-6f4029d91cf7";
      this.CFB = this._b64("RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ=");
      this.BASIC_AUTHORIZATION = "Basic ZTViM2Y2ZDAtN2Y4My00M2M5LWFmZjMtYTI1NGRiN2FmMzY4OjVKRk9DcjZDMjRPZk96bERxWnA3RXdxcmtMMFd3MDRVYXhjRGlFNlVkM3FJNVNFNA==";
      this.PUSH_TYPE = "GCM";
    } else {
      const BASE_DOMAIN = "prd.in-ccapi.kia.connected-car.io";
      const PORT = 8080;
      this.BASE_URL = `${BASE_DOMAIN}:${PORT}`;
      this.CCSP_SERVICE_ID = "d0fe4855-7527-4be0-ab6e-a481216c705d";
      this.APP_ID = "00000000-69cd-4660-b75d-277ae15379dd";
      this.CFB = this._b64("pdfn/jCrrEcxH6Jnak/1O/DaD+HjVh0P6z/BHWNoUKQtT0aLcYwer8BxQOoiHXSyMtBV");
      this.BASIC_AUTHORIZATION = "Basic ZDBmZTQ4NTUtNzUyNy00YmUwLWFiNmUtYTQ4MTIxNmM3MDVkOlNIb1R0WHB5ZmJZbVAzWGpOQTZCcnRsRGdseXBQV2o5MjBQdEtCSlBmbGVIRVlwVQ==";
      this.PUSH_TYPE = "APNS";
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

    const [, accessToken, newCode] = await this._getAccessTokenIN(stamp, code);
    const [, refreshToken] = await this._getRefreshTokenIN(stamp, newCode);
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
    const cooks = resp.headers.getSetCookie?.() ?? [];
    for (const c of cooks) {
      const idx = c.indexOf("=");
      const semiIdx = c.indexOf(";");
      if (idx > 0) jar[c.slice(0, idx).trim()] = c.slice(idx + 1, semiIdx > 0 ? semiIdx : undefined).trim();
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

  private async _getAccessTokenIN(stamp: string, code: string): Promise<[string, string, string]> {
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

  private async _getRefreshTokenIN(stamp: string, refreshCode: string): Promise<[string, string]> {
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
    const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    if (isCcs2) {
      const state = ((data["resMsg"] as Record<string, unknown>)["state"] as Record<string, unknown>)["Vehicle"] as Record<string, unknown>;
      this._updateVehiclePropertiesCcs2(vehicle, state);
    } else {
      const status = (data["resMsg"] as Record<string, unknown>) ?? {};
      vehicle.last_updated_at = parseIsoDatetime(getChildValue(status, "time") as string) ?? new Date();
      vehicle.engine_is_running = getChildValue(status, "engine") as boolean | null;
      vehicle.is_locked = getChildValue(status, "doorLock") as boolean | null;
      vehicle.ev_battery_percentage = getChildValue(status, "evStatus.batteryStatus") as number | null;
      vehicle.fuel_level = getChildValue(status, "fuelLevel") as number | null;
      vehicle.data = data;
    }
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/status";
    const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    const status = (data["resMsg"] as Record<string, unknown>) ?? {};
    vehicle.last_updated_at = parseIsoDatetime(getChildValue(status, "time") as string) ?? new Date();
    vehicle.engine_is_running = getChildValue(status, "engine") as boolean | null;
    vehicle.data = data;
  }
}
