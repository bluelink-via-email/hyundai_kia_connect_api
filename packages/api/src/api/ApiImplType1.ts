import { ApiImpl } from "./ApiImpl.js";
import { Token } from "../types/Token.js";
import { Vehicle, makeVehicle, DailyDrivingStats, MonthTripInfo, DayTripInfo, TripInfo, DayTripCounts } from "../types/Vehicle.js";
import {
  ClimateRequestOptions,
  ScheduleChargingClimateRequestOptions,
  WindowRequestOptions,
  POIInfo,
  poiInfoToDict,
} from "../types/requests.js";
import {
  DISTANCE_UNITS,
  ENGINE_TYPES,
  ORDER_STATUS,
  SEAT_STATUS,
  TEMPERATURE_UNITS,
  VEHICLE_LOCK_ACTION,
  CHARGE_PORT_ACTION,
  VALET_MODE_ACTION,
} from "../constants/index.js";
import {
  APIError,
  AuthenticationError,
  DeviceIDError,
  DuplicateRequestError,
  InvalidAPIResponseError,
  NoDataFound,
  RateLimitingError,
  RequestTimeoutError,
  ServiceTemporaryUnavailable,
  UnsupportedControlError,
} from "../exceptions/index.js";
import {
  getChildValue,
  getHexTempIntoIndex,
  getIndexIntoHexTemp,
  getTimeFromString,
  parseIsoDatetime,
  sleep,
} from "../utils/index.js";

const USER_AGENT_OK_HTTP = "okhttp/3.12.0";

const ERROR_CODE_MAP: Record<string, new (msg?: string) => Error> = {
  "7501": AuthenticationError,
  "4002": DeviceIDError,
  "4004": DuplicateRequestError,
  "4005": UnsupportedControlError,
  "4081": RequestTimeoutError,
  "5031": ServiceTemporaryUnavailable,
  "5091": RateLimitingError,
  "5921": NoDataFound,
  "9999": RequestTimeoutError,
};

const ERROR_MESSAGE_MAP: Record<string, new (msg?: string) => Error> = {
  "Key not authorized: Token is expired": AuthenticationError,
  "Key not authorized: token has expired": AuthenticationError,
};

export function checkResponseForErrors(response: Record<string, unknown>): void {
  if (
    !("retCode" in response) &&
    !("resCode" in response) &&
    !("resMsg" in response) &&
    !("error" in response) &&
    !("access_token" in response)
  ) {
    throw new InvalidAPIResponseError("Unknown API response format");
  }

  if (response["retCode"] === "F") {
    const code = response["resCode"] as string;
    const msg = response["resMsg"] as string;
    if (ERROR_CODE_MAP[code]) throw new ERROR_CODE_MAP[code](msg);
    throw new APIError(`Server returned: '${code}' '${msg}'`);
  }

  if ("error" in response) {
    const reason = response["error"] as string;
    if (ERROR_MESSAGE_MAP[reason]) throw new ERROR_MESSAGE_MAP[reason](reason);
    throw new APIError(`Unknown error in API response: ${reason}`);
  }

  if ("retCode" in response && "retMsg" in response) {
    if (response["retMsg"] === "Received unexpected statusCode") {
      throw new AuthenticationError(response["retMsg"] as string);
    }
  }
}

export abstract class ApiImplType1 extends ApiImpl {
  supportsWindowControl = true;

  abstract SPA_API_URL: string;
  abstract SPA_API_URL_V2: string;
  abstract USER_API_URL: string;
  abstract BASE_URL: string;
  abstract CCSP_SERVICE_ID: string;
  abstract APP_ID: string;
  abstract BASIC_AUTHORIZATION: string;
  abstract CFB: Uint8Array;
  abstract LANGUAGE: string;
  abstract PUSH_TYPE: string;
  abstract temperature_range: number[];

  protected _getStamp(): string {
    const ts = Math.floor(Date.now() / 1000);
    const raw = new TextEncoder().encode(`${this.APP_ID}:${ts}`);
    const cfb = this.CFB;
    const result = new Uint8Array(Math.min(cfb.length, raw.length));
    for (let i = 0; i < result.length; i++) result[i] = cfb[i] ^ raw[i];
    return btoa(String.fromCharCode(...result));
  }

