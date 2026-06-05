import { ApiImpl } from "../ApiImpl.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle } from "../../types/Vehicle.js";
import { ClimateRequestOptions, OTPRequest } from "../../types/requests.js";
import {
  DISTANCE_UNITS,
  ENGINE_TYPES,
  LOGIN_TOKEN_LIFETIME_HOURS,
  ORDER_STATUS,
  TEMPERATURE_UNITS,
  VEHICLE_LOCK_ACTION,
  OTP_NOTIFY_TYPE,
} from "../../constants/index.js";
import { APIError, AuthenticationError } from "../../exceptions/index.js";
import { getChildValue, parseIsoDatetime } from "../../utils/index.js";

export class KiaUvoApiUSA extends ApiImpl {
  private BASE_URL = "api.owners.kia.com";
  private API_URL: string;
  private deviceId: string;
  temperature_range: number[];

  constructor(region: number, brand: number, language: string) {
    super();
    this.API_URL = "https://" + this.BASE_URL + "/apigw/v1/";
    this.deviceId = crypto.randomUUID().toUpperCase();
    this.temperature_range = Array.from({ length: 21 }, (_, i) => 62 + i);
  }

  private _apiHeaders(): Record<string, string> {
    const clientUuid = crypto.randomUUID();
    const date = new Date().toUTCString();
    return {
      "content-type": "application/json;charset=utf-8",
      accept: "application/json",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "en-US,en;q=0.9",
      apptype: "L",
      appversion: "7.22.0",
      clientid: "SPACL716-APL",
      clientuuid: clientUuid,
      from: "SPA",
      host: this.BASE_URL,
      language: "0",
      offset: String(new Date().getTimezoneOffset() / -60),
      ostype: "iOS",
      osversion: "15.8.5",
      phonebrand: "iPhone",
      secretkey: "sydnat-9kykci-Kuhtep-h5nK",
      to: "APIGW",
      tokentype: "A",
      "user-agent": "KIAPrimo_iOS/37 CFNetwork/1335.0.3.4 Darwin/21.6.0",
      date,
      deviceid: this.deviceId,
    };
  }

  private _authedHeaders(token: Token, vehicle: Vehicle): Record<string, string> {
    const h = this._apiHeaders();
    h["sid"] = token.access_token!;
    h["vinkey"] = vehicle.key!;
    return h;
  }

  async login(username: string, password: string, pin?: string | null): Promise<Token | OTPRequest> {
    const url = this.API_URL + "prof/authUser";
    const data: Record<string, unknown> = {
      deviceKey: this.deviceId,
      deviceType: 2,
      userCredential: { userId: username, password },
      tncFlag: 1,
    };
    const headers = this._apiHeaders();
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
    const json = (await resp.json()) as Record<string, unknown>;
    const sessionId = resp.headers.get("sid");

    if (sessionId) {
      const valid_until = new Date(Date.now() + LOGIN_TOKEN_LIFETIME_HOURS * 3600 * 1000);
      return makeToken({ username, password, access_token: sessionId, valid_until, device_id: this.deviceId, pin: pin ?? null });
    }

    if (json["payload"] && (json["payload"] as Record<string, unknown>)["otpKey"]) {
      const payload = json["payload"] as Record<string, unknown>;
      return {
        otp_key: payload["otpKey"] as string,
        request_id: resp.headers.get("xid") ?? "",
        email: payload["email"] as string | null,
        sms: payload["phone"] as string | null,
        has_email: Boolean(payload["hasEmail"]),
        has_sms: Boolean(payload["hasPhone"]),
      };
    }
    throw new APIError(`No session id returned in login`);
  }

  async sendOtp(otpRequest: OTPRequest, notifyType: OTP_NOTIFY_TYPE): Promise<void> {
    const url = this.API_URL + "cmm/sendOTP";
    const headers = this._apiHeaders();
    headers["otpkey"] = otpRequest.otp_key!;
    headers["notifytype"] = notifyType;
    headers["xid"] = otpRequest.request_id!;
    await fetch(url, { method: "POST", headers, body: JSON.stringify({}) });
  }

