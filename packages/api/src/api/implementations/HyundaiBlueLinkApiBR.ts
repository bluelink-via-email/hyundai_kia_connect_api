import { ApiImpl } from "../ApiImpl.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle, DayTripCounts, DayTripInfo, MonthTripInfo, TripInfo } from "../../types/Vehicle.js";
import { ClimateRequestOptions, WindowRequestOptions } from "../../types/requests.js";
import { BRAND_HYUNDAI, BRANDS, DISTANCE_UNITS, ENGINE_TYPES, ORDER_STATUS, SEAT_STATUS, VEHICLE_LOCK_ACTION, WINDOW_STATE } from "../../constants/index.js";
import { APIError } from "../../exceptions/index.js";
import { getChildValue, getFloat, getIndexIntoHexTemp, parseDateBr, parseIsoDatetime } from "../../utils/index.js";

export class HyundaiBlueLinkApiBR extends ApiImpl {
  temperature_range: number[] = Array.from({ length: 20 }, (_, i) => i + 62);

  private BASE_URL = "br-ccapi.hyundai.com.br";
  private API_URL: string;
  private API_URL_V2: string;
  private CCSP_DEVICE_ID = "c6e5815b-3057-4e5e-95d5-e3d5d1d2093e";
  private CCSP_SERVICE_ID = "03f7df9b-7626-4853-b7bd-ad1e8d722bd5";
  private CCSP_APP_ID = "513a491a-0d7c-4d6a-ac03-a2df127d73b0";
  private BASIC_AUTH = "Basic MDNmN2RmOWItNzYyNi00ODUzLWI3YmQtYWQxZThkNzIyYmQ1OnyRejJiYzZDbjhPb3ZWT1I3UkRXd3hUcVZ3V0czeUtCWUZEZzBIc09Yc3l4eVBsSA==";
  private API_HEADERS: Record<string, string>;

  private controlToken: string | null = null;
  private controlTokenExpiresAt: Date | null = null;

  constructor(region: number, brand: number, language = "pt-BR") {
    super();
    if (BRANDS[brand] !== BRAND_HYUNDAI) {
      throw new APIError(`Only Hyundai is supported for Brazil region.`);
    }
    this.API_URL = `https://${this.BASE_URL}/api/v1/`;
    this.API_URL_V2 = `https://${this.BASE_URL}/api/v2/`;
    this.API_HEADERS = {
      "Content-Type": "application/json; charset=UTF-8",
      "Accept": "application/json, text/plain, */*",
      "Accept-Encoding": "br;q=1.0, gzip;q=0.9, deflate;q=0.8",
      "Accept-Language": "pt-BR;q=1.0, en-US;q=0.9",
      "User-Agent": "BR_BlueLink/1.0.14 (com.hyundai.bluelink.br; build:10132; iOS 18.4.0) Alamofire/5.9.1",
      "Host": this.BASE_URL,
      "offset": "-3",
      "ccuCCS2ProtocolSupport": "0",
    };
  }

  private _getAuthenticatedHeaders(token: Token): Record<string, string> {
    return {
      ...this.API_HEADERS,
      "ccsp-device-id": token.device_id ?? this.CCSP_DEVICE_ID,
      "ccsp-application-id": this.CCSP_APP_ID,
      "Authorization": `Bearer ${token.access_token}`,
    };
  }

