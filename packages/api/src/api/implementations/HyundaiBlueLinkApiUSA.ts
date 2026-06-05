import { ApiImpl } from "../ApiImpl.js";
import { Token, makeToken } from "../../types/Token.js";
import { Vehicle, makeVehicle, DailyDrivingStats, TripInfo, MonthTripInfo, DayTripCounts, DayTripInfo } from "../../types/Vehicle.js";
import { ClimateRequestOptions } from "../../types/requests.js";
import { DISTANCE_UNITS, ENGINE_TYPES, ORDER_STATUS, SEAT_STATUS, TEMPERATURE_UNITS, VEHICLE_LOCK_ACTION } from "../../constants/index.js";
import { APIError, AuthenticationError } from "../../exceptions/index.js";
import { getChildValue, getFloat, parseIsoDatetime } from "../../utils/index.js";

function checkResponseForErrors(response: Record<string, unknown>): void {
  if ("errorCode" in response) {
    const code = String(response["errorCode"]);
    const msg = String(response["errorMessage"] ?? "");
    if (code === "502") throw new AuthenticationError(msg);
    throw new APIError(`API Error ${code}: ${msg}`);
  }
}

async function safeParseJson(resp: Response, actionName: string): Promise<Record<string, unknown> | null> {
  if (!resp.ok) throw new APIError(`${actionName} failed with HTTP ${resp.status}`);
  const text = await resp.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as Record<string, unknown>;
}

export class HyundaiBlueLinkApiUSA extends ApiImpl {
  temperature_range: number[] = Array.from({ length: 20 }, (_, i) => i + 62);

  private BASE_URL = "api.telematics.hyundaiusa.com";
  private LOGIN_API: string;
  private API_URL: string;
  private API_HEADERS: Record<string, string>;

  constructor(region: number, brand: number, language: string) {
    super();
    this.LOGIN_API = `https://${this.BASE_URL}/v2/ac/`;
    this.API_URL = `https://${this.BASE_URL}/ac/v2/`;

    const utcOffsetHours = -Math.round(new Date().getTimezoneOffset() / 60);

    this.API_HEADERS = {
      "content-type": "application/json;charset=UTF-8",
      "accept": "application/json, text/plain, */*",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36",
      "host": this.BASE_URL,
      "origin": `https://${this.BASE_URL}`,
      "referer": `https://${this.BASE_URL}/login`,
      "from": "SPA",
      "to": "ISS",
      "language": "0",
      "offset": String(utcOffsetHours),
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "refresh": "false",
      "encryptFlag": "false",
      "brandIndicator": "H",
      "client_id": "m66129Bb-em93-SPAHYN-bZ91-am4540zp19920",
      "clientSecret": "v558o935-6nne-423i-baa8",
    };
  }

  private _getAuthenticatedHeaders(token: Token): Record<string, string> {
    return {
      ...this.API_HEADERS,
      "username": token.username,
      "accessToken": token.access_token!,
      "blueLinkServicePin": token.pin ?? "",
    };
  }

  private _getVehicleHeaders(token: Token, vehicle: Vehicle): Record<string, string> {
    return {
      ...this._getAuthenticatedHeaders(token),
      "registrationId": vehicle.id,
      "gen": String(vehicle.generation ?? 2),
      "vin": vehicle.VIN ?? "",
    };
  }

  private _getTransactionId(resp: Response): string {
    for (const key of ["tmsTid", "transactionId", "Xid"]) {
      const val = resp.headers.get(key);
      if (val) return val;
    }
    return "";
  }

  async login(username: string, password: string, pin?: string | null): Promise<Token> {
    const url = this.LOGIN_API + "oauth/token";
    const resp = await fetch(url, {
      method: "POST",
      headers: this.API_HEADERS,
      body: JSON.stringify({ username, password }),
    });
    const data = await resp.json() as Record<string, unknown>;
    checkResponseForErrors(data);
    if (!data["access_token"]) {
      throw new APIError(`Login failed: ${data["errorMessage"] ?? "unknown error"}`);
    }
    const expiresIn = parseFloat(String(data["expires_in"] ?? 82800));
    const valid_until = new Date(Date.now() + expiresIn * 1000);
    return makeToken({
      username, password, pin: pin ?? null,
      access_token: data["access_token"] as string,
      refresh_token: data["refresh_token"] as string,
      valid_until,
    });
  }