  protected async _getDeviceId(stamp: string): Promise<string> {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const registrationId = hex.slice(0, 64);
    const url = this.SPA_API_URL + "notifications/register";
    const payload = {
      pushRegId: registrationId,
      pushType: this.PUSH_TYPE,
      uuid: crypto.randomUUID(),
    };
    const headers: Record<string, string> = {
      "ccsp-service-id": this.CCSP_SERVICE_ID,
      "ccsp-application-id": this.APP_ID,
      Stamp: stamp,
      "Content-Type": "application/json;charset=UTF-8",
      Host: this.BASE_URL,
      Connection: "Keep-Alive",
      "Accept-Encoding": "gzip",
      "User-Agent": USER_AGENT_OK_HTTP,
    };
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    return (data["resMsg"] as Record<string, string>)["deviceId"];
  }

  protected _getAuthenticatedHeaders(
    token: Token,
    ccs2Support: number | null = null
  ): Record<string, string> {
    return {
      Authorization: token.access_token!,
      "ccsp-service-id": this.CCSP_SERVICE_ID,
      "ccsp-application-id": this.APP_ID,
      Stamp: this._getStamp(),
      "ccsp-device-id": token.device_id!,
      Host: this.BASE_URL,
      Connection: "Keep-Alive",
      "Accept-Encoding": "gzip",
      Ccuccs2protocolsupport: String(ccs2Support ?? 0),
      "User-Agent": USER_AGENT_OK_HTTP,
    };
  }

