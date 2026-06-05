import { ApiImpl } from "../ApiImpl.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle, DailyDrivingStats } from "../../types/Vehicle.js";
import { ClimateRequestOptions, OTPRequest } from "../../types/requests.js";
import {
  BRAND_GENESIS, BRAND_HYUNDAI, BRAND_KIA, BRANDS,
  DISTANCE_UNITS, ENGINE_TYPES, ORDER_STATUS, OTP_NOTIFY_TYPE,
  SEAT_STATUS, TEMPERATURE_UNITS, VEHICLE_LOCK_ACTION,
} from "../../constants/index.js";
import { APIError, AuthenticationError } from "../../exceptions/index.js";
import { getChildValue, getFloat, getHexTempIntoIndex, getIndexIntoHexTemp, parseIsoDatetime } from "../../utils/index.js";

export class KiaUvoApiCA extends ApiImpl {
  temperature_range: number[] = [];

  private static readonly TEMP_RANGE_C_OLD = Array.from({ length: 32 }, (_, i) => (i + 32) * 0.5);
  private static readonly TEMP_RANGE_C_NEW = Array.from({ length: 36 }, (_, i) => (i + 28) * 0.5);
  private static readonly TEMP_MODEL_YEAR = 2020;

  private BASE_URL: string;
  private API_URL: string;
  private API_HEADERS: Record<string, string>;
  private brand: number;