  async getVehicles(token: Token): Promise<Vehicle[]> {
    const url = this.API_URL + "enrollment/details/" + token.username;
    const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
    const data = await resp.json() as Record<string, unknown>;
    checkResponseForErrors(data);
    if (!("enrolledVehicleDetails" in data)) throw new AuthenticationError("Missing enrolledVehicleDetails");

    const result: Vehicle[] = [];
    for (const entry of data["enrolledVehicleDetails"] as Array<Record<string, unknown>>) {
      const details = entry["vehicleDetails"] as Record<string, unknown>;
      let engine_type: string | null = null;
      if (details["evStatus"] === "N") engine_type = ENGINE_TYPES.ICE;
      else if (details["evStatus"] === "E") engine_type = ENGINE_TYPES.EV;
      result.push(makeVehicle({
        id: details["regid"] as string,
        name: details["nickName"] as string,
        VIN: details["vin"] as string,
        engine_type,
        model: details["modelCode"] as string,
        registration_date: details["enrollmentDate"] as string,
        enabled: details["enrollmentStatus"] !== "CANCELLED",
        generation: parseInt(String(details["vehicleGeneration"] ?? "2"), 10),
      }));
    }
    return result;
  }

  async updateVehicleWithCachedState(token: Token, vehicle: Vehicle): Promise<void> {
    const state: Record<string, unknown> = {};
    state["vehicleDetails"] = await this._getVehicleDetails(token, vehicle);
    state["vehicleStatus"] = await this._getVehicleStatus(token, vehicle, false);
    state["evTripDetails"] = await this._getEvTripDetails(token, vehicle);

    if (state["vehicleStatus"]) {
      const vs = state["vehicleStatus"] as Record<string, unknown>;
      const newOdometer = getFloat(getChildValue(state["vehicleDetails"], "odometer"));
      if (vehicle.odometer_value === null || vehicle.odometer_value === undefined) {
        const loc = await this._getVehicleLocation(token, vehicle);
        if (loc) vs["vehicleLocation"] = loc;
      } else if (newOdometer && vehicle.odometer_value < newOdometer) {
        const loc = await this._getVehicleLocation(token, vehicle);
        if (loc) vs["vehicleLocation"] = loc;
      }
    }
    this._updateVehicleProperties(vehicle, state);
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    const state: Record<string, unknown> = {};
    state["vehicleDetails"] = await this._getVehicleDetails(token, vehicle);
    state["vehicleStatus"] = await this._getVehicleStatus(token, vehicle, true);
    state["evTripDetails"] = await this._getEvTripDetails(token, vehicle);

    if (state["vehicleStatus"]) {
      const loc = await this._getVehicleLocation(token, vehicle);
      if (loc) (state["vehicleStatus"] as Record<string, unknown>)["vehicleLocation"] = loc;
    }
    this._updateVehicleProperties(vehicle, state);
  }

  private async _getVehicleDetails(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    const url = this.API_URL + "enrollment/details/" + token.username;
    const resp = await fetch(url, { headers: this._getAuthenticatedHeaders(token) });
    const data = await resp.json() as Record<string, unknown>;
    checkResponseForErrors(data);
    for (const entry of (data["enrolledVehicleDetails"] as Array<Record<string, unknown>>) ?? []) {
      const details = entry["vehicleDetails"] as Record<string, unknown>;
      if (details["regid"] === vehicle.id) return details;
    }
    return null;
  }

  private async _getVehicleStatus(token: Token, vehicle: Vehicle, refresh: boolean): Promise<Record<string, unknown> | null> {
    const url = this.API_URL + "rcs/rvs/vehicleStatus";
    const headers = this._getVehicleHeaders(token, vehicle);
    if (refresh) headers["REFRESH"] = "true";
    const resp = await fetch(url, { headers });
    const data = await resp.json() as Record<string, unknown>;
    checkResponseForErrors(data);
    const status = { ...(data["vehicleStatus"] as Record<string, unknown>) };
    if (status["dateTime"]) {
      status["dateTime"] = String(status["dateTime"])
        .replace(/-/g, "").replace(/T/g, "").replace(/:/g, "").replace(/Z/g, "");
    }
    return status;
  }