  protected async _getControlToken(token: Token): Promise<[string, number]> {
    const url = this.USER_API_URL + "pin?token=";
    const headers: Record<string, string> = {
      Authorization: token.access_token!,
      "Content-type": "application/json",
      Host: this.BASE_URL,
      "Accept-Encoding": "gzip",
      "User-Agent": USER_AGENT_OK_HTTP,
    };
    const resp = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ deviceId: token.device_id, pin: token.pin }),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    if (!data["controlToken"]) {
      throw new APIError("PIN verification failed, ensure PIN is entered correctly.");
    }
    const controlToken = "Bearer " + (data["controlToken"] as string);
    const expireAt = Math.floor(Date.now() / 1000) + (data["expiresTime"] as number);
    return [controlToken, expireAt];
  }

  protected async _getControlHeaders(
    token: Token,
    vehicle: Vehicle
  ): Promise<Record<string, string>> {
    const [controlToken] = await this._getControlToken(token);
    const auth = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);
    return {
      ...auth,
      Authorization: controlToken,
      AuthorizationCCSP: controlToken,
    };
  }

  async getVehicles(token: Token): Promise<Vehicle[]> {
    const url = this.SPA_API_URL + "vehicles";
    const resp = await fetch(url, {
      headers: this._getAuthenticatedHeaders(token),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    const result: Vehicle[] = [];
    const vehicles = (data["resMsg"] as Record<string, unknown[]>)["vehicles"] as Record<string, unknown>[];
    for (const entry of vehicles) {
      let engineType: ENGINE_TYPES | null = null;
      switch (entry["type"]) {
        case "GN": engineType = ENGINE_TYPES.ICE; break;
        case "EV": engineType = ENGINE_TYPES.EV; break;
        case "PHEV": case "PE": engineType = ENGINE_TYPES.PHEV; break;
        case "HV": engineType = ENGINE_TYPES.HEV; break;
      }
      result.push(
        makeVehicle({
          id: entry["vehicleId"] as string,
          name: entry["nickname"] as string,
          model: entry["vehicleName"] as string,
          registration_date: entry["regDate"] as string,
          VIN: entry["vin"] as string,
          engine_type: engineType,
          ccu_ccs2_protocol_support: entry["ccuCCS2ProtocolSupport"] as number,
        })
      );
    }
    return result;
  }

  protected _getTimeFromString(value: string | null, timesection: number): string | null {
    return getTimeFromString(value, timesection);
  }

  protected _updateVehiclePropertiesCcs2(vehicle: Vehicle, state: Record<string, unknown>): void {
    const dateStr = getChildValue(state, "Date") as string | null;
    vehicle.last_updated_at = dateStr ? parseIsoDatetime(dateStr) : new Date();

    const odo = getChildValue(state, "Drivetrain.Odometer");
    if (odo != null) {
      vehicle.odometer = getFloat(odo);
      vehicle.odometer_unit = DISTANCE_UNITS[1] ?? null;
    }

    vehicle.car_battery_percentage = getChildValue(state, "Electronics.Battery.Level") as number | null;
    vehicle.engine_is_running = getChildValue(state, "DrivingReady") as boolean | null;

    const airTemp = getChildValue(state, "Cabin.HVAC.Row1.Driver.Temperature.Value");
    if (airTemp != null && airTemp !== "OFF") {
      vehicle.air_temperature = parseFloat(airTemp as string);
      vehicle.air_temperature_unit = TEMPERATURE_UNITS[1] ?? null;
    }

    const outsideTemp = getChildValue(state, "Cabin.HVAC.OutsideTemperature.Value");
    const outsideTempUnit = getChildValue(state, "Cabin.HVAC.OutsideTemperature.Unit");
    if (outsideTemp != null && outsideTempUnit != null) {
      vehicle.outside_temperature = parseFloat(outsideTemp as string);
      vehicle.outside_temperature_unit = TEMPERATURE_UNITS[outsideTempUnit as number] ?? null;
    }

    const defrost = getChildValue(state, "Body.Windshield.Front.Defog.State") as number | null;
    if (defrost === 0 || defrost === 2) vehicle.defrost_is_on = false;
    else if (defrost === 1) vehicle.defrost_is_on = true;

    const steerHeat = getChildValue(state, "Cabin.SteeringWheel.Heat.State") as number | null;
    if (steerHeat === 0 || steerHeat === 2) vehicle.steering_wheel_heater_is_on = false;
    else if (steerHeat === 1) vehicle.steering_wheel_heater_is_on = true;

    const rearDefrost = getChildValue(state, "Body.Windshield.Rear.Defog.State") as number | null;
    if (rearDefrost === 0 || rearDefrost === 2) vehicle.back_window_heater_is_on = false;
    else if (rearDefrost === 1) vehicle.back_window_heater_is_on = true;

    vehicle.front_left_seat_status = SEAT_STATUS[getChildValue(state, "Cabin.Seat.Row1.Driver.Climate.State") as number] ?? null;
    vehicle.front_right_seat_status = SEAT_STATUS[getChildValue(state, "Cabin.Seat.Row1.Passenger.Climate.State") as number] ?? null;
    vehicle.rear_left_seat_status = SEAT_STATUS[getChildValue(state, "Cabin.Seat.Row2.Left.Climate.State") as number] ?? null;
    vehicle.rear_right_seat_status = SEAT_STATUS[getChildValue(state, "Cabin.Seat.Row2.Right.Climate.State") as number] ?? null;

    vehicle.headlamp_status = getChildValue(state, "Body.Lights.Front.HeadLamp.SystemWarning") as string | null;
    vehicle.headlamp_left_low = getChildValue(state, "Body.Lights.Front.Left.Low.Warning") as boolean | null;
    vehicle.headlamp_right_low = getChildValue(state, "Body.Lights.Front.Right.Low.Warning") as boolean | null;
    vehicle.headlamp_left_high = getChildValue(state, "Body.Lights.Front.Left.High.Warning") as boolean | null;
    vehicle.headlamp_right_high = getChildValue(state, "Body.Lights.Front.Right.High.Warning") as boolean | null;
    vehicle.stop_lamp_left = getChildValue(state, "Body.Lights.Rear.Left.StopLamp.Warning") as boolean | null;
    vehicle.stop_lamp_right = getChildValue(state, "Body.Lights.Rear.Right.StopLamp.Warning") as boolean | null;
    vehicle.turn_signal_left_front = getChildValue(state, "Body.Lights.Front.Left.TurnSignal.Warning") as boolean | null;
    vehicle.turn_signal_right_front = getChildValue(state, "Body.Lights.Front.Right.TurnSignal.Warning") as boolean | null;
    vehicle.turn_signal_left_rear = getChildValue(state, "Body.Lights.Rear.Left.TurnSignal.Warning") as boolean | null;
    vehicle.turn_signal_right_rear = getChildValue(state, "Body.Lights.Rear.Right.TurnSignal.Warning") as boolean | null;

    vehicle.front_left_door_is_open = getChildValue(state, "Cabin.Door.Row1.Driver.Open") as boolean | null;
    vehicle.front_right_door_is_open = getChildValue(state, "Cabin.Door.Row1.Passenger.Open") as boolean | null;
    vehicle.back_left_door_is_open = getChildValue(state, "Cabin.Door.Row2.Left.Open") as boolean | null;
    vehicle.back_right_door_is_open = getChildValue(state, "Cabin.Door.Row2.Right.Open") as boolean | null;

    const flLock = getChildValue(state, "Cabin.Door.Row1.Driver.Lock");
    vehicle.front_left_door_is_locked = flLock != null ? !Boolean(flLock) : null;
    const frLock = getChildValue(state, "Cabin.Door.Row1.Passenger.Lock");
    vehicle.front_right_door_is_locked = frLock != null ? !Boolean(frLock) : null;
    const blLock = getChildValue(state, "Cabin.Door.Row2.Left.Lock");
    vehicle.back_left_door_is_locked = blLock != null ? !Boolean(blLock) : null;
    const brLock = getChildValue(state, "Cabin.Door.Row2.Right.Lock");
    vehicle.back_right_door_is_locked = brLock != null ? !Boolean(brLock) : null;

    vehicle.is_locked =
      vehicle.front_left_door_is_locked === true &&
      vehicle.front_right_door_is_locked === true &&
      vehicle.back_left_door_is_locked === true &&
      vehicle.back_right_door_is_locked === true
        ? true
        : null;

    vehicle.hood_is_open = getChildValue(state, "Body.Hood.Open") as boolean | null;
    vehicle.front_left_window_is_open = getChildValue(state, "Cabin.Window.Row1.Driver.Open") as boolean | null;
    vehicle.front_right_window_is_open = getChildValue(state, "Cabin.Window.Row1.Passenger.Open") as boolean | null;
    vehicle.back_left_window_is_open = getChildValue(state, "Cabin.Window.Row2.Left.Open") as boolean | null;
    vehicle.back_right_window_is_open = getChildValue(state, "Cabin.Window.Row2.Right.Open") as boolean | null;

    const sunroof = getChildValue(state, "Body.Sunroof.Glass.Open");
    vehicle.sunroof_is_open = sunroof != null ? Boolean(sunroof) : null;

    vehicle.tire_pressure_rear_left_warning_is_on = Boolean(getChildValue(state, "Chassis.Axle.Row2.Left.Tire.PressureLow"));
    vehicle.tire_pressure_front_left_warning_is_on = Boolean(getChildValue(state, "Chassis.Axle.Row1.Left.Tire.PressureLow"));
    vehicle.tire_pressure_front_right_warning_is_on = Boolean(getChildValue(state, "Chassis.Axle.Row1.Right.Tire.PressureLow"));
    vehicle.tire_pressure_rear_right_warning_is_on = Boolean(getChildValue(state, "Chassis.Axle.Row2.Right.Tire.PressureLow"));
    vehicle.tire_pressure_all_warning_is_on = Boolean(getChildValue(state, "Chassis.Axle.Tire.PressureLow"));

    vehicle.trunk_is_open = getChildValue(state, "Body.Trunk.Open") as boolean | null;

    vehicle.ev_battery_percentage = getChildValue(state, "Green.BatteryManagement.BatteryRemain.Ratio") as number | null;
    vehicle.ev_battery_pack_voltage = getChildValue(state, "Green.BatteryManagement.BatteryPackVoltage") as number | null;
    vehicle.ev_battery_chiller_rpm = getChildValue(state, "Green.BatteryManagement.ChillerRPM") as number | null;

    const heatState = getChildValue(state, "Green.BatteryManagement.HeatingState");
    if (heatState != null) vehicle.ev_battery_heating_state = Boolean(heatState);

    vehicle.ev_battery_water_temperature = getChildValue(state, "Green.BatteryManagement.Temperature.CoolingWaterInlet") as number | null;
    vehicle.ev_battery_water_temperature_unit = TEMPERATURE_UNITS[0] ?? null;
    vehicle.ev_battery_temperature_min = getChildValue(state, "Green.BatteryManagement.Temperature.Min.Raw") as number | null;
    vehicle.ev_battery_temperature_min_unit = TEMPERATURE_UNITS[0] ?? null;
    vehicle.ev_battery_temperature_max = getChildValue(state, "Green.BatteryManagement.Temperature.Max.Raw") as number | null;
    vehicle.ev_battery_temperature_max_unit = TEMPERATURE_UNITS[0] ?? null;

    const winterMode = getChildValue(state, "Green.BatteryManagement.WinterModeOperation");
    if (winterMode != null) vehicle.ev_battery_winter_mode = Boolean(winterMode);

    const rtPower = getChildValue(state, "Green.Electric.SmartGrid.RealTimePower");
    if (rtPower != null) vehicle.ev_charging_power = rtPower as number;

    vehicle.ev_battery_remain = getChildValue(state, "Green.BatteryManagement.BatteryRemain.Value") as number | null;
    vehicle.ev_battery_capacity = getChildValue(state, "Green.BatteryManagement.BatteryCapacity.Value") as number | null;
    vehicle.ev_battery_soh_percentage = getChildValue(state, "Green.BatteryManagement.SoH.Ratio") as number | null;
    vehicle.ev_battery_is_plugged_in = getChildValue(state, "Green.ChargingInformation.ConnectorFastening.State") as boolean | null;

    const chargingDoor = getChildValue(state, "Green.ChargingDoor.State") as number | null;
    if (chargingDoor === 0 || chargingDoor === 2) vehicle.ev_charge_port_door_is_open = false;
    else if (chargingDoor === 1) vehicle.ev_charge_port_door_is_open = true;

    const dteTotal = getChildValue(state, "Drivetrain.FuelSystem.DTE.Total");
    const dteUnit = getChildValue(state, "Drivetrain.FuelSystem.DTE.Unit") as number | null;
    if (dteTotal != null) {
      vehicle.total_driving_range = parseFloat(dteTotal as string);
      vehicle.total_driving_range_unit = DISTANCE_UNITS[dteUnit ?? 1] ?? null;
    }

    if (vehicle.engine_type === ENGINE_TYPES.EV) {
      vehicle.ev_driving_range = vehicle.total_driving_range;
      vehicle.ev_driving_range_unit = vehicle.total_driving_range_unit;
    }

    vehicle.washer_fluid_warning_is_on = getChildValue(state, "Body.Windshield.Front.WasherFluid.LevelLow") as boolean | null;
    vehicle.brake_fluid_warning_is_on = getChildValue(state, "Chassis.Brake.Fluid.Warning") as boolean | null;

    vehicle.ev_estimated_current_charge_duration = getChildValue(state, "Green.ChargingInformation.Charging.RemainTime") as number | null;
    vehicle.ev_estimated_fast_charge_duration = getChildValue(state, "Green.ChargingInformation.EstimatedTime.Quick") as number | null;
    vehicle.ev_estimated_portable_charge_duration = getChildValue(state, "Green.ChargingInformation.EstimatedTime.ICCB") as number | null;
    vehicle.ev_estimated_station_charge_duration = getChildValue(state, "Green.ChargingInformation.EstimatedTime.Standard") as number | null;
    vehicle.ev_charge_limits_ac = getChildValue(state, "Green.ChargingInformation.TargetSoC.Standard") as number | null;
    vehicle.ev_charge_limits_dc = getChildValue(state, "Green.ChargingInformation.TargetSoC.Quick") as number | null;
    vehicle.ev_charging_current = getChildValue(state, "Green.ChargingInformation.ElectricCurrentLevel.State") as number | null;
    vehicle.ev_v2l_discharge_limit = getChildValue(state, "Green.Electric.SmartGrid.VehicleToLoad.DischargeLimitation.SoC") as number | null;

    vehicle.ev_target_range_charge_AC = getChildValue(state, "Green.ChargingInformation.DTE.TargetSoC.Standard") as number | null;
    vehicle.ev_target_range_charge_AC_unit = DISTANCE_UNITS[dteUnit ?? 1] ?? null;
    vehicle.ev_target_range_charge_DC = getChildValue(state, "Green.ChargingInformation.DTE.TargetSoC.Quick") as number | null;
    vehicle.ev_target_range_charge_DC_unit = DISTANCE_UNITS[dteUnit ?? 1] ?? null;

    vehicle.ev_first_departure_enabled = Boolean(getChildValue(state, "Green.Reservation.Departure.Schedule1.Enable"));
    vehicle.ev_second_departure_enabled = Boolean(getChildValue(state, "Green.Reservation.Departure.Schedule2.Enable"));
    vehicle.ev_power_consumption_battery_cooling = getChildValue(state, "Green.PowerConsumption.Moment.BatteryCooling") as number | null;
    vehicle.ev_power_consumption_battery_heater = getChildValue(state, "Green.PowerConsumption.Moment.BatteryHeater") as number | null;
    vehicle.ev_power_consumption_air_conditioning = getChildValue(state, "Green.PowerConsumption.Moment.ClimateAirConditioning") as number | null;

    vehicle.fuel_level = getChildValue(state, "Drivetrain.FuelSystem.FuelLevel") as number | null;
    vehicle.fuel_level_is_low = getChildValue(state, "Drivetrain.FuelSystem.LowFuelWarning") as boolean | null;
    vehicle.air_control_is_on = Boolean(getChildValue(state, "Cabin.HVAC.Row1.Driver.Blower.SpeedLevel")) as boolean | null;
    vehicle.smart_key_battery_warning_is_on = Boolean(getChildValue(state, "Electronics.FOB.LowBattery"));

    if (vehicle.ev_estimated_current_charge_duration != null) {
      vehicle.ev_battery_is_charging = vehicle.ev_estimated_current_charge_duration > 0;
    }

    const lat = getChildValue(state, "Location.GeoCoord.Latitude");
    const lon = getChildValue(state, "Location.GeoCoord.Longitude");
    if (lat) {
      const ts = getChildValue(state, "Location.TimeStamp") as Record<string, number> | null;
      let locTime = new Date("2000-01-01T00:00:00Z");
      if (ts) {
        locTime = new Date(
          `${ts["Year"]}-${String(ts["Mon"]).padStart(2, "0")}-${String(ts["Day"]).padStart(2, "0")}T${String(ts["Hour"]).padStart(2, "0")}:${String(ts["Min"]).padStart(2, "0")}:${String(ts["Sec"]).padStart(2, "0")}Z`
        );
      }
      vehicle.location_latitude = lat as number;
      vehicle.location_longitude = lon as number;
      vehicle.location_last_updated_at = locTime;
    }

    vehicle.data = state;
  }

  async startCharge(token: Token, vehicle: Vehicle): Promise<string> {
    let url: string;
    let payload: Record<string, unknown>;
    let headers: Record<string, string>;

    if (!vehicle.ccu_ccs2_protocol_support) {
      url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/control/charge";
      payload = { action: "start", deviceId: token.device_id };
      headers = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);
    } else {
      url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/control/charge";
      payload = { command: "start" };
      headers = await this._getControlHeaders(token, vehicle);
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async stopCharge(token: Token, vehicle: Vehicle): Promise<string> {
    let url: string;
    let payload: Record<string, unknown>;
    let headers: Record<string, string>;

    if (!vehicle.ccu_ccs2_protocol_support) {
      url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/control/charge";
      payload = { action: "stop", deviceId: token.device_id };
      headers = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);
    } else {
      url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/control/charge";
      payload = { command: "stop" };
      headers = await this._getControlHeaders(token, vehicle);
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async setChargingCurrent(token: Token, vehicle: Vehicle, level: number): Promise<string> {
    if (!vehicle.ccu_ccs2_protocol_support) {
      throw new UnsupportedControlError("setChargingCurrent requires CCS2 protocol support");
    }
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/ccs2/charge/chargingcurrent";
    const resp = await fetch(url, {
      method: "POST",
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
      body: JSON.stringify({ chargingCurrent: level }),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async setChargeLimits(token: Token, vehicle: Vehicle, ac: number, dc: number): Promise<string> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/charge/target";
    const body = {
      targetSOClist: [
        { plugType: 0, targetSOClevel: Math.round(dc) },
        { plugType: 1, targetSOClevel: Math.round(ac) },
      ],
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async setVehicleToLoadDischargeLimit(token: Token, vehicle: Vehicle, limit: number): Promise<string> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/ccs2/charge/dischargelimit";
    const resp = await fetch(url, {
      method: "POST",
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
      body: JSON.stringify({ dischargingLimit: Math.round(limit) }),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async lockAction(token: Token, vehicle: Vehicle, action: VEHICLE_LOCK_ACTION): Promise<string> {
    let url: string;
    let payload: Record<string, unknown>;
    let headers: Record<string, string>;

    if (!vehicle.ccu_ccs2_protocol_support) {
      url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/control/door";
      payload = { action: action, deviceId: token.device_id };
      headers = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);
    } else {
      url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/control/door";
      payload = { command: action };
      headers = await this._getControlHeaders(token, vehicle);
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async checkActionStatus(
    token: Token,
    vehicle: Vehicle,
    actionId: string,
    synchronous: boolean = false,
    timeout: number = 0
  ): Promise<ORDER_STATUS> {
    const url = this.SPA_API_URL + "notifications/" + vehicle.id + "/records";

    if (synchronous) {
      if (timeout < 1) throw new APIError("Timeout must be 1 or higher");
      const endTime = Date.now() + timeout * 1000;
      while (Date.now() < endTime) {
        const state = await this.checkActionStatus(token, vehicle, actionId, false);
        if (state === ORDER_STATUS.PENDING) {
          await sleep(5000);
        } else {
          return state;
        }
      }
      return ORDER_STATUS.TIMEOUT;
    }

    const resp = await fetch(url, {
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);

    const records = data["resMsg"] as Array<Record<string, unknown>>;
    for (const action of records) {
      if (action["recordId"] === actionId) {
        switch (action["result"]) {
          case "success": return ORDER_STATUS.SUCCESS;
          case "fail": return ORDER_STATUS.FAILED;
          case "non-response": return ORDER_STATUS.TIMEOUT;
          case null: return ORDER_STATUS.PENDING;
        }
      }
    }
    return ORDER_STATUS.UNKNOWN;
  }

  async scheduleChargingAndClimate(
    token: Token,
    vehicle: Vehicle,
    options: ScheduleChargingClimateRequestOptions
  ): Promise<string> {
    const url =
      this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/reservation/chargehvac";

    const fillDeparture = (d: typeof options.first_departure) => ({
      enabled: d?.enabled ?? false,
      days: d?.days ?? [0],
      time: d?.time ?? "00:00",
    });

    const departures = [
      fillDeparture(options.first_departure),
      fillDeparture(options.second_departure),
    ];

    const charging_enabled = options.charging_enabled ?? false;
    const off_peak_start = options.off_peak_start_time ?? "00:00";
    const off_peak_end = options.off_peak_end_time ?? off_peak_start;
    const climate_enabled = options.climate_enabled ?? false;
    let temperature = options.temperature ?? 21.0;
    const temperature_unit = options.temperature_unit ?? 0;
    const defrost = options.defrost ?? false;

    if (temperature_unit === 0) {
      temperature = Math.round(temperature * 2) / 2;
      if (temperature > 27) temperature = 27;
      if (temperature < 17) temperature = 17;
    }

    const timeToSection = (t: string) => {
      const [h] = t.split(":").map(Number);
      return h >= 12 ? 1 : 0;
    };
    const timeToHHMM = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${String(h12).padStart(2, "0")}${String(m).padStart(2, "0")}`;
    };

    const payload: Record<string, unknown> = {};
    for (let i = 0; i < 2; i++) {
      const dep = departures[i];
      payload[`reservChargeInfo${i + 1}`] = {
        reservChargeSet: dep.enabled,
        reservInfo: {
          day: dep.days,
          time: {
            time: timeToHHMM(dep.time),
            timeSection: timeToSection(dep.time),
          },
        },
        reservFatcSet: {
          airCtrl: climate_enabled ? 1 : 0,
          airTemp: {
            value: temperature.toFixed(1),
            hvacTempType: 1,
            unit: temperature_unit,
          },
          heating1: 0,
          defrost,
        },
      };
    }

    payload["offPeakPowerInfo"] = {
      offPeakPowerTime1: {
        endtime: { timeSection: timeToSection(off_peak_end), time: timeToHHMM(off_peak_end) },
        starttime: { timeSection: timeToSection(off_peak_start), time: timeToHHMM(off_peak_start) },
      },
      offPeakPowerFlag: options.off_peak_charge_only_enabled ? 2 : 1,
    };
    payload["reservFlag"] = charging_enabled ? 1 : 0;

    const headers = await this._getControlHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async startClimate(token: Token, vehicle: Vehicle, options: ClimateRequestOptions): Promise<string> {
    const set_temp = options.set_temp ?? 21;
    const duration = options.duration ?? 5;
    const defrost = options.defrost ?? false;
    const heating = options.heating ?? 0;

    let url: string;
    let payload: Record<string, unknown>;
    let headers: Record<string, string>;

    if (!vehicle.ccu_ccs2_protocol_support) {
      url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/control/temperature";
      const idx = this.temperature_range.indexOf(set_temp);
      const hexTemp = getIndexIntoHexTemp(idx >= 0 ? idx : 0)!;
      payload = {
        action: "start",
        hvacType: 0,
        options: { defrost, heating1: Math.round(heating), igniOnDuration: duration },
        tempCode: hexTemp,
        unit: "C",
      };
      headers = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);
    } else {
      url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/control/temperature";
      payload = {
        command: "start",
        ignitionDuration: duration,
        strgWhlHeating: options.steering_wheel,
        hvacTempType: 1,
        hvacTemp: set_temp,
        sideRearMirrorHeating: 1,
        drvSeatLoc: "R",
        seatClimateInfo: {
          drvSeatClimateState: options.front_left_seat,
          psgSeatClimateState: options.front_right_seat,
          rrSeatClimateState: options.rear_right_seat,
          rlSeatClimateState: options.rear_left_seat,
        },
        tempUnit: "C",
        windshieldFrontDefogState: defrost,
      };
      headers = await this._getControlHeaders(token, vehicle);
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async stopClimate(token: Token, vehicle: Vehicle): Promise<string> {
    let url: string;
    let payload: Record<string, unknown>;
    let headers: Record<string, string>;

    if (!vehicle.ccu_ccs2_protocol_support) {
      url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/control/temperature";
      payload = {
        action: "stop",
        hvacType: 0,
        options: { defrost: true, heating1: 1 },
        tempCode: "10H",
        unit: "C",
      };
      headers = this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support);
    } else {
      url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/control/temperature";
      payload = { command: "stop" };
      headers = await this._getControlHeaders(token, vehicle);
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async startHazardLights(token: Token, vehicle: Vehicle): Promise<string> {
    const url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/control/light";
    const headers = await this._getControlHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ command: "on" }) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async startHazardLightsAndHorn(token: Token, vehicle: Vehicle): Promise<string> {
    const url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/ccs2/control/hornlight";
    const headers = await this._getControlHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ command: "on" }) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async setWindowsState(token: Token, vehicle: Vehicle, options: WindowRequestOptions): Promise<string> {
    const url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/control/windowcurtain";
    const payload = {
      backLeft: options.back_left,
      backRight: options.back_right,
      frontLeft: options.front_left,
      frontRight: options.front_right,
    };
    const headers = await this._getControlHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async valetModeAction(token: Token, vehicle: Vehicle, action: VALET_MODE_ACTION): Promise<string> {
    const url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/control/valet";
    const headers = await this._getControlHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ action }) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async chargePortAction(token: Token, vehicle: Vehicle, action: CHARGE_PORT_ACTION): Promise<string> {
    const url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/control/portdoor";
    const headers = await this._getControlHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({ action }) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  async setNavigation(token: Token, vehicle: Vehicle, poiList: POIInfo[]): Promise<string> {
    const url = this.SPA_API_URL_V2 + "vehicles/" + vehicle.id + "/location/routes";
    const payload = {
      deviceID: token.device_id,
      poiInfoList: poiList.map(poiInfoToDict),
    };
    const headers = await this._getControlHeaders(token, vehicle);
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    token.device_id = await this._getDeviceId(this._getStamp());
    return data["msgId"] as string;
  }

  protected async _getTripInfo(
    token: Token,
    vehicle: Vehicle,
    dateString: string,
    tripPeriodType: number
  ): Promise<Record<string, unknown>> {
    const url = this.SPA_API_URL + "vehicles/" + vehicle.id + "/tripinfo";
    const payload =
      tripPeriodType === 0
        ? { tripPeriodType: 0, setTripMonth: dateString }
        : { tripPeriodType: 1, setTripDay: dateString };
    const resp = await fetch(url, {
      method: "POST",
      headers: this._getAuthenticatedHeaders(token, vehicle.ccu_ccs2_protocol_support),
      body: JSON.stringify(payload),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    checkResponseForErrors(data);
    return data;
  }

  async updateMonthTripInfo(token: Token, vehicle: Vehicle, yyyymmString: string): Promise<void> {
    vehicle.month_trip_info = null;
    const result = await this._getTripInfo(token, vehicle, yyyymmString, 0);
    const msg = result["resMsg"] as Record<string, unknown>;
    if ((msg["monthTripDayCnt"] as number) > 0) {
      const info: MonthTripInfo = {
        yyyymm: yyyymmString,
        day_list: [],
        summary: {
          hhmmss: null,
          drive_time: msg["tripDrvTime"] as number,
          idle_time: msg["tripIdleTime"] as number,
          distance: msg["tripDist"] as number,
          avg_speed: msg["tripAvgSpeed"] as number,
          max_speed: msg["tripMaxSpeed"] as number,
        },
      };
      const dayList = msg["tripDayList"] as Array<Record<string, unknown>>;
      for (const day of dayList) {
        info.day_list.push({
          yyyymmdd: day["tripDayInMonth"] as string,
          trip_count: day["tripCntDay"] as number,
        });
      }
      info.day_list.sort((a, b) => (a.yyyymmdd ?? "").localeCompare(b.yyyymmdd ?? ""));
      vehicle.month_trip_info = info;
    }
  }

  async updateDayTripInfo(token: Token, vehicle: Vehicle, yyyymmddString: string): Promise<void> {
    vehicle.day_trip_info = null;
    const result = await this._getTripInfo(token, vehicle, yyyymmddString, 1);
    const dayTripList = (result["resMsg"] as Record<string, unknown[]>)["dayTripList"] as Array<Record<string, unknown>>;
    if (dayTripList.length > 0) {
      const msg = dayTripList[0];
      const info: DayTripInfo = {
        yyyymmdd: yyyymmddString,
        trip_list: [],
        summary: {
          hhmmss: null,
          drive_time: msg["tripDrvTime"] as number,
          idle_time: msg["tripIdleTime"] as number,
          distance: msg["tripDist"] as number,
          avg_speed: msg["tripAvgSpeed"] as number,
          max_speed: msg["tripMaxSpeed"] as number,
        },
      };
      const trips = msg["tripList"] as Array<Record<string, unknown>>;
      for (const trip of trips) {
        info.trip_list.push({
          hhmmss: trip["tripTime"] as string,
          drive_time: trip["tripDrvTime"] as number,
          idle_time: trip["tripIdleTime"] as number,
          distance: trip["tripDist"] as number,
          avg_speed: trip["tripAvgSpeed"] as number,
          max_speed: trip["tripMaxSpeed"] as number,
        });
      }
      info.trip_list.sort((a, b) => (b.hhmmss ?? "").localeCompare(a.hhmmss ?? ""));
      vehicle.day_trip_info = info;
    }
  }
}

function getFloat(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? null : n;
}
