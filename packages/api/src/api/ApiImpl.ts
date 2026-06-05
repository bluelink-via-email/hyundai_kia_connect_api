import { Token } from "../types/Token.js";
import { Vehicle } from "../types/Vehicle.js";
import {
  ClimateRequestOptions,
  OTPRequest,
  POIInfo,
  ScheduleChargingClimateRequestOptions,
  WindowRequestOptions,
} from "../types/requests.js";
import {
  CHARGE_PORT_ACTION,
  ORDER_STATUS,
  OTP_NOTIFY_TYPE,
  VALET_MODE_ACTION,
  VEHICLE_LOCK_ACTION,
} from "../constants/index.js";

export abstract class ApiImpl {
  supportsWindowControl: boolean = false;

  async login(
    username: string,
    password: string,
    pin?: string | null
  ): Promise<Token | OTPRequest> {
    throw new Error("login is not implemented for this region");
  }

  async sendOtp(otpRequest: OTPRequest, notifyType: OTP_NOTIFY_TYPE): Promise<void> {
    throw new Error("sendOtp is not implemented for this region");
  }

  async verifyOtpAndCompleteLogin(
    username: string,
    password: string,
    otpCode: string,
    otpRequest: OTPRequest,
    pin?: string | null
  ): Promise<Token> {
    throw new Error("verifyOtpAndCompleteLogin is not implemented for this region");
  }

  async getVehicles(token: Token): Promise<Vehicle[]> {
    throw new Error("getVehicles is not implemented for this region");
  }

  async refreshVehicles(token: Token, vehicles: Record<string, Vehicle>): Promise<void> {
    return;
  }

  async updateVehicleWithCachedState(token: Token, vehicle: Vehicle): Promise<void> {
    throw new Error("updateVehicleWithCachedState is not implemented for this region");
  }

  async testToken(token: Token): Promise<boolean> {
    return true;
  }

  async checkActionStatus(
    token: Token,
    vehicle: Vehicle,
    actionId: string,
    synchronous: boolean = false,
    timeout: number = 0
  ): Promise<ORDER_STATUS> {
    return ORDER_STATUS.UNKNOWN;
  }

  async forceRefreshVehicleState(token: Token, vehicle: Vehicle): Promise<void> {
    throw new Error("forceRefreshVehicleState is not implemented for this region");
  }

  async lockAction(
    token: Token,
    vehicle: Vehicle,
    action: VEHICLE_LOCK_ACTION
  ): Promise<string> {
    throw new Error("lockAction is not implemented for this region");
  }

  async startClimate(
    token: Token,
    vehicle: Vehicle,
    options: ClimateRequestOptions
  ): Promise<string> {
    throw new Error("startClimate is not implemented for this region");
  }

  async stopClimate(token: Token, vehicle: Vehicle): Promise<string> {
    throw new Error("stopClimate is not implemented for this region");
  }

  async startCharge(token: Token, vehicle: Vehicle): Promise<string> {
    throw new Error("startCharge is not implemented for this region");
  }

  async stopCharge(token: Token, vehicle: Vehicle): Promise<string> {
    throw new Error("stopCharge is not implemented for this region");
  }

  async setChargeLimits(
    token: Token,
    vehicle: Vehicle,
    ac: number,
    dc: number
  ): Promise<string> {
    throw new Error("setChargeLimits is not implemented for this region");
  }

  async setChargingCurrent(
    token: Token,
    vehicle: Vehicle,
    level: number
  ): Promise<string> {
    throw new Error("setChargingCurrent is not implemented for this region");
  }

  async setWindowsState(
    token: Token,
    vehicle: Vehicle,
    options: WindowRequestOptions
  ): Promise<string> {
    throw new Error("setWindowsState is not implemented for this region");
  }

  async chargePortAction(
    token: Token,
    vehicle: Vehicle,
    action: CHARGE_PORT_ACTION
  ): Promise<string> {
    throw new Error("chargePortAction is not implemented for this region");
  }

  async updateMonthTripInfo(
    token: Token,
    vehicle: Vehicle,
    yyyymmString: string
  ): Promise<void> {
    throw new Error("updateMonthTripInfo is not implemented for this region");
  }

  async updateDayTripInfo(
    token: Token,
    vehicle: Vehicle,
    yyyymmddString: string
  ): Promise<void> {
    throw new Error("updateDayTripInfo is not implemented for this region");
  }

  async scheduleChargingAndClimate(
    token: Token,
    vehicle: Vehicle,
    options: ScheduleChargingClimateRequestOptions
  ): Promise<string> {
    throw new Error("scheduleChargingAndClimate is not implemented for this region");
  }

  async startHazardLights(token: Token, vehicle: Vehicle): Promise<string> {
    throw new Error("startHazardLights is not implemented for this region");
  }

  async startHazardLightsAndHorn(token: Token, vehicle: Vehicle): Promise<string> {
    throw new Error("startHazardLightsAndHorn is not implemented for this region");
  }

  async valetModeAction(
    token: Token,
    vehicle: Vehicle,
    action: VALET_MODE_ACTION
  ): Promise<string> {
    throw new Error("valetModeAction is not implemented for this region");
  }

  async setVehicleToLoadDischargeLimit(
    token: Token,
    vehicle: Vehicle,
    limit: number
  ): Promise<string> {
    throw new Error("setVehicleToLoadDischargeLimit is not implemented for this region");
  }

  async setNavigation(
    token: Token,
    vehicle: Vehicle,
    poiList: POIInfo[]
  ): Promise<string> {
    throw new Error("setNavigation is not implemented for this region");
  }

  async refreshAccessToken(token: Token): Promise<Token | OTPRequest> {
    return this.login(token.username, token.password, token.pin);
  }

  async updateGeocodedLocation(
    token: Token,
    vehicle: Vehicle,
    useEmail: boolean
  ): Promise<void> {
    if (!vehicle.location_latitude || !vehicle.location_longitude) return;
    const emailParam = useEmail ? `&email=${encodeURIComponent(token.username)}` : "";
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${vehicle.location_latitude}` +
      `&lon=${vehicle.location_longitude}&format=json&addressdetails=1&zoom=18${emailParam}`;
    try {
      const resp = await fetch(url, {
        headers: { "user-agent": "curl/7.81.0" },
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as Record<string, unknown>;
      vehicle.geocode_name = (data["display_name"] as string) ?? null;
      vehicle.geocode_address = JSON.stringify(data["address"] ?? null);
    } catch {
      vehicle.geocode_name = null;
      vehicle.geocode_address = null;
    }
  }
}
