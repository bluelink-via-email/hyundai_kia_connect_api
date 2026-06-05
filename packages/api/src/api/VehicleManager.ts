import {
  CHARGE_PORT_ACTION, ORDER_STATUS, OTP_NOTIFY_TYPE,
  VALET_MODE_ACTION, VEHICLE_LOCK_ACTION,
} from "../constants/index.js";
import { AuthenticationOTPRequired } from "../exceptions/index.js";
import { Token } from "../types/Token.js";
import { Vehicle } from "../types/Vehicle.js";
import { ClimateRequestOptions, OTPRequest, POIInfo, ScheduleChargingClimateRequestOptions, WindowRequestOptions } from "../types/requests.js";
import { ApiImpl } from "./ApiImpl.js";
import { getApiImplementation } from "./ApiFactory.js";

export interface VehicleManagerOptions {
  region: number;
  brand: number;
  username: string;
  password: string;
  pin: string;
  language?: string;
  geocodeApiEnable?: boolean;
  token?: Token;
}

export class VehicleManager {
  readonly region: number;
  readonly brand: number;
  readonly username: string;
  readonly password: string;
  readonly pin: string;
  readonly language: string;
  readonly geocodeApiEnable: boolean;

  api: ApiImpl;
  token: Token | null;
  vehicles: Map<string, Vehicle>;
  otpRequest: OTPRequest | null;

  constructor(options: VehicleManagerOptions) {
    this.region = options.region;
    this.brand = options.brand;
    this.username = options.username;
    this.password = options.password;
    this.pin = options.pin;
    this.language = options.language ?? "en";
    this.geocodeApiEnable = options.geocodeApiEnable ?? false;
    this.token = options.token ?? null;
    this.vehicles = new Map();
    this.otpRequest = null;
    this.api = getApiImplementation(this.region, this.brand, this.language);
  }

  async login(): Promise<true | OTPRequest> {
    const result = await this.api.login(this.username, this.password, this.pin);
    if ("access_token" in result) {
      this.token = result as Token;
      await this.initializeVehicles();
      return true;
    }
    this.otpRequest = result as OTPRequest;
    return this.otpRequest;
  }

  async sendOtp(notifyType: OTP_NOTIFY_TYPE): Promise<void> {
    if (!this.otpRequest) throw new Error("No pending OTP request");
    await this.api.sendOtp(this.otpRequest, notifyType);
  }

  async verifyOtpAndCompleteLogin(otpCode: string): Promise<void> {
    if (!this.otpRequest) throw new Error("No pending OTP request");
    this.token = await this.api.verifyOtpAndCompleteLogin(
      this.username, this.password, otpCode, this.otpRequest, this.pin,
    );
    await this.initializeVehicles();
  }

  async initializeVehicles(): Promise<void> {
    const list = await this.api.getVehicles(this.token!);
    for (const vehicle of list) {
      vehicle.supports_window_control = this.api.supports_window_control;
      this.vehicles.set(vehicle.id, vehicle);
    }
  }

  getVehicle(vehicleId: string): Vehicle {
    const v = this.vehicles.get(vehicleId);
    if (!v) throw new Error(`Vehicle ${vehicleId} not found`);
    return v;
  }

  async updateAllVehiclesWithCachedState(): Promise<void> {
    for (const id of this.vehicles.keys()) {
      await this.updateVehicleWithCachedState(id);
    }
  }