  private async _getCookies(): Promise<string> {
    const url = `${this.API_URL}user/oauth2/authorize?response_type=code&client_id=${this.CCSP_SERVICE_ID}&redirect_uri=${encodeURIComponent(this.API_URL + "user/oauth2/redirect")}`;
    const resp = await fetch(url, { redirect: "follow" });
    const jar: Record<string, string> = {};
    const cooks = resp.headers.getSetCookie?.() ?? [];
    for (const c of cooks) {
      const [kv] = c.split(";");
      const idx = kv.indexOf("=");
      if (idx > 0) jar[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
    }
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private async _getAuthCode(cookieStr: string, username: string, password: string): Promise<string> {
    const resp = await fetch(`${this.API_URL}user/signin`, {
      method: "POST",
      headers: {
        "Referer": `https://${this.BASE_URL}/web/v1/user/signin`,
        "Accept-Encoding": "gzip, deflate, br",
        "Accept": "*/*",
        "Content-Type": "text/plain;charset=UTF-8",
        "Host": this.BASE_URL,
        "Accept-Language": "pt-BR,en-US;q=0.9,en;q=0.8",
        "Origin": `https://${this.BASE_URL}`,
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148_CCS_APP_iOS",
        "Cookie": cookieStr,
      },
      body: JSON.stringify({ email: username, password }),
    });
    if (!resp.ok) throw new APIError(`Signin failed with HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    const redirectUrl = data["redirectUrl"] as string;
    const code = new URL(redirectUrl).searchParams.get("code");
    if (!code) throw new APIError("No auth code in redirect URL");
    return code;
  }

  async login(username: string, password: string, pin?: string | null): Promise<Token> {
    const cookieStr = await this._getCookies();
    const code = await this._getAuthCode(cookieStr, username, password);

    const body = new URLSearchParams({
      client_id: this.CCSP_SERVICE_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.API_URL + "user/oauth2/redirect",
    });
    const resp = await fetch(`${this.API_URL}user/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "User-Agent": this.API_HEADERS["User-Agent"],
        "Authorization": this.BASIC_AUTH,
      },
      body,
    });
    if (!resp.ok) throw new APIError(`Token exchange failed with HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;

    const expiresIn = parseInt(String(data["expires_in"] ?? 82800), 10);
    return makeToken({
      username, password, pin: pin ?? null,
      access_token: data["access_token"] as string,
      refresh_token: data["refresh_token"] as string,
      device_id: this.CCSP_DEVICE_ID,
      valid_until: new Date(Date.now() + expiresIn * 1000),
    });
  }

  async getVehicles(token: Token): Promise<Vehicle[]> {
    const resp = await fetch(`${this.API_URL}spa/vehicles`, {
      headers: this._getAuthenticatedHeaders(token),
    });
    if (!resp.ok) throw new APIError(`getVehicles failed with HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    const msg = data["resMsg"] as Record<string, unknown> | undefined;
    if (!msg?.["vehicles"]) throw new APIError("Missing resMsg.vehicles in response");

    const result: Vehicle[] = [];
    for (const entry of msg["vehicles"] as Array<Record<string, unknown>>) {
      const type = entry["type"] as string;
      let engine_type: string = ENGINE_TYPES.ICE;
      if (type === "EV") engine_type = ENGINE_TYPES.EV;
      else if (type === "PHEV" || type === "PE") engine_type = ENGINE_TYPES.PHEV;
      else if (type === "HV") engine_type = ENGINE_TYPES.HEV;
      result.push(makeVehicle({
        id: entry["vehicleId"] as string,
        name: entry["nickname"] as string,
        model: entry["vehicleName"] as string,
        registration_date: entry["regDate"] as string,
        VIN: entry["vin"] as string,
        engine_type,
        ccu_ccs2_protocol_support: (entry["ccuCCS2ProtocolSupport"] as number) ?? 0,
      }));
    }
    return result;
  }

  async updateVehicleWithCachedState(token: Token, vehicle: Vehicle): Promise<void> {
    const state = await this._getVehicleState(token, vehicle, false);
    const loc = await this._getVehicleLocation(token, vehicle);
    this._updateVehicleProperties(vehicle, state);
    if (loc) this._updateVehicleLocation(vehicle, loc);
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const state = await this._getVehicleState(token, vehicle, true);
    const loc = await this._getVehicleLocation(token, vehicle);
    this._updateVehicleProperties(vehicle, state);
    if (loc) this._updateVehicleLocation(vehicle, loc);
  }

  private async _getVehicleState(token: Token, vehicle: Vehicle, forceRefresh: boolean): Promise<Record<string, unknown>> {
    const isCcs2 = (vehicle.ccu_ccs2_protocol_support ?? 0) !== 0;
    const suffix = isCcs2 ? "/ccs2/carstatus/latest" : "/status/latest";
    const url = `${this.API_URL}spa/vehicles/${vehicle.id}${suffix}`;
    const headers = this._getAuthenticatedHeaders(token);
    if (forceRefresh) headers["REFRESH"] = "true";
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new APIError(`getVehicleState failed with HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    return data["resMsg"] as Record<string, unknown>;
  }

  private async _getVehicleLocation(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    try {
      const url = `${this.API_URL}spa/vehicles/${vehicle.id}/location/park`;
      const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
      if (!resp.ok) return null;
      const data = await resp.json() as Record<string, unknown>;
      return data["resMsg"] as Record<string, unknown> ?? null;
    } catch { return null; }
  }

  private _updateVehicleProperties(vehicle: Vehicle, state: Record<string, unknown>): void {
    if (state["time"]) {
      vehicle.last_updated_at = parseDateBr(String(state["time"])) ?? new Date();
    } else {
      vehicle.last_updated_at = new Date();
    }

    vehicle.engine_is_running = state["engine"] as boolean | null ?? null;
    vehicle.air_control_is_on = state["airCtrlOn"] as boolean | null ?? null;

    const battery = state["battery"] as Record<string, unknown> | undefined;
    if (battery) vehicle.car_battery_percentage = battery["batSoc"] as number | null ?? null;

    vehicle.fuel_level = state["fuelLevel"] as number | null ?? null;
    vehicle.fuel_level_is_low = state["lowFuelLight"] as boolean | null ?? null;

    const dte = state["dte"] as Record<string, unknown> | undefined;
    if (dte) {
      vehicle.fuel_driving_range_value = dte["value"] as number | null ?? null;
      vehicle.fuel_driving_range_unit = DISTANCE_UNITS[dte["unit"] as number] ?? null;
    }

    const doorState = state["doorOpen"] as Record<string, unknown> ?? {};
    vehicle.is_locked = state["doorLock"] as boolean ?? true;
    vehicle.front_left_door_is_open = Boolean(doorState["frontLeft"]);
    vehicle.front_right_door_is_open = Boolean(doorState["frontRight"]);
    vehicle.back_left_door_is_open = Boolean(doorState["backLeft"]);
    vehicle.back_right_door_is_open = Boolean(doorState["backRight"]);
    vehicle.hood_is_open = state["hoodOpen"] as boolean ?? false;
    vehicle.trunk_is_open = state["trunkOpen"] as boolean ?? false;

    const windowState = state["windowOpen"] as Record<string, unknown> ?? {};
    vehicle.front_left_window_is_open = Boolean(windowState["frontLeft"]);
    vehicle.front_right_window_is_open = Boolean(windowState["frontRight"]);
    vehicle.back_left_window_is_open = Boolean(windowState["backLeft"]);
    vehicle.back_right_window_is_open = Boolean(windowState["backRight"]);

    vehicle.defrost_is_on = state["defrost"] as boolean ?? false;
    vehicle.steering_wheel_heater_is_on = (state["steerWheelHeat"] as number) === 1;
    vehicle.back_window_heater_is_on = (state["sideBackWindowHeat"] as number) === 1;

    const seatState = state["seatHeaterVentState"] as Record<string, unknown> ?? {};
    vehicle.front_left_seat_status = SEAT_STATUS[seatState["drvSeatHeatState"] as number] ?? null;
    vehicle.front_right_seat_status = SEAT_STATUS[seatState["astSeatHeatState"] as number] ?? null;
    vehicle.rear_left_seat_status = SEAT_STATUS[seatState["rlSeatHeatState"] as number] ?? null;
    vehicle.rear_right_seat_status = SEAT_STATUS[seatState["rrSeatHeatState"] as number] ?? null;

    const tireLamp = state["tirePressureLamp"] as Record<string, unknown> ?? {};
    const tireAll = Boolean(tireLamp["tirePressureLampAll"]);
    vehicle.tire_pressure_all_warning_is_on = tireAll;
    vehicle.tire_pressure_rear_left_warning_is_on = Boolean(tireLamp["tirePressureWarningLampRearLeft"] ?? tireAll);
    vehicle.tire_pressure_front_left_warning_is_on = Boolean(tireLamp["tirePressureWarningLampFrontLeft"] ?? tireAll);
    vehicle.tire_pressure_front_right_warning_is_on = Boolean(tireLamp["tirePressureWarningLampFrontRight"] ?? tireAll);
    vehicle.tire_pressure_rear_right_warning_is_on = Boolean(tireLamp["tirePressureWarningLampRearRight"] ?? tireAll);

    vehicle.washer_fluid_warning_is_on = state["washerFluidStatus"] as boolean ?? false;
    vehicle.brake_fluid_warning_is_on = state["breakOilStatus"] as boolean ?? false;
    vehicle.smart_key_battery_warning_is_on = state["smartKeyBatteryWarning"] as boolean ?? false;

    vehicle.data = state;
  }

  private _updateVehicleLocation(vehicle: Vehicle, locationData: Record<string, unknown>): void {
    const coord = locationData["coord"] as Record<string, unknown> | undefined;
    const lat = coord?.["lat"] as number | undefined;
    const lon = (coord?.["lng"] ?? coord?.["lon"]) as number | undefined;
    if (lat && lon) {
      vehicle.location_latitude = lat;
      vehicle.location_longitude = lon;
      vehicle.location_last_updated_at = parseIsoDatetime(locationData["time"] as string) ?? null;
    }
  }

  private async _ensureControlToken(token: Token): Promise<string> {
    if (this.controlToken && this.controlTokenExpiresAt && this.controlTokenExpiresAt.getTime() - 5000 > Date.now()) {
      return this.controlToken;
    }
    if (!token.pin) throw new APIError("PIN is required for remote commands.");

    const deviceId = token.device_id ?? this.CCSP_DEVICE_ID;
    const resp = await fetch(`${this.API_URL}user/pin`, {
      method: "PUT",
      headers: this._getAuthenticatedHeaders(token),
      body: JSON.stringify({ pin: token.pin, deviceId }),
    });
    if (!resp.ok) throw new APIError(`Failed to get control token: HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    if (!data["controlToken"]) throw new APIError("Failed to obtain control token.");

    this.controlToken = `Bearer ${data["controlToken"]}`;
    const expiresIn = (data["expiresTime"] as number) ?? 600;
    this.controlTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    return this.controlToken;
  }

  async lockAction(token: Token, vehicle: Vehicle, action: string): Promise<string> {
    const controlToken = await this._ensureControlToken(token);
    const deviceId = token.device_id ?? this.CCSP_DEVICE_ID;
    const url = `${this.API_URL_V2}spa/vehicles/${vehicle.id}/control/door`;
    const headers = {
      ...this._getAuthenticatedHeaders(token),
      "Authorization": controlToken,
      "ccsp-device-id": deviceId,
      "ccuCCS2ProtocolSupport": String(vehicle.ccu_ccs2_protocol_support ?? 0),
    };
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ deviceId, action }),
    });
    if (!resp.ok) throw new APIError(`lockAction failed: HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    if (data["retCode"] !== "S") throw new APIError(`Lock action failed: ${data["resCode"]} ${data["resMsg"]}`);
    return data["msgId"] as string ?? "";
  }

  async checkActionStatus(token: Token, vehicle: Vehicle, actionId: string, synchronous = false, timeout = 0): Promise<ORDER_STATUS> {
    if (synchronous) {
      const end = Date.now() + timeout * 1000;
      while (Date.now() < end) {
        const status = await this.checkActionStatus(token, vehicle, actionId, false);
        if (status !== ORDER_STATUS.PENDING) return status;
        await new Promise(r => setTimeout(r, 5000));
      }
      return ORDER_STATUS.TIMEOUT;
    }

    const url = `${this.API_URL}spa/notifications/${vehicle.id}/records`;
    const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
    if (!resp.ok) return ORDER_STATUS.UNKNOWN;
    const data = await resp.json() as Record<string, unknown>;
    const records = (data["resMsg"] as Array<Record<string, unknown>>) ?? [];

    for (const record of records) {
      if (record["recordId"] !== actionId) continue;
      const result = String(record["result"] ?? "").toLowerCase();
      if (result === "success") return ORDER_STATUS.SUCCESS;
      if (result === "fail") return ORDER_STATUS.FAILED;
      if (result === "non-response") return ORDER_STATUS.TIMEOUT;
      if (result === "" || result === "pending") return ORDER_STATUS.PENDING;
    }
    return ORDER_STATUS.UNKNOWN;
  }

  async setWindowsState(token: Token, vehicle: Vehicle, options: WindowRequestOptions): Promise<string> {
    const controlToken = await this._ensureControlToken(token);
    const deviceId = token.device_id ?? this.CCSP_DEVICE_ID;
    const url = `${this.API_URL_V2}spa/vehicles/${vehicle.id}/control/window`;

    const action = (options.front_left === WINDOW_STATE.CLOSED || options.front_right === WINDOW_STATE.CLOSED
      || options.back_left === WINDOW_STATE.CLOSED || options.back_right === WINDOW_STATE.CLOSED)
      ? "close" : "open";

    const headers = {
      ...this._getAuthenticatedHeaders(token),
      "Authorization": controlToken,
      "ccsp-device-id": deviceId,
      "ccuCCS2ProtocolSupport": String(vehicle.ccu_ccs2_protocol_support ?? 0),
    };
    const resp = await fetch(url, {
      method: "POST", headers, body: JSON.stringify({ action, deviceId }),
    });
    if (!resp.ok) throw new APIError(`setWindowsState failed: HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    if (data["retCode"] !== "S") throw new APIError(`Window action failed: ${data["resCode"]} ${data["resMsg"]}`);
    return data["msgId"] as string ?? "";
  }

  async startHazardLights(token: Token, vehicle: Vehicle): Promise<string> {
    const controlToken = await this._ensureControlToken(token);
    const deviceId = token.device_id ?? this.CCSP_DEVICE_ID;
    const url = `${this.API_URL_V2}spa/vehicles/${vehicle.id}/control/light`;
    const headers = {
      ...this._getAuthenticatedHeaders(token),
      "Authorization": controlToken,
      "ccsp-device-id": deviceId,
      "ccuCCS2ProtocolSupport": String(vehicle.ccu_ccs2_protocol_support ?? 0),
    };
    const resp = await fetch(url, { method: "POST", headers });
    if (!resp.ok) throw new APIError(`startHazardLights failed: HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    if (data["retCode"] !== "S") throw new APIError(`Hazard lights failed: ${data["resCode"]} ${data["resMsg"]}`);
    return data["msgId"] as string ?? "";
  }

  async startClimate(token: Token, vehicle: Vehicle, options: ClimateRequestOptions): Promise<string> {
    const controlToken = await this._ensureControlToken(token);
    const deviceId = token.device_id ?? this.CCSP_DEVICE_ID;
    const url = `${this.API_URL_V2}spa/vehicles/${vehicle.id}/control/engine`;

    options.set_temp ??= 21;
    options.duration ??= 10;
    options.defrost ??= false;
    options.climate ??= true;
    options.heating ??= 0;
    options.front_left_seat ??= 0;

    const tempCode = getIndexIntoHexTemp(Math.round(options.set_temp));

    const headers = {
      ...this._getAuthenticatedHeaders(token),
      "Authorization": controlToken,
      "ccsp-device-id": deviceId,
      "ccuCCS2ProtocolSupport": String(vehicle.ccu_ccs2_protocol_support ?? 0),
    };
    const payload = {
      action: "start",
      options: {
        airCtrl: options.climate ? 1 : 0,
        heating1: options.heating,
        seatHeaterVentCMD: { drvSeatOptCmd: options.front_left_seat },
        defrost: options.defrost,
        igniOnDuration: options.duration,
      },
      hvacType: 1,
      deviceId,
      tempCode,
      unit: "C",
    };

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!resp.ok) throw new APIError(`startClimate failed: HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    if (data["retCode"] !== "S") throw new APIError(`Start climate failed: ${data["resCode"]} ${data["resMsg"]}`);
    return data["msgId"] as string ?? "";
  }

  async stopClimate(token: Token, vehicle: Vehicle): Promise<string> {
    const controlToken = await this._ensureControlToken(token);
    const deviceId = token.device_id ?? this.CCSP_DEVICE_ID;
    const url = `${this.API_URL_V2}spa/vehicles/${vehicle.id}/control/engine`;
    const headers = {
      ...this._getAuthenticatedHeaders(token),
      "Authorization": controlToken,
      "ccsp-device-id": deviceId,
      "ccuCCS2ProtocolSupport": String(vehicle.ccu_ccs2_protocol_support ?? 0),
    };
    const resp = await fetch(url, {
      method: "POST", headers, body: JSON.stringify({ action: "stop", deviceId }),
    });
    if (!resp.ok) throw new APIError(`stopClimate failed: HTTP ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    if (data["retCode"] !== "S") throw new APIError(`Stop climate failed: ${data["resCode"]} ${data["resMsg"]}`);
    return data["msgId"] as string ?? "";
  }

  async updateMonthTripInfo(token: Token, vehicle: Vehicle, yyyymmString: string): Promise<void> {
    try {
      const url = `${this.API_URL}spa/vehicles/${vehicle.id}/tripinfo`;
      const resp = await fetch(url, {
        method: "POST",
        headers: this._getAuthenticatedHeaders(token),
        body: JSON.stringify({ tripPeriodType: 0, setTripMonth: yyyymmString }),
      });
      if (!resp.ok) return;
      const tripData = ((await resp.json() as Record<string, unknown>)["resMsg"] as Record<string, unknown>);
      if (!tripData?.["monthTripDayCnt"]) return;

      const result: MonthTripInfo = {
        yyyymm: yyyymmString,
        day_list: [],
        summary: {
          drive_time: tripData["tripDrvTime"] as number | null,
          idle_time: tripData["tripIdleTime"] as number | null,
          distance: tripData["tripDist"] as number | null,
          avg_speed: tripData["tripAvgSpeed"] as number | null,
          max_speed: tripData["tripMaxSpeed"] as number | null,
        },
      };

      for (const day of (tripData["tripDayList"] as Array<Record<string, unknown>>) ?? []) {
        result.day_list.push({ yyyymmdd: day["tripDayInMonth"] as string, trip_count: day["tripCntDay"] as number });
      }
      vehicle.month_trip_info = result;
    } catch { /* optional */ }
  }

  async updateDayTripInfo(token: Token, vehicle: Vehicle, yyyymmddString: string): Promise<void> {
    try {
      const url = `${this.API_URL}spa/vehicles/${vehicle.id}/tripinfo`;
      const resp = await fetch(url, {
        method: "POST",
        headers: this._getAuthenticatedHeaders(token),
        body: JSON.stringify({ tripPeriodType: 1, setTripDay: yyyymmddString }),
      });
      if (!resp.ok) return;
      const tripData = ((await resp.json() as Record<string, unknown>)["resMsg"] as Record<string, unknown>);
      const dayTripList = (tripData?.["dayTripList"] as Array<Record<string, unknown>>) ?? [];
      if (!dayTripList.length) return;

      const msg = dayTripList[0];
      const result: DayTripInfo = {
        yyyymmdd: yyyymmddString,
        trip_list: [],
        summary: {
          drive_time: msg["tripDrvTime"] as number | null,
          idle_time: msg["tripIdleTime"] as number | null,
          distance: msg["tripDist"] as number | null,
          avg_speed: msg["tripAvgSpeed"] as number | null,
          max_speed: msg["tripMaxSpeed"] as number | null,
        },
      };

      for (const trip of (msg["tripList"] as Array<Record<string, unknown>>) ?? []) {
        result.trip_list.push({
          hhmmss: trip["tripTime"] as string | null,
          drive_time: trip["tripDrvTime"] as number | null,
          idle_time: trip["tripIdleTime"] as number | null,
          distance: trip["tripDist"] as number | null,
          avg_speed: trip["tripAvgSpeed"] as number | null,
          max_speed: trip["tripMaxSpeed"] as number | null,
        });
      }
      vehicle.day_trip_info = result;
    } catch { /* optional */ }
  }
}