  async verifyOtpAndCompleteLogin(username: string, password: string, otpCode: string, otpRequest: OTPRequest, pin?: string | null): Promise<Token> {
    const verifyUrl = this.API_URL + "cmm/verifyOTP";
    const headers = this._apiHeaders();
    headers["otpkey"] = otpRequest.otp_key!;
    headers["xid"] = otpRequest.request_id!;
    const verifyResp = await fetch(verifyUrl, { method: "POST", headers, body: JSON.stringify({ otp: otpCode }) });
    const verifyJson = (await verifyResp.json()) as Record<string, unknown>;
    const status = verifyJson["status"] as Record<string, unknown>;
    if ((status["statusCode"] as number) !== 0) throw new AuthenticationError("OTP verification failed");

    const sid = verifyResp.headers.get("sid");
    const rmtoken = verifyResp.headers.get("rmtoken");
    if (!sid || !rmtoken) throw new AuthenticationError("No sid or rmtoken from OTP verification");

    const authUrl = this.API_URL + "prof/authUser";
    const authHeaders = this._apiHeaders();
    authHeaders["sid"] = sid;
    authHeaders["rmtoken"] = rmtoken;
    const authResp = await fetch(authUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ deviceKey: this.deviceId, deviceType: 2, userCredential: { userId: username, password } }),
    });
    const finalSid = authResp.headers.get("sid");
    if (!finalSid) throw new AuthenticationError("No final sid from OTP login completion");

    const valid_until = new Date(Date.now() + LOGIN_TOKEN_LIFETIME_HOURS * 3600 * 1000);
    return makeToken({ username, password, access_token: finalSid, refresh_token: rmtoken, valid_until, device_id: this.deviceId, pin: pin ?? null });
  }

  async getVehicles(token: Token): Promise<Vehicle[]> {
    const url = this.API_URL + "ownr/gvl";
    const headers = this._apiHeaders();
    headers["sid"] = token.access_token!;
    const resp = await fetch(url, { headers });
    const json = (await resp.json()) as Record<string, unknown>;
    if (!json["payload"]) throw new APIError("Missing payload in getVehicles");
    const summaries = ((json["payload"] as Record<string, unknown>)["vehicleSummary"] as Array<Record<string, unknown>>);
    return summaries.map((entry) =>
      makeVehicle({
        id: entry["vehicleIdentifier"] as string,
        name: entry["nickName"] as string,
        model: entry["modelName"] as string,
        key: entry["vehicleKey"] as string,
        engine_type: entry["fuelType"] === 4 ? ENGINE_TYPES.EV : null,
      })
    );
  }

  async refreshVehicles(token: Token, vehicles: Record<string, Vehicle>): Promise<void> {
    const url = this.API_URL + "ownr/gvl";
    const headers = this._apiHeaders();
    headers["sid"] = token.access_token!;
    const resp = await fetch(url, { headers });
    const json = (await resp.json()) as Record<string, unknown>;
    if (!json["payload"]) return;
    const summaries = ((json["payload"] as Record<string, unknown>)["vehicleSummary"] as Array<Record<string, unknown>>);
    for (const entry of summaries) {
      const vid = entry["vehicleIdentifier"] as string;
      if (vehicles[vid]) {
        vehicles[vid].name = entry["nickName"] as string;
        vehicles[vid].model = entry["modelName"] as string;
        vehicles[vid].key = entry["vehicleKey"] as string;
      }
    }
  }

  async updateVehicleWithCachedState(token: Token, vehicle: Vehicle): Promise<void> {
    const state = await this._getCachedState(token, vehicle);
    this._applyVehicleState(vehicle, state);
    if (vehicle.engine_type === ENGINE_TYPES.EV || vehicle.engine_type === ENGINE_TYPES.PHEV) {
      await this._getChargeTargets(token, vehicle);
    }
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const url = this.API_URL + "rems/rvs";
    const headers = this._authedHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ vinKey: [vehicle.key] }) });
    // Fall back to cached after triggering force refresh
    await this.updateVehicleWithCachedState(token, vehicle);
  }

  private async _getCachedState(token: Token, vehicle: Vehicle): Promise<Record<string, unknown>> {
    const url = this.API_URL + "cmm/gvi";
    const headers = this._authedHeaders(token, vehicle);
    const body = {
      vehicleConfigReq: { airTempRange: "0", maintenance: true, seatHeatCoolFront: true, vehicle: true, vehicleFeature: true },
      vehicleInfoReq: { drivingActivty: false, dtc: true, enrollment: true, functionalCards: false, location: true, remoteFatc: true, vehicleStatus: true },
      vinKey: [vehicle.key],
    };
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const json = (await resp.json()) as Record<string, unknown>;
    const status = (json["status"] as Record<string, unknown>);
    if ((status["statusCode"] as number) !== 0) {
      if ([1003, 1005].includes(status["errorCode"] as number)) throw new AuthenticationError("Session invalid");
      throw new APIError(`API error: ${JSON.stringify(status)}`);
    }
    return (json["payload"] as Record<string, unknown>) ?? {};
  }

  private async _getChargeTargets(token: Token, vehicle: Vehicle): Promise<void> {
    const url = this.API_URL + "evc/gts";
    const headers = this._authedHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ vinKey: [vehicle.key] }) });
    const json = (await resp.json()) as Record<string, unknown>;
    const payload = json["payload"] as Record<string, unknown>;
    if (!payload) return;
    const soc = getChildValue(payload, "evInfo.targetSOC") as Array<Record<string, unknown>> | null;
    if (soc) {
      const ac = soc.filter((x) => x["plugType"] === 1).pop();
      const dc = soc.filter((x) => x["plugType"] === 0).pop();
      if (ac) vehicle.ev_charge_limits_ac = ac["targetSOClevel"] as number;
      if (dc) vehicle.ev_charge_limits_dc = dc["targetSOClevel"] as number;
    }
  }

  private _applyVehicleState(vehicle: Vehicle, state: Record<string, unknown>): void {
    const vs = "lastVehicleInfo.vehicleStatusRpt.vehicleStatus";
    vehicle.last_updated_at = parseIsoDatetime(getChildValue(state, `${vs}.syncDate.utc`) as string);
    vehicle.odometer = getChildValue(state, "vehicleConfig.vehicleDetail.vehicle.mileage") as number;
    vehicle.odometer_unit = DISTANCE_UNITS[3] ?? null;
    vehicle.car_battery_percentage = getChildValue(state, `${vs}.batteryStatus.stateOfCharge`) as number | null;
    vehicle.engine_is_running = getChildValue(state, `${vs}.engine`) as boolean | null;

    const airTemp = getChildValue(state, `${vs}.climate.airTemp.value`);
    if (airTemp === "LOW") vehicle.air_temperature = this.temperature_range[0];
    else if (airTemp === "HIGH") vehicle.air_temperature = this.temperature_range[this.temperature_range.length - 1];
    else if (airTemp) vehicle.air_temperature = airTemp as number;
    if (vehicle.air_temperature != null) vehicle.air_temperature_unit = TEMPERATURE_UNITS[1] ?? null;

    vehicle.defrost_is_on = getChildValue(state, `${vs}.climate.defrost`) as boolean | null;
    vehicle.steering_wheel_heater_is_on = getChildValue(state, `${vs}.climate.heatingAccessory.steeringWheel`) as boolean | null;
    vehicle.back_window_heater_is_on = getChildValue(state, `${vs}.climate.heatingAccessory.rearWindow`) as boolean | null;
    vehicle.side_mirror_heater_is_on = getChildValue(state, `${vs}.climate.heatingAccessory.sideMirror`) as boolean | null;
    vehicle.washer_fluid_warning_is_on = getChildValue(state, `${vs}.washerFluidStatus`) as boolean | null;
    vehicle.brake_fluid_warning_is_on = getChildValue(state, `${vs}.breakOilStatus`) as boolean | null;
    vehicle.smart_key_battery_warning_is_on = getChildValue(state, `${vs}.smartKeyBatteryWarning`) as boolean | null;
    vehicle.tire_pressure_all_warning_is_on = getChildValue(state, `${vs}.tirePressure.all`) as boolean | null;
    vehicle.is_locked = getChildValue(state, `${vs}.doorLock`) as boolean | null;
    vehicle.front_left_door_is_open = getChildValue(state, `${vs}.doorStatus.frontLeft`) as boolean | null;
    vehicle.front_right_door_is_open = getChildValue(state, `${vs}.doorStatus.frontRight`) as boolean | null;
    vehicle.back_left_door_is_open = getChildValue(state, `${vs}.doorStatus.backLeft`) as boolean | null;
    vehicle.back_right_door_is_open = getChildValue(state, `${vs}.doorStatus.backRight`) as boolean | null;
    vehicle.hood_is_open = getChildValue(state, `${vs}.doorStatus.hood`) as boolean | null;
    vehicle.trunk_is_open = getChildValue(state, `${vs}.doorStatus.trunk`) as boolean | null;
    vehicle.sunroof_is_open = getChildValue(state, `${vs}.sunroofOpen`) as boolean | null;
    vehicle.front_left_window_is_open = getChildValue(state, `${vs}.windowOpen.frontLeft`) as boolean | null;
    vehicle.front_right_window_is_open = getChildValue(state, `${vs}.windowOpen.frontRight`) as boolean | null;
    vehicle.back_left_window_is_open = getChildValue(state, `${vs}.windowOpen.backLeft`) as boolean | null;
    vehicle.back_right_window_is_open = getChildValue(state, `${vs}.windowOpen.backRight`) as boolean | null;

    vehicle.ev_battery_percentage = getChildValue(state, `${vs}.evStatus.batteryStatus`) as number | null;
    vehicle.ev_battery_is_charging = getChildValue(state, `${vs}.evStatus.batteryCharge`) as boolean | null;
    vehicle.ev_battery_is_plugged_in = getChildValue(state, `${vs}.evStatus.batteryPlugin`) as boolean | null;
    vehicle.ev_charging_power = getChildValue(state, `${vs}.evStatus.realTimePower`) as number | null;
    vehicle.ev_battery_precondition_enabled = getChildValue(state, `${vs}.evStatus.batteryPrecondition`) as boolean | null;

    const evDrv = `${vs}.evStatus.drvDistance.0.rangeByFuel`;
    const evRange = getChildValue(state, `${evDrv}.evModeRange.value`);
    if (evRange != null) {
      vehicle.ev_driving_range = evRange as number;
      vehicle.ev_driving_range_unit = DISTANCE_UNITS[getChildValue(state, `${evDrv}.evModeRange.unit`) as number] ?? null;
    }
    const totalRange = getChildValue(state, `${evDrv}.totalAvailableRange.value`);
    if (totalRange != null) {
      vehicle.total_driving_range = totalRange as number;
      vehicle.total_driving_range_unit = DISTANCE_UNITS[getChildValue(state, `${evDrv}.totalAvailableRange.unit`) as number] ?? null;
    }

    const chargeTime = `${vs}.evStatus.remainChargeTime.0`;
    vehicle.ev_estimated_current_charge_duration = getChildValue(state, `${chargeTime}.timeInterval.value`) as number | null;
    vehicle.ev_estimated_fast_charge_duration = getChildValue(state, `${chargeTime}.etc1.value`) as number | null;
    vehicle.ev_estimated_portable_charge_duration = getChildValue(state, `${chargeTime}.etc2.value`) as number | null;
    vehicle.ev_estimated_station_charge_duration = getChildValue(state, `${chargeTime}.etc3.value`) as number | null;

    const chargeDict = getChildValue(state, `${vs}.evStatus.targetSOC`) as Array<Record<string, unknown>> | null;
    if (chargeDict) {
      const ac = chargeDict.filter((x) => x["plugType"] === 1).pop();
      const dc = chargeDict.filter((x) => x["plugType"] === 0).pop();
      if (ac) vehicle.ev_charge_limits_ac = ac["targetSOClevel"] as number;
      if (dc) vehicle.ev_charge_limits_dc = dc["targetSOClevel"] as number;
    }

    const v2xStatus = getChildValue(state, `${vs}.evStatus.v2xStatus`);
    if (v2xStatus != null) vehicle.ev_v2x_status = Boolean(v2xStatus);
    const v2lStatus = getChildValue(state, `${vs}.evStatus.v2lStatus`);
    if (v2lStatus != null) vehicle.ev_v2l_status = Boolean(v2lStatus);

    const dteFuel = `${vs}.evStatus.drvDistance.0.rangeByFuel.gasModeRange`;
    const gasRange = getChildValue(state, `${dteFuel}.value`);
    if (gasRange != null) {
      vehicle.fuel_driving_range = gasRange as number;
      vehicle.fuel_driving_range_unit = DISTANCE_UNITS[getChildValue(state, `${dteFuel}.unit`) as number] ?? null;
    }
    vehicle.fuel_level_is_low = getChildValue(state, `${vs}.lowFuelLight`) as boolean | null;
    vehicle.fuel_level = getChildValue(state, `${vs}.fuelLevel`) as number | null;

    vehicle.data = state;
  }

  async lockAction(token: Token, vehicle: Vehicle, action: VEHICLE_LOCK_ACTION): Promise<string> {
    const cmd = action === VEHICLE_LOCK_ACTION.LOCK ? "rdo" : "rdou";
    const url = this.API_URL + `rems/${cmd}`;
    const headers = this._authedHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ vinKey: [vehicle.key] }) });
    const json = (await resp.json()) as Record<string, unknown>;
    return ((json["payload"] as Record<string, unknown>)?.["xid"] as string) ?? "ok";
  }

  async startClimate(token: Token, vehicle: Vehicle, options: ClimateRequestOptions): Promise<string> {
    const url = this.API_URL + "rems/rsc";
    const headers = this._authedHeaders(token, vehicle);
    const temp = options.set_temp ?? 72;
    const body = {
      vinKey: [vehicle.key],
      setting: {
        airCtrl: 1,
        igniOnDuration: options.duration ?? 10,
        airTempvalue: String(temp),
        defrost: options.defrost ?? false,
        heating1: options.heating ?? 0,
      },
    };
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const json = (await resp.json()) as Record<string, unknown>;
    return ((json["payload"] as Record<string, unknown>)?.["xid"] as string) ?? "ok";
  }

  async stopClimate(token: Token, vehicle: Vehicle): Promise<string> {
    const url = this.API_URL + "rems/rscc";
    const headers = this._authedHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ vinKey: [vehicle.key] }) });
    const json = (await resp.json()) as Record<string, unknown>;
    return ((json["payload"] as Record<string, unknown>)?.["xid"] as string) ?? "ok";
  }

  async startCharge(token: Token, vehicle: Vehicle): Promise<string> {
    const url = this.API_URL + "evc/rcsc";
    const headers = this._authedHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ vinKey: [vehicle.key] }) });
    const json = (await resp.json()) as Record<string, unknown>;
    return ((json["payload"] as Record<string, unknown>)?.["xid"] as string) ?? "ok";
  }

  async stopCharge(token: Token, vehicle: Vehicle): Promise<string> {
    const url = this.API_URL + "evc/rcscc";
    const headers = this._authedHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ vinKey: [vehicle.key] }) });
    const json = (await resp.json()) as Record<string, unknown>;
    return ((json["payload"] as Record<string, unknown>)?.["xid"] as string) ?? "ok";
  }

  async setChargeLimits(token: Token, vehicle: Vehicle, ac: number, dc: number): Promise<string> {
    const url = this.API_URL + "evc/sts";
    const headers = this._authedHeaders(token, vehicle);
    const body = {
      vinKey: [vehicle.key],
      targetSOClist: [
        { plugType: 0, targetSOClevel: dc },
        { plugType: 1, targetSOClevel: ac },
      ],
    };
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const json = (await resp.json()) as Record<string, unknown>;
    return ((json["payload"] as Record<string, unknown>)?.["xid"] as string) ?? "ok";
  }

  async checkActionStatus(token: Token, vehicle: Vehicle, actionId: string, synchronous = false, timeout = 0): Promise<ORDER_STATUS> {
    return ORDER_STATUS.UNKNOWN;
  }

  async refreshAccessToken(token: Token): Promise<Token | OTPRequest> {
    return this.login(token.username, token.password, token.pin);
  }
}