  constructor(region: number, brand: number, language: string) {
    super();
    this.brand = brand;

    if (BRANDS[brand] === BRAND_KIA) this.BASE_URL = "kiaconnect.ca";
    else if (BRANDS[brand] === BRAND_HYUNDAI) this.BASE_URL = "mybluelink.ca";
    else this.BASE_URL = "genesisconnect.ca";

    this.API_URL = `https://${this.BASE_URL}/tods/api/`;
    this.API_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-CA,en-US;q=0.8,en;q=0.5,fr;q=0.3",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Content-Type": "application/json;charset=UTF-8",
      "from": "CWP",
      "offset": "-5",
      "language": "0",
      "Origin": `https://${this.BASE_URL}`,
      "Connection": "keep-alive",
      "Referer": `https://${this.BASE_URL}/login`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Priority": "u=0",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache",
      "client_id": "HATAHSPACA0232141ED9722C67715A0B",
      "client_secret": "CLISCR01AHSPA",
    };
  }

  private async _getDeviceId(): Promise<string> {
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const encoded = btoa(hex);
    return encoded;
  }

  private _checkResponseForErrors(response: Record<string, unknown>): void {
    const header = response["responseHeader"] as Record<string, unknown> | undefined;
    if (!header || header["responseCode"] !== 1) return;
    const error = response["error"] as Record<string, unknown> | undefined;
    const code = String(error?.["errorCode"] ?? "");
    const desc = String(error?.["errorDesc"] ?? "");
    if (code === "7110") return; // OTP required — handled in login
    if (["7404", "7402", "7403", "7602"].includes(code)) throw new AuthenticationError(desc);
    throw new APIError(`Server returned: '${desc}'`);
  }

  async login(username: string, password: string, pin?: string | null): Promise<Token | OTPRequest> {
    const deviceId = await this._getDeviceId();
    const url = this.API_URL + "v2/login";
    const headers = { ...this.API_HEADERS, "Deviceid": deviceId };
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ loginId: username, password }),
    });
    const data = await resp.json() as Record<string, unknown>;
    const header = data["responseHeader"] as Record<string, unknown>;

    // OTP required
    if (header["responseCode"] === 1) {
      const error = data["error"] as Record<string, unknown> | undefined;
      if (error?.["errorCode"] === "7110") {
        const selResp = await fetch(this.API_URL + "mfa/selverifmeth", {
          method: "POST",
          headers: { ...this.API_HEADERS, "Deviceid": deviceId },
          body: JSON.stringify({ mfaApiCode: "0107", userAccount: username }),
        });
        const selData = await selResp.json() as Record<string, unknown>;
        const selHeader = selData["responseHeader"] as Record<string, unknown>;
        if (selHeader["responseCode"] !== 0) {
          const selError = selData["error"] as Record<string, unknown> | undefined;
          throw new APIError(`Failed to get verification methods: ${selError?.["errorDesc"]}`);
        }
        const result = selData["result"] as Record<string, unknown>;
        const emailList = (result["emailList"] as string[]) ?? [];
        const phone = result["userPhone"] as string | undefined;
        return {
          request_id: result["userInfoUuid"] as string,
          otp_key: null,
          has_email: true,
          has_sms: Boolean(phone),
          email: emailList[0] ?? username,
          sms: phone ?? null,
        } satisfies OTPRequest;
      }
    }

    this._checkResponseForErrors(data);

    const tokenData = getChildValue(data, "result.token") as Record<string, unknown>;
    const expireIn = parseInt(String(tokenData["expireIn"] ?? 82800), 10) - 60;
    const valid_until = new Date(Date.now() + expireIn * 1000);

    return makeToken({
      username, password, pin: pin ?? null,
      access_token: tokenData["accessToken"] as string,
      refresh_token: tokenData["refreshToken"] as string,
      valid_until,
    });
  }

  async sendOtp(otpRequest: OTPRequest, notifyType: OTP_NOTIFY_TYPE): Promise<void> {
    const deviceId = await this._getDeviceId();
    const headers = { ...this.API_HEADERS, "Deviceid": deviceId };
    let body: Record<string, unknown>;

    if (notifyType === OTP_NOTIFY_TYPE.EMAIL) {
      body = { otpMethod: "E", mfaApiCode: "0107", userAccount: otpRequest.email, userPhone: "", userInfoUuid: otpRequest.request_id };
    } else {
      body = { otpMethod: "S", mfaApiCode: "0107", userAccount: otpRequest.email, userPhone: otpRequest.sms, userInfoUuid: otpRequest.request_id };
    }

    const resp = await fetch(this.API_URL + "mfa/sendotp", {
      method: "POST", headers, body: JSON.stringify(body),
    });
    const data = await resp.json() as Record<string, unknown>;
    const header = data["responseHeader"] as Record<string, unknown>;
    if (header["responseCode"] !== 0) {
      const error = data["error"] as Record<string, unknown> | undefined;
      throw new APIError(`Failed to send OTP: ${error?.["errorDesc"]}`);
    }
    otpRequest.otp_key = (data["result"] as Record<string, unknown>)["otpKey"] as string;
  }

  async verifyOtpAndCompleteLogin(username: string, password: string, otpCode: string, otpRequest: OTPRequest, pin?: string | null): Promise<Token> {
    const deviceId = await this._getDeviceId();
    const headers = { ...this.API_HEADERS, "Deviceid": deviceId };

    const verifyResp = await fetch(this.API_URL + "mfa/validateotp", {
      method: "POST",
      headers,
      body: JSON.stringify({ otpNo: otpCode, userAccount: username, otpKey: otpRequest.otp_key, mfaApiCode: "0107" }),
    });
    const verifyData = await verifyResp.json() as Record<string, unknown>;
    const verifyHeader = verifyData["responseHeader"] as Record<string, unknown>;
    if (verifyHeader["responseCode"] !== 0) {
      const error = verifyData["error"] as Record<string, unknown> | undefined;
      throw new AuthenticationError(`OTP verification failed: ${error?.["errorDesc"]}`);
    }
    const verifyResult = verifyData["result"] as Record<string, unknown>;
    if (!verifyResult["verifiedOtp"]) throw new AuthenticationError("OTP verification failed");

    const otpValidationKey = verifyResult["otpValidationKey"] as string;

    const genResp = await fetch(this.API_URL + "mfa/genmfatkn", {
      method: "POST",
      headers,
      body: JSON.stringify({ userAccount: username, otpEmail: otpRequest.email, mfaApiCode: "0107", otpValidationKey, mfaYn: "Y" }),
    });
    const genData = await genResp.json() as Record<string, unknown>;
    const genHeader = genData["responseHeader"] as Record<string, unknown>;
    if (genHeader["responseCode"] !== 0) {
      const error = genData["error"] as Record<string, unknown> | undefined;
      throw new AuthenticationError(`Failed to generate token: ${error?.["errorDesc"]}`);
    }
    const tokenData = getChildValue(genData, "result.token") as Record<string, unknown>;
    const expireIn = parseInt(String(tokenData["expireIn"] ?? 82800), 10) - 60;
    return makeToken({
      username, password, pin: pin ?? null,
      access_token: tokenData["accessToken"] as string,
      refresh_token: tokenData["refreshToken"] as string,
      valid_until: new Date(Date.now() + expireIn * 1000),
    });
  }

  async getVehicles(token: Token): Promise<Vehicle[]> {
    const headers = { ...this.API_HEADERS, "accessToken": token.access_token! };
    const resp = await fetch(this.API_URL + "vhcllst", { method: "POST", headers });
    const data = await resp.json() as Record<string, unknown>;
    this._checkResponseForErrors(data);

    const result: Vehicle[] = [];
    for (const entry of (getChildValue(data, "result.vehicles") as Array<Record<string, unknown>>) ?? []) {
      let engine_type: string | null = null;
      if (entry["fuelKindCode"] === "G") engine_type = ENGINE_TYPES.ICE;
      else if (entry["fuelKindCode"] === "E") engine_type = ENGINE_TYPES.EV;
      else if (entry["fuelKindCode"] === "P") engine_type = ENGINE_TYPES.PHEV;
      result.push(makeVehicle({
        id: entry["vehicleId"] as string,
        name: entry["nickName"] as string,
        model: entry["modelName"] as string,
        year: parseInt(String(entry["modelYear"] ?? 1900), 10),
        VIN: entry["vin"] as string,
        engine_type,
      }));
    }
    return result;
  }

  async updateVehicleWithCachedState(token: Token, vehicle: Vehicle): Promise<void> {
    const state = await this._getCachedVehicleState(token, vehicle);
    this._updateVehiclePropertiesBase(vehicle, state);

    const service = await this._getNextService(token, vehicle);
    const currentOdo = getFloat(getChildValue(service, "currentOdometer"));

    if (vehicle.odometer_value === null || vehicle.odometer_value === undefined) {
      const loc = await this._getLocation(token, vehicle);
      if (loc) this._updateVehiclePropertiesLocation(vehicle, loc);
    } else if (currentOdo && vehicle.odometer_value < currentOdo) {
      const loc = await this._getLocation(token, vehicle);
      if (loc) this._updateVehiclePropertiesLocation(vehicle, loc);
    }

    this._updateVehiclePropertiesService(vehicle, service);

    if (vehicle.engine_type === ENGINE_TYPES.EV) {
      const charge = await this._getChargeLimits(token, vehicle);
      this._updateVehiclePropertiesCharge(vehicle, charge);
      await this._updateVehiclePropertiesTripDetails(token, vehicle);
    }
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const state = await this._getForcedVehicleState(token, vehicle);
    this._updateVehiclePropertiesBase(vehicle, state);

    const service = await this._getNextService(token, vehicle);
    const currentOdo = getFloat(getChildValue(service, "currentOdometer"));

    if (vehicle.odometer_value === null || vehicle.odometer_value === undefined) {
      const loc = await this._getLocation(token, vehicle);
      if (loc) this._updateVehiclePropertiesLocation(vehicle, loc);
    } else if (currentOdo && vehicle.odometer_value < currentOdo) {
      const loc = await this._getLocation(token, vehicle);
      if (loc) this._updateVehiclePropertiesLocation(vehicle, loc);
    }

    this._updateVehiclePropertiesService(vehicle, service);

    if (vehicle.engine_type === ENGINE_TYPES.EV) {
      const charge = await this._getChargeLimits(token, vehicle);
      this._updateVehiclePropertiesCharge(vehicle, charge);
      await this._updateVehiclePropertiesTripDetails(token, vehicle);
    }
  }

  private async _getCachedVehicleState(token: Token, vehicle: Vehicle): Promise<Record<string, unknown>> {
    const headers = { ...this.API_HEADERS, "accessToken": token.access_token!, "vehicleId": vehicle.id };
    const resp = await fetch(this.API_URL + "lstvhclsts", { method: "POST", headers });
    const data = await resp.json() as Record<string, unknown>;
    this._checkResponseForErrors(data);
    return { status: getChildValue(data, "result.status") };
  }

  private async _getForcedVehicleState(token: Token, vehicle: Vehicle): Promise<Record<string, unknown>> {
    const headers = { ...this.API_HEADERS, "accessToken": token.access_token!, "vehicleId": vehicle.id };
    const resp = await fetch(this.API_URL + "rltmvhclsts", { method: "POST", headers });
    const data = await resp.json() as Record<string, unknown>;
    this._checkResponseForErrors(data);
    return { status: getChildValue(data, "result.status") };
  }

  private async _getNextService(token: Token, vehicle: Vehicle): Promise<Record<string, unknown>> {
    const headers = { ...this.API_HEADERS, "accessToken": token.access_token!, "vehicleId": vehicle.id };
    const resp = await fetch(this.API_URL + "nxtsvc", { method: "POST", headers });
    const data = await resp.json() as Record<string, unknown>;
    this._checkResponseForErrors(data);
    return getChildValue(data, "result.maintenanceInfo") as Record<string, unknown> ?? {};
  }

  private async _getLocation(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    try {
      const headers = {
        ...this.API_HEADERS,
        "accessToken": token.access_token!,
        "vehicleId": vehicle.id,
        "from": "SPA",
        "Referer": `https://${this.BASE_URL}/remote/`,
      };
      const pAuth = await this._getPinToken(token, vehicle);
      const resp = await fetch(this.API_URL + "fndmcr", {
        method: "POST",
        headers: { ...headers, "pAuth": pAuth },
        body: JSON.stringify({ pin: token.pin }),
      });
      const data = await resp.json() as Record<string, unknown>;
      const header = data["responseHeader"] as Record<string, unknown>;
      if (header["responseCode"] !== 0) return null;
      return data["result"] as Record<string, unknown>;
    } catch { return null; }
  }

  private async _getPinToken(token: Token, vehicle: Vehicle): Promise<string> {
    const headers = { ...this.API_HEADERS, "accessToken": token.access_token!, "vehicleId": vehicle.id };
    const resp = await fetch(this.API_URL + "vrfypin", {
      method: "POST",
      headers,
      body: JSON.stringify({ pin: token.pin }),
    });
    const data = await resp.json() as Record<string, unknown>;
    return getChildValue(data, "result.pAuth") as string;
  }

  private async _getChargeLimits(token: Token, vehicle: Vehicle): Promise<Array<Record<string, unknown>>> {
    const headers = { ...this.API_HEADERS, "accessToken": token.access_token!, "vehicleId": vehicle.id };
    const resp = await fetch(this.API_URL + "evc/selsoc", { method: "POST", headers });
    const data = await resp.json() as Record<string, unknown>;
    this._checkResponseForErrors(data);
    return data["result"] as Array<Record<string, unknown>> ?? [];
  }

  private async _updateVehiclePropertiesTripDetails(token: Token, vehicle: Vehicle): Promise<void> {
    try {
      const headers = { ...this.API_HEADERS, "accessToken": token.access_token!, "vehicleId": vehicle.id };
      const resp = await fetch(this.API_URL + "alerts/maintenance/evTripDetails", { method: "POST", headers });
      if (!resp.ok) return;
      const data = await resp.json() as Record<string, unknown>;
      this._checkResponseForErrors(data);
      const tripDetails = getChildValue(data, "result.tripdetails") as Array<Record<string, unknown>> | undefined;
      if (!tripDetails) return;

      const tripStats: DailyDrivingStats[] = tripDetails.map(trip => ({
        date: new Date(String(trip["startdate"] ?? "")),
        total_consumed: getChildValue(trip, "totalused") as number | null,
        engine_consumption: getChildValue(trip, "drivetrain") as number | null,
        climate_consumption: getChildValue(trip, "climate") as number | null,
        onboard_electronics_consumption: getChildValue(trip, "accessories") as number | null,
        battery_care_consumption: getChildValue(trip, "batterycare") as number | null,
        regenerated_energy: getChildValue(trip, "regen") as number | null,
        distance: getChildValue(trip, "distance") as number | null,
        distance_unit: vehicle.odometer_unit,
      }));
      vehicle.daily_stats = tripStats;
    } catch { /* optional */ }
  }

  private _updateVehiclePropertiesBase(vehicle: Vehicle, state: Record<string, unknown>): void {
    vehicle.last_updated_at = parseIsoDatetime(getChildValue(state, "status.lastStatusDate") as string) ?? new Date();

    // Hex temp conversion
    const airTempRaw = getChildValue(state, "status.airTemp.value");
    const airTempUnit = getChildValue(state, "status.airTemp.unit");
    if (airTempRaw && String(airTempRaw) !== "OFF" && String(airTempRaw).endsWith("H")) {
      const tempIndex = getHexTempIntoIndex(String(airTempRaw));
      if (tempIndex !== null && airTempUnit === 0) {
        const tempRange = (vehicle.year ?? 0) >= KiaUvoApiCA.TEMP_MODEL_YEAR
          ? KiaUvoApiCA.TEMP_RANGE_C_NEW : KiaUvoApiCA.TEMP_RANGE_C_OLD;
        const statusObj = (state["status"] as Record<string, unknown>);
        const airTempObj = (statusObj["airTemp"] as Record<string, unknown>);
        airTempObj["value"] = tempRange[tempIndex];
      }
    }

    vehicle.total_driving_range_value = getChildValue(state, "status.evStatus.drvDistance.0.rangeByFuel.totalAvailableRange.value") as number | null;
    vehicle.total_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "status.evStatus.drvDistance.0.rangeByFuel.totalAvailableRange.unit") as number] ?? null;
    vehicle.car_battery_percentage = getChildValue(state, "status.battery.batSoc") as number | null;
    vehicle.engine_is_running = getChildValue(state, "status.engine") as boolean | null;
    vehicle.washer_fluid_warning_is_on = getChildValue(state, "status.washerFluidStatus") as boolean | null;
    vehicle.brake_fluid_warning_is_on = getChildValue(state, "status.breakOilStatus") as boolean | null;
    vehicle.tire_pressure_rear_left_warning_is_on = Boolean(getChildValue(state, "status.tirePressureLamp.tirePressureLampRL"));
    vehicle.tire_pressure_front_left_warning_is_on = Boolean(getChildValue(state, "status.tirePressureLamp.tirePressureLampFL"));
    vehicle.tire_pressure_front_right_warning_is_on = Boolean(getChildValue(state, "status.tirePressureLamp.tirePressureLampFR"));
    vehicle.tire_pressure_rear_right_warning_is_on = Boolean(getChildValue(state, "status.tirePressureLamp.tirePressureLampRR"));
    vehicle.tire_pressure_all_warning_is_on = Boolean(getChildValue(state, "status.tirePressureLamp.tirePressureLampAll"));
    vehicle.air_temperature_value = getChildValue(state, "status.airTemp.value") as number | null;
    vehicle.air_temperature_unit = TEMPERATURE_UNITS[0] ?? null;
    vehicle.defrost_is_on = getChildValue(state, "status.defrost") as boolean | null;
    vehicle.steering_wheel_heater_is_on = getChildValue(state, "status.steerWheelHeat") as boolean | null;
    vehicle.back_window_heater_is_on = getChildValue(state, "status.sideBackWindowHeat") as boolean | null;
    vehicle.side_mirror_heater_is_on = getChildValue(state, "status.sideMirrorHeat") as boolean | null;
    vehicle.front_left_seat_status = SEAT_STATUS[getChildValue(state, "status.seatHeaterVentState.flSeatHeatState") as number] ?? null;
    vehicle.front_right_seat_status = SEAT_STATUS[getChildValue(state, "status.seatHeaterVentState.frSeatHeatState") as number] ?? null;
    vehicle.rear_left_seat_status = SEAT_STATUS[getChildValue(state, "status.seatHeaterVentState.rlSeatHeatState") as number] ?? null;
    vehicle.rear_right_seat_status = SEAT_STATUS[getChildValue(state, "status.seatHeaterVentState.rrSeatHeatState") as number] ?? null;
    vehicle.is_locked = getChildValue(state, "status.doorLock") as boolean | null;
    vehicle.front_left_door_is_open = getChildValue(state, "status.doorOpen.frontLeft") as boolean | null;
    vehicle.front_right_door_is_open = getChildValue(state, "status.doorOpen.frontRight") as boolean | null;
    vehicle.back_left_door_is_open = getChildValue(state, "status.doorOpen.backLeft") as boolean | null;
    vehicle.back_right_door_is_open = getChildValue(state, "status.doorOpen.backRight") as boolean | null;
    vehicle.hood_is_open = getChildValue(state, "status.hoodOpen") as boolean | null;
    vehicle.trunk_is_open = getChildValue(state, "status.trunkOpen") as boolean | null;
    vehicle.sunroof_is_open = getChildValue(state, "status.sunroofOpen") as boolean | null;
    vehicle.front_left_window_is_open = getChildValue(state, "status.windowOpen.frontLeft") as boolean | null;
    vehicle.front_right_window_is_open = getChildValue(state, "status.windowOpen.frontRight") as boolean | null;
    vehicle.back_left_window_is_open = getChildValue(state, "status.windowOpen.backLeft") as boolean | null;
    vehicle.back_right_window_is_open = getChildValue(state, "status.windowOpen.backRight") as boolean | null;

    if (vehicle.engine_type !== ENGINE_TYPES.ICE) {
      vehicle.ev_battery_percentage = getChildValue(state, "status.evStatus.batteryStatus") as number | null;
      vehicle.ev_battery_is_charging = getChildValue(state, "status.evStatus.batteryCharge") as boolean | null;
      vehicle.ev_battery_is_plugged_in = getChildValue(state, "status.evStatus.batteryPlugin") as boolean | null;
      vehicle.ev_driving_range_value = getChildValue(state, "status.evStatus.drvDistance.0.rangeByFuel.evModeRange.value") as number | null;
      vehicle.ev_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "status.evStatus.drvDistance.0.rangeByFuel.evModeRange.unit") as number] ?? null;
      vehicle.ev_estimated_current_charge_duration_value = getChildValue(state, "status.evStatus.remainTime2.atc.value") as number | null;
      vehicle.ev_estimated_fast_charge_duration_value = getChildValue(state, "status.evStatus.remainTime2.etc1.value") as number | null;
      vehicle.ev_estimated_portable_charge_duration_value = getChildValue(state, "status.evStatus.remainTime2.etc2.value") as number | null;
      vehicle.ev_estimated_station_charge_duration_value = getChildValue(state, "status.evStatus.remainTime2.etc3.value") as number | null;
    }

    const gasModeRange = getChildValue(state, "status.evStatus.drvDistance.0.rangeByFuel.gasModeRange.value");
    if (gasModeRange) {
      vehicle.fuel_driving_range_value = gasModeRange as number;
      vehicle.fuel_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "status.evStatus.drvDistance.0.rangeByFuel.gasModeRange.unit") as number] ?? null;
    } else {
      vehicle.fuel_driving_range_value = getChildValue(state, "status.dte.value") as number | null;
      vehicle.fuel_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "status.dte.unit") as number] ?? null;
    }

    vehicle.fuel_level_is_low = getChildValue(state, "status.lowFuelLight") as boolean | null;
    vehicle.fuel_level = getChildValue(state, "status.fuelLevel") as number | null;
    vehicle.air_control_is_on = getChildValue(state, "status.airCtrlOn") as boolean | null;

    if (!vehicle.data) vehicle.data = {};
    (vehicle.data as Record<string, unknown>)["status"] = state["status"];
  }

  private _updateVehiclePropertiesService(vehicle: Vehicle, state: Record<string, unknown>): void {
    vehicle.odometer_value = getFloat(getChildValue(state, "currentOdometer"));
    vehicle.odometer_unit = DISTANCE_UNITS[getChildValue(state, "currentOdometerUnit") as number] ?? null;
    vehicle.next_service_distance_value = getFloat(getChildValue(state, "imatServiceOdometer"));
    vehicle.next_service_distance_unit = DISTANCE_UNITS[getChildValue(state, "imatServiceOdometerUnit") as number] ?? null;
    vehicle.last_service_distance_value = getFloat(getChildValue(state, "msopServiceOdometer"));
    vehicle.last_service_distance_unit = DISTANCE_UNITS[getChildValue(state, "msopServiceOdometerUnit") as number] ?? null;
    if (!vehicle.data) vehicle.data = {};
    (vehicle.data as Record<string, unknown>)["service"] = state;
  }

  private _updateVehiclePropertiesLocation(vehicle: Vehicle, state: Record<string, unknown>): void {
    if (getChildValue(state, "coord.lat")) {
      vehicle.location_latitude = getChildValue(state, "coord.lat") as number;
      vehicle.location_longitude = getChildValue(state, "coord.lon") as number;
      vehicle.location_last_updated_at = parseIsoDatetime(getChildValue(state, "time") as string);
    }
    if (!vehicle.data) vehicle.data = {};
    (vehicle.data as Record<string, unknown>)["vehicleLocation"] = state;
  }

  private _updateVehiclePropertiesCharge(vehicle: Vehicle, state: Array<Record<string, unknown>>): void {
    try {
      const acItems = state.filter(x => x["plugType"] === 1 && (x["level"] as number) <= 100);
      const dcItems = state.filter(x => x["plugType"] === 0 && (x["level"] as number) <= 100);
      if (acItems.length) vehicle.ev_charge_limits_ac = acItems[acItems.length - 1]["level"] as number;
      if (dcItems.length) vehicle.ev_charge_limits_dc = dcItems[dcItems.length - 1]["level"] as number;
    } catch { /* not an EV */ }
  }

  async checkActionStatus(token: Token, vehicle: Vehicle, actionId: string, synchronous = false, timeout = 0): Promise<ORDER_STATUS> {
    if (timeout < 0) return ORDER_STATUS.TIMEOUT;
    const headers = {
      ...this.API_HEADERS,
      "accessToken": token.access_token!,
      "vehicleId": vehicle.id,
      "transactionId": actionId,
      "pAuth": await this._getPinToken(token, vehicle),
    };
    const resp = await fetch(this.API_URL + "rmtsts", { method: "POST", headers });
    const data = await resp.json() as Record<string, unknown>;
    const header = data["responseHeader"] as Record<string, unknown>;
    if (header["responseCode"] === 1) return ORDER_STATUS.FAILED;
    const txResult = getChildValue(data, "result.transaction.apiResult") as string;
    if (txResult === "C") return ORDER_STATUS.SUCCESS;
    if (txResult === "P") {
      if (!synchronous) return ORDER_STATUS.PENDING;
      await new Promise(r => setTimeout(r, 10000));
      return this.checkActionStatus(token, vehicle, actionId, synchronous, timeout - 10);
    }
    return ORDER_STATUS.FAILED;
  }

  async lockAction(token: Token, vehicle: Vehicle, action: string): Promise<string> {
    const url = action === VEHICLE_LOCK_ACTION.LOCK ? this.API_URL + "drlck" : this.API_URL + "drulck";
    const pAuth = await this._getPinToken(token, vehicle);
    const headers = {
      ...this.API_HEADERS,
      "accessToken": token.access_token!,
      "vehicleId": vehicle.id,
      "pAuth": pAuth,
    };
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ pin: token.pin }) });
    return resp.headers.get("transactionId") ?? "";
  }

  async startClimate(token: Token, vehicle: Vehicle, options: ClimateRequestOptions): Promise<string> {
    const isEv = vehicle.engine_type === ENGINE_TYPES.EV;
    const url = isEv ? this.API_URL + "evc/rfon" : this.API_URL + "rmtstrt";
    const pAuth = await this._getPinToken(token, vehicle);
    const headers = {
      ...this.API_HEADERS,
      "accessToken": token.access_token!,
      "vehicleId": vehicle.id,
      "pAuth": pAuth,
    };

    options.climate ??= true;
    options.set_temp ??= 21;
    options.duration ??= 5;
    options.heating ??= 0;
    options.defrost ??= false;
    options.front_left_seat ??= 0;
    options.front_right_seat ??= 0;
    options.rear_left_seat ??= 0;
    options.rear_right_seat ??= 0;

    const tempRange = (vehicle.year ?? 0) >= KiaUvoApiCA.TEMP_MODEL_YEAR
      ? KiaUvoApiCA.TEMP_RANGE_C_NEW : KiaUvoApiCA.TEMP_RANGE_C_OLD;
    const tempIdx = tempRange.indexOf(options.set_temp);
    const hexSetTemp = getIndexIntoHexTemp(tempIdx >= 0 ? tempIdx : 0);

    const brandName = BRANDS[this.brand];
    const modelName = vehicle.model ?? "";

    let payload: Record<string, unknown>;
    if (isEv) {
      payload = { pin: token.pin };
      const climateSettings: Record<string, unknown> = {
        airCtrl: options.climate ? 1 : 0,
        defrost: options.defrost,
        heating1: options.heating,
        airTemp: { value: hexSetTemp, unit: 0, hvacTempType: 1 },
        igniOnDuration: options.duration,
        seatHeaterVentCMD: {
          drvSeatOptCmd: options.front_left_seat,
          astSeatOptCmd: options.front_right_seat,
          rlSeatOptCmd: options.rear_left_seat,
          rrSeatOptCmd: options.rear_right_seat,
        },
      };
      const usesRemoteControl = (brandName === BRAND_KIA && modelName === "EV9")
        || (brandName === BRAND_HYUNDAI && modelName === "IONIQ 9");
      payload[usesRemoteControl ? "remoteControl" : "hvacInfo"] = climateSettings;
    } else {
      payload = {
        setting: {
          airCtrl: options.climate ? 1 : 0,
          defrost: options.defrost,
          heating1: options.heating,
          igniOnDuration: options.duration,
          ims: 0,
          airTemp: { value: hexSetTemp, unit: 0, hvacTempType: 0 },
          seatHeaterVentCMD: {
            drvSeatOptCmd: options.front_left_seat,
            astSeatOptCmd: options.front_right_seat,
            rlSeatOptCmd: options.rear_left_seat,
            rrSeatOptCmd: options.rear_right_seat,
          },
        },
        pin: token.pin,
      };
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    return resp.headers.get("transactionId") ?? "";
  }

  async stopClimate(token: Token, vehicle: Vehicle): Promise<string> {
    const isEv = vehicle.engine_type === ENGINE_TYPES.EV;
    const url = isEv ? this.API_URL + "evc/rfoff" : this.API_URL + "rmtstp";
    const pAuth = await this._getPinToken(token, vehicle);
    const headers = {
      ...this.API_HEADERS,
      "accessToken": token.access_token!,
      "vehicleId": vehicle.id,
      "pAuth": pAuth,
    };
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ pin: token.pin }) });
    return resp.headers.get("transactionId") ?? "";
  }

  async startCharge(token: Token, vehicle: Vehicle): Promise<string> {
    const pAuth = await this._getPinToken(token, vehicle);
    const headers = {
      ...this.API_HEADERS,
      "accessToken": token.access_token!,
      "vehicleId": vehicle.id,
      "pAuth": pAuth,
    };
    const resp = await fetch(this.API_URL + "evc/rcstrt", {
      method: "POST", headers, body: JSON.stringify({ pin: token.pin }),
    });
    return resp.headers.get("transactionId") ?? "";
  }

  async stopCharge(token: Token, vehicle: Vehicle): Promise<string> {
    const pAuth = await this._getPinToken(token, vehicle);
    const headers = {
      ...this.API_HEADERS,
      "accessToken": token.access_token!,
      "vehicleId": vehicle.id,
      "pAuth": pAuth,
    };
    const resp = await fetch(this.API_URL + "evc/rcstp", {
      method: "POST", headers, body: JSON.stringify({ pin: token.pin }),
    });
    return resp.headers.get("transactionId") ?? "";
  }

  async setChargeLimits(token: Token, vehicle: Vehicle, ac: number, dc: number): Promise<string> {
    const pAuth = await this._getPinToken(token, vehicle);
    const headers = {
      ...this.API_HEADERS,
      "accessToken": token.access_token!,
      "vehicleId": vehicle.id,
      "pAuth": pAuth,
      "from": "SPA",
      "Referer": `https://${this.BASE_URL}/remote/`,
    };
    const payload = {
      tsoc: [
        { plugType: 0, level: dc },
        { plugType: 1, level: ac },
      ],
      pin: token.pin,
    };
    const resp = await fetch(this.API_URL + "evc/setsoc", {
      method: "POST", headers, body: JSON.stringify(payload),
    });
    return resp.headers.get("transactionId") ?? "";
  }
}