  private async _getEvTripDetails(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    if (vehicle.engine_type !== ENGINE_TYPES.EV) return null;
    const url = this.API_URL + "ts/alerts/maintenance/evTripDetails";
    const headers = { ...this._getVehicleHeaders(token, vehicle), "userId": token.username };
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json() as Record<string, unknown>;
      checkResponseForErrors(data);
      return data;
    } catch { return null; }
  }

  private async _getVehicleLocation(token: Token, vehicle: Vehicle): Promise<Record<string, unknown> | null> {
    const url = this.API_URL + "rcs/rfc/findMyCar";
    try {
      const resp = await fetch(url, { headers: this._getVehicleHeaders(token, vehicle) });
      const data = await resp.json() as Record<string, unknown>;
      checkResponseForErrors(data);
      if (data["coord"]) return data;
    } catch { /* ignore */ }
    return null;
  }

  private _updateVehicleProperties(vehicle: Vehicle, state: Record<string, unknown>): void {
    vehicle.last_updated_at = parseIsoDatetime(getChildValue(state, "vehicleStatus.dateTime") as string) ?? new Date();

    vehicle.total_driving_range_value = getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.totalAvailableRange.value") as number | null;
    vehicle.total_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.totalAvailableRange.unit") as number] ?? null;

    const dteValue = getChildValue(state, "vehicleStatus.dte.value");
    if (dteValue) {
      vehicle.fuel_driving_range_value = dteValue as number;
      vehicle.fuel_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.dte.unit") as number] ?? null;
    }

    vehicle.odometer_value = getFloat(getChildValue(state, "vehicleDetails.odometer"));
    vehicle.odometer_unit = DISTANCE_UNITS[3] ?? null;
    vehicle.car_battery_percentage = getChildValue(state, "vehicleStatus.battery.batSoc") as number | null;
    vehicle.engine_is_running = getChildValue(state, "vehicleStatus.engine") as boolean | null;
    vehicle.washer_fluid_warning_is_on = getChildValue(state, "vehicleStatus.washerFluidStatus") as boolean | null;
    vehicle.brake_fluid_warning_is_on = getChildValue(state, "vehicleStatus.breakOilStatus") as boolean | null;
    vehicle.smart_key_battery_warning_is_on = getChildValue(state, "vehicleStatus.smartKeyBatteryWarning") as boolean | null;

    let airTemp = getChildValue(state, "vehicleStatus.airTemp.value");
    if (airTemp === "LO") airTemp = this.temperature_range[0];
    if (airTemp === "HI") airTemp = this.temperature_range[this.temperature_range.length - 1];
    if (airTemp) {
      vehicle.air_temperature_value = airTemp as number;
      vehicle.air_temperature_unit = TEMPERATURE_UNITS[1] ?? null;
    }

    vehicle.defrost_is_on = getChildValue(state, "vehicleStatus.defrost") as boolean | null;
    vehicle.steering_wheel_heater_is_on = getChildValue(state, "vehicleStatus.steerWheelHeat") as boolean | null;
    vehicle.back_window_heater_is_on = getChildValue(state, "vehicleStatus.sideBackWindowHeat") as boolean | null;
    vehicle.side_mirror_heater_is_on = getChildValue(state, "vehicleStatus.sideMirrorHeat") as boolean | null;
    vehicle.front_left_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.flSeatHeatState") as number] ?? null;
    vehicle.front_right_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.frSeatHeatState") as number] ?? null;
    vehicle.rear_left_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.rlSeatHeatState") as number] ?? null;
    vehicle.rear_right_seat_status = SEAT_STATUS[getChildValue(state, "vehicleStatus.seatHeaterVentState.rrSeatHeatState") as number] ?? null;

    vehicle.tire_pressure_rear_left_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureWarningLampRearLeft"));
    vehicle.tire_pressure_front_left_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureWarningLampFrontLeft"));
    vehicle.tire_pressure_front_right_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureWarningLampFrontRight"));
    vehicle.tire_pressure_rear_right_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureWarningLampRearRight"));
    vehicle.tire_pressure_all_warning_is_on = Boolean(getChildValue(state, "vehicleStatus.tirePressureLamp.tirePressureWarningLampAll"));

    vehicle.front_left_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.frontLeft") as boolean | null;
    vehicle.front_right_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.frontRight") as boolean | null;
    vehicle.back_left_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.backLeft") as boolean | null;
    vehicle.back_right_window_is_open = getChildValue(state, "vehicleStatus.windowOpen.backRight") as boolean | null;

    vehicle.is_locked = getChildValue(state, "vehicleStatus.doorLock") as boolean | null;
    vehicle.front_left_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.frontLeft") as boolean | null;
    vehicle.front_right_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.frontRight") as boolean | null;
    vehicle.back_left_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.backLeft") as boolean | null;
    vehicle.back_right_door_is_open = getChildValue(state, "vehicleStatus.doorOpen.backRight") as boolean | null;
    vehicle.hood_is_open = getChildValue(state, "vehicleStatus.hoodOpen") as boolean | null;
    vehicle.trunk_is_open = getChildValue(state, "vehicleStatus.trunkOpen") as boolean | null;

    vehicle.ev_battery_percentage = getChildValue(state, "vehicleStatus.evStatus.batteryStatus") as number | null;
    vehicle.ev_battery_is_charging = getChildValue(state, "vehicleStatus.evStatus.batteryCharge") as boolean | null;
    vehicle.ev_battery_is_plugged_in = getChildValue(state, "vehicleStatus.evStatus.batteryPlugin") as boolean | null;
    vehicle.ev_charging_power = getChildValue(state, "vehicleStatus.evStatus.batteryStndChrgPower") as number | null;

    try {
      const chargeDict = getChildValue(state, "vehicleStatus.evStatus.reservChargeInfos.targetSOClist") as Array<Record<string, unknown>> | null;
      if (chargeDict) {
        const acItems = chargeDict.filter(x => x["plugType"] === 1);
        const dcItems = chargeDict.filter(x => x["plugType"] === 0);
        if (acItems.length) vehicle.ev_charge_limits_ac = acItems[acItems.length - 1]["targetSOClevel"] as number;
        if (dcItems.length) vehicle.ev_charge_limits_dc = dcItems[dcItems.length - 1]["targetSOClevel"] as number;
      }
    } catch { /* not an EV */ }

    vehicle.ev_driving_range_value = getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.evModeRange.value") as number | null;
    vehicle.ev_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.evModeRange.unit") as number] ?? null;
    vehicle.ev_estimated_current_charge_duration_value = getChildValue(state, "vehicleStatus.evStatus.remainTime2.atc.value") as number | null;
    vehicle.ev_estimated_fast_charge_duration_value = getChildValue(state, "vehicleStatus.evStatus.remainTime2.etc1.value") as number | null;
    vehicle.ev_estimated_portable_charge_duration_value = getChildValue(state, "vehicleStatus.evStatus.remainTime2.etc2.value") as number | null;
    vehicle.ev_estimated_station_charge_duration_value = getChildValue(state, "vehicleStatus.evStatus.remainTime2.etc3.value") as number | null;

    const gasModeRange = getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.gasModeRange.value");
    if (gasModeRange) {
      vehicle.fuel_driving_range_value = gasModeRange as number;
      vehicle.fuel_driving_range_unit = DISTANCE_UNITS[getChildValue(state, "vehicleStatus.evStatus.drvDistance.0.rangeByFuel.gasModeRange.unit") as number] ?? null;
    }

    vehicle.fuel_level_is_low = getChildValue(state, "vehicleStatus.lowFuelLight") as boolean | null;
    vehicle.fuel_level = getChildValue(state, "vehicleStatus.fuelLevel") as number | null;

    if (getChildValue(state, "vehicleStatus.vehicleLocation.coord.lat")) {
      vehicle.location_latitude = getChildValue(state, "vehicleStatus.vehicleLocation.coord.lat") as number;
      vehicle.location_longitude = getChildValue(state, "vehicleStatus.vehicleLocation.coord.lon") as number;
      vehicle.location_last_updated_at = parseIsoDatetime(getChildValue(state, "vehicleStatus.vehicleLocation.time") as string);
    }

    vehicle.air_control_is_on = getChildValue(state, "vehicleStatus.airCtrlOn") as boolean | null;

    // Process EV trip details
    const tripDetails = (getChildValue(state, "evTripDetails.tripdetails") as Array<Record<string, unknown>>) ?? [];
    const tripStats: DailyDrivingStats[] = [];
    const trips: TripInfo[] = [];

    let previousOdometer: number | null = null;
    for (let i = tripDetails.length - 1; i >= 0; i--) {
      const trip = tripDetails[i];
      const odo = getFloat(getChildValue(trip, "odometer.value"));
      if (previousOdometer !== null && odo !== null) {
        const delta = odo - previousOdometer;
        if (delta >= 0) trip["distance"] = delta;
      }
      previousOdometer = odo;
    }

    if (previousOdometer !== null && vehicle.odometer_value !== null && previousOdometer > (vehicle.odometer_value ?? 0)) {
      vehicle.odometer_value = previousOdometer;
    }

    for (const trip of tripDetails) {
      const dateStr = String(trip["startdate"] ?? "");
      tripStats.push({
        date: new Date(dateStr),
        total_consumed: getChildValue(trip, "totalused") as number | null,
        engine_consumption: getChildValue(trip, "drivetrain") as number | null,
        climate_consumption: getChildValue(trip, "climate") as number | null,
        onboard_electronics_consumption: getChildValue(trip, "accessories") as number | null,
        battery_care_consumption: getChildValue(trip, "batterycare") as number | null,
        regenerated_energy: getChildValue(trip, "regen") as number | null,
        distance: getChildValue(trip, "distance") as number | null,
        distance_unit: vehicle.odometer_unit,
      });

      const driveTimeSec = parseInt(String(getChildValue(trip["mileagetime"] as Record<string, unknown>, "value") ?? 0), 10);
      const totalTimeSec = parseInt(String(getChildValue(trip["duration"] as Record<string, unknown>, "value") ?? 0), 10);
      trips.push({
        hhmmss: dateStr,
        drive_time: Math.floor(driveTimeSec / 60),
        idle_time: Math.floor((totalTimeSec - driveTimeSec) / 60),
        distance: parseFloat(String(trip["distance"] ?? 0)),
        avg_speed: getFloat(getChildValue(trip["avgspeed"] as Record<string, unknown>, "value")),
        max_speed: parseInt(String(getChildValue(trip["maxspeed"] as Record<string, unknown>, "value") ?? 0), 10),
      });
    }

    vehicle.daily_stats = tripStats;
    if (trips.length > 0) {
      if (!vehicle.data) vehicle.data = {};
      (vehicle.data as Record<string, unknown>)["filled_trips"] = trips;
    }
    vehicle.data = state;
  }

  async updateMonthTripInfo(token: Token, vehicle: Vehicle, yyyymmString: string): Promise<void> {
    vehicle.month_trip_info = null;
    const trips = vehicle.data && (vehicle.data as Record<string, unknown>)["filled_trips"] as TripInfo[] | undefined;
    if (!trips?.length) return;

    let info: MonthTripInfo | null = null;
    let count = 0;

    for (const trip of trips) {
      const dateStr = trip.hhmmss ?? "";
      const yyyymm = dateStr.slice(0, 4) + dateStr.slice(5, 7);
      if (yyyymm !== yyyymmString) continue;

      if (count === 0) {
        info = { yyyymm: yyyymmString, summary: { ...trip }, day_list: [] };
        count = 1;
      } else {
        count++;
        info!.summary.drive_time = (info!.summary.drive_time ?? 0) + (trip.drive_time ?? 0);
        info!.summary.idle_time = (info!.summary.idle_time ?? 0) + (trip.idle_time ?? 0);
        info!.summary.distance = (info!.summary.distance ?? 0) + (trip.distance ?? 0);
        info!.summary.avg_speed = (info!.summary.avg_speed ?? 0) + (trip.avg_speed ?? 0);
        info!.summary.max_speed = Math.max(info!.summary.max_speed ?? 0, trip.max_speed ?? 0);
      }
      info!.summary.avg_speed = Math.round(((info!.summary.avg_speed ?? 0) / count) * 10) / 10;

      const yyyymmdd = yyyymm + dateStr.slice(8, 10);
      const existing = info!.day_list.find(d => d.yyyymmdd === yyyymmdd);
      if (existing) existing.trip_count++;
      else info!.day_list.push({ yyyymmdd, trip_count: 1 });
    }

    vehicle.month_trip_info = info;
  }

  async updateDayTripInfo(token: Token, vehicle: Vehicle, yyyymmddString: string): Promise<void> {
    vehicle.day_trip_info = null;
    const trips = vehicle.data && (vehicle.data as Record<string, unknown>)["filled_trips"] as TripInfo[] | undefined;
    if (!trips?.length) return;

    let info: DayTripInfo | null = null;
    let count = 0;

    for (const trip of trips) {
      const dateStr = trip.hhmmss ?? "";
      const yyyymmdd = dateStr.slice(0, 4) + dateStr.slice(5, 7) + dateStr.slice(8, 10);
      if (yyyymmdd !== yyyymmddString) continue;

      if (count === 0) {
        info = { yyyymmdd: yyyymmddString, summary: { ...trip }, trip_list: [] };
        count = 1;
      } else {
        count++;
        info!.summary.drive_time = (info!.summary.drive_time ?? 0) + (trip.drive_time ?? 0);
        info!.summary.idle_time = (info!.summary.idle_time ?? 0) + (trip.idle_time ?? 0);
        info!.summary.distance = (info!.summary.distance ?? 0) + (trip.distance ?? 0);
        info!.summary.avg_speed = (info!.summary.avg_speed ?? 0) + (trip.avg_speed ?? 0);
        info!.summary.max_speed = Math.max(info!.summary.max_speed ?? 0, trip.max_speed ?? 0);
      }
      info!.summary.avg_speed = Math.round(((info!.summary.avg_speed ?? 0) / count) * 10) / 10;

      const hhmmss = dateStr.slice(11, 13) + dateStr.slice(14, 16) + dateStr.slice(17, 19);
      info!.trip_list.push({ ...trip, hhmmss });
    }

    vehicle.day_trip_info = info;
  }

  async checkActionStatus(token: Token, vehicle: Vehicle, actionId: string, synchronous = false, timeout = 120): Promise<ORDER_STATUS> {
    const url = this.API_URL + "rmt/getRunningStatus";
    const headers = {
      ...this._getVehicleHeaders(token, vehicle),
      "tid": actionId,
      "login_id": token.username,
      "service_type": "REMOTE_POLL",
    };

    const maxAttempts = synchronous ? Math.max(1, Math.floor(timeout / 2)) : 1;
    for (let i = 0; i < maxAttempts; i++) {
      const resp = await fetch(url, { method: "POST", headers });
      const data = await safeParseJson(resp, "checkActionStatus");
      if (data === null) {
        if (!synchronous) return ORDER_STATUS.UNKNOWN;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const status = String(data["status"] ?? "");
      if (status === "SUCCESS") return ORDER_STATUS.SUCCESS;
      if (status === "ERROR") return ORDER_STATUS.FAILED;
      if (synchronous) await new Promise(r => setTimeout(r, 2000));
    }
    return synchronous ? ORDER_STATUS.TIMEOUT : ORDER_STATUS.PENDING;
  }

  async lockAction(token: Token, vehicle: Vehicle, action: string): Promise<string> {
    const url = action === VEHICLE_LOCK_ACTION.LOCK
      ? this.API_URL + "rcs/rdo/off"
      : this.API_URL + "rcs/rdo/on";
    const headers = {
      ...this._getVehicleHeaders(token, vehicle),
      "APPCLOUD-VIN": vehicle.VIN ?? "",
    };
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ userName: token.username, vin: vehicle.VIN }),
    });
    const data = await safeParseJson(resp, "lockAction");
    if (data) checkResponseForErrors(data);
    return this._getTransactionId(resp);
  }

  async startClimate(token: Token, vehicle: Vehicle, options: ClimateRequestOptions): Promise<string> {
    const isEv = vehicle.engine_type === ENGINE_TYPES.EV;
    const url = isEv ? this.API_URL + "evc/fatc/start" : this.API_URL + "rcs/rsc/start";
    const headers = this._getVehicleHeaders(token, vehicle);

    options.climate ??= true;
    options.set_temp ??= 70;
    options.duration ??= 5;
    options.heating ??= 0;
    options.defrost ??= false;
    options.front_left_seat ??= 0;
    options.front_right_seat ??= 0;
    options.rear_left_seat ??= 0;
    options.rear_right_seat ??= 0;

    let data: Record<string, unknown>;
    if (isEv) {
      data = {
        airCtrl: options.climate ? 1 : 0,
        airTemp: { value: String(options.set_temp), unit: 1 },
        defrost: options.defrost,
        heating1: options.heating,
      };
      if ((vehicle.generation ?? 2) === 3) {
        data["igniOnDuration"] = options.duration;
        data["seatHeaterVentInfo"] = {
          drvSeatHeatState: options.front_left_seat,
          astSeatHeatState: options.front_right_seat,
          rlSeatHeatState: options.rear_left_seat,
          rrSeatHeatState: options.rear_right_seat,
        };
      }
    } else {
      data = {
        Ims: 0,
        airCtrl: options.climate ? 1 : 0,
        airTemp: { unit: 1, value: options.set_temp },
        defrost: options.defrost,
        heating1: options.heating,
        igniOnDuration: options.duration,
        seatHeaterVentInfo: {
          drvSeatHeatState: options.front_left_seat,
          astSeatHeatState: options.front_right_seat,
          rlSeatHeatState: options.rear_left_seat,
          rrSeatHeatState: options.rear_right_seat,
        },
        username: token.username,
        vin: vehicle.id,
      };
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
    const responseData = await safeParseJson(resp, "startClimate");
    if (responseData) checkResponseForErrors(responseData);
    return this._getTransactionId(resp);
  }

  async stopClimate(token: Token, vehicle: Vehicle): Promise<string> {
    const isEv = vehicle.engine_type === ENGINE_TYPES.EV;
    const url = isEv ? this.API_URL + "evc/fatc/stop" : this.API_URL + "rcs/rsc/stop";
    const resp = await fetch(url, { method: "POST", headers: this._getVehicleHeaders(token, vehicle) });
    const data = await safeParseJson(resp, "stopClimate");
    if (data) checkResponseForErrors(data);
    return this._getTransactionId(resp);
  }

  async startCharge(token: Token, vehicle: Vehicle): Promise<string> {
    if (vehicle.engine_type !== ENGINE_TYPES.EV) return "";
    const url = this.API_URL + "evc/charge/start";
    const resp = await fetch(url, { method: "POST", headers: this._getVehicleHeaders(token, vehicle) });
    const data = await safeParseJson(resp, "startCharge");
    if (data) checkResponseForErrors(data);
    return this._getTransactionId(resp);
  }

  async stopCharge(token: Token, vehicle: Vehicle): Promise<string> {
    if (vehicle.engine_type !== ENGINE_TYPES.EV) return "";
    const url = this.API_URL + "evc/charge/stop";
    const resp = await fetch(url, { method: "POST", headers: this._getVehicleHeaders(token, vehicle) });
    const data = await safeParseJson(resp, "stopCharge");
    if (data) checkResponseForErrors(data);
    return this._getTransactionId(resp);
  }

  async setChargeLimits(token: Token, vehicle: Vehicle, ac: number, dc: number): Promise<string> {
    if (vehicle.engine_type !== ENGINE_TYPES.EV) return "";
    const url = this.API_URL + "evc/charge/targetsoc/set";
    const body = JSON.stringify({
      targetSOClist: [
        { plugType: 0, targetSOClevel: Math.round(dc) },
        { plugType: 1, targetSOClevel: Math.round(ac) },
      ],
    });
    const resp = await fetch(url, { method: "POST", headers: this._getVehicleHeaders(token, vehicle), body });
    const data = await safeParseJson(resp, "setChargeLimits");
    if (data) checkResponseForErrors(data);
    return this._getTransactionId(resp);
  }
}