  async updateVehicleWithCachedState(vehicleId: string): Promise<void> {
    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle.enabled) return;
    await this.api.updateVehicleWithCachedState(this.token!, vehicle);
    if (this.geocodeApiEnable) {
      await this.api.updateGeocodedLocation(this.token!, vehicle);
    }
  }

  async checkAndForceUpdateVehicle(forceRefreshInterval: number, vehicleId: string): Promise<void> {
    const vehicle = this.getVehicle(vehicleId);
    const now = Date.now();
    if (vehicle.last_updated_at !== null && vehicle.last_updated_at !== undefined) {
      const ageSeconds = (now - vehicle.last_updated_at.getTime()) / 1000;
      if (ageSeconds > forceRefreshInterval) {
        await this.forceRefreshVehicleState(vehicleId);
      } else {
        await this.updateVehicleWithCachedState(vehicleId);
      }
    } else {
      await this.updateVehicleWithCachedState(vehicleId);
    }
  }

  async forceRefreshVehicleState(vehicleId: string): Promise<void> {
    const vehicle = this.getVehicle(vehicleId);
    if (!vehicle.enabled) return;
    await this.api.forceRefreshVehicleState(this.token!, vehicle);
  }

  async checkAndRefreshToken(): Promise<boolean> {
    if (!this.token) {
      const result = await this.login();
      if (result === true) return true;
      throw new AuthenticationOTPRequired("OTP required to refresh token");
    }

    const nowMs = Date.now();
    const graceMs = 10 * 1000;
    const tokenExpired = !this.token.valid_until || (this.token.valid_until.getTime() - graceMs <= nowMs);

    if (tokenExpired || !(await this.api.testToken(this.token))) {
      const result = await this.api.refreshAccessToken(this.token);
      if ("access_token" in result) {
        this.token = result as Token;
        if (this.token.pin !== this.pin) this.token.pin = this.pin;
      } else {
        throw new AuthenticationOTPRequired("OTP required to refresh token");
      }
      await this.api.refreshVehicles(this.token, this.vehicles);
      if (this.vehicles.size === 0) await this.initializeVehicles();
      return true;
    }

    if (this.vehicles.size === 0) await this.initializeVehicles();
    return false;
  }

  async startClimate(vehicleId: string, options: ClimateRequestOptions): Promise<string> {
    return this.api.startClimate(this.token!, this.getVehicle(vehicleId), options);
  }

  async stopClimate(vehicleId: string): Promise<string> {
    return this.api.stopClimate(this.token!, this.getVehicle(vehicleId));
  }

  async lock(vehicleId: string): Promise<string> {
    return this.api.lockAction(this.token!, this.getVehicle(vehicleId), VEHICLE_LOCK_ACTION.LOCK);
  }

  async unlock(vehicleId: string): Promise<string> {
    return this.api.lockAction(this.token!, this.getVehicle(vehicleId), VEHICLE_LOCK_ACTION.UNLOCK);
  }

  async startCharge(vehicleId: string): Promise<string> {
    return this.api.startCharge(this.token!, this.getVehicle(vehicleId));
  }

  async stopCharge(vehicleId: string): Promise<string> {
    return this.api.stopCharge(this.token!, this.getVehicle(vehicleId));
  }

  async startHazardLights(vehicleId: string): Promise<string> {
    return this.api.startHazardLights(this.token!, this.getVehicle(vehicleId));
  }

  async startHazardLightsAndHorn(vehicleId: string): Promise<string> {
    return this.api.startHazardLightsAndHorn(this.token!, this.getVehicle(vehicleId));
  }

  async setChargeLimits(vehicleId: string, ac: number, dc: number): Promise<string> {
    return this.api.setChargeLimits(this.token!, this.getVehicle(vehicleId), ac, dc);
  }

  async setChargingCurrent(vehicleId: string, level: number): Promise<string> {
    return this.api.setChargingCurrent(this.token!, this.getVehicle(vehicleId), level);
  }

  async setWindowsState(vehicleId: string, options: WindowRequestOptions): Promise<string> {
    return this.api.setWindowsState(this.token!, this.getVehicle(vehicleId), options);
  }

  async checkActionStatus(vehicleId: string, actionId: string, synchronous = false, timeout = 120): Promise<ORDER_STATUS> {
    return this.api.checkActionStatus(this.token!, this.getVehicle(vehicleId), actionId, synchronous, timeout);
  }

  async openChargePort(vehicleId: string): Promise<string> {
    return this.api.chargePortAction(this.token!, this.getVehicle(vehicleId), CHARGE_PORT_ACTION.OPEN);
  }

  async closeChargePort(vehicleId: string): Promise<string> {
    return this.api.chargePortAction(this.token!, this.getVehicle(vehicleId), CHARGE_PORT_ACTION.CLOSE);
  }

  async updateMonthTripInfo(vehicleId: string, yyyymmString: string): Promise<void> {
    return this.api.updateMonthTripInfo(this.token!, this.getVehicle(vehicleId), yyyymmString);
  }

  async updateDayTripInfo(vehicleId: string, yyyymmddString: string): Promise<void> {
    return this.api.updateDayTripInfo(this.token!, this.getVehicle(vehicleId), yyyymmddString);
  }

  async scheduleChargingAndClimate(vehicleId: string, options: ScheduleChargingClimateRequestOptions): Promise<string> {
    return this.api.scheduleChargingAndClimate(this.token!, this.getVehicle(vehicleId), options);
  }

  async startValetMode(vehicleId: string): Promise<string> {
    return this.api.valetModeAction(this.token!, this.getVehicle(vehicleId), VALET_MODE_ACTION.ACTIVATE);
  }

  async stopValetMode(vehicleId: string): Promise<string> {
    return this.api.valetModeAction(this.token!, this.getVehicle(vehicleId), VALET_MODE_ACTION.DEACTIVATE);
  }

  async setNavigation(vehicleId: string, poiList: POIInfo[]): Promise<string> {
    return this.api.setNavigation(this.token!, this.getVehicle(vehicleId), poiList);
  }

  disableVehicle(vehicleId: string): void {
    this.getVehicle(vehicleId).enabled = false;
  }

  enableVehicle(vehicleId: string): void {
    this.getVehicle(vehicleId).enabled = true;
  }
}
