export const BRAND_KIA = "Kia";
export const BRAND_HYUNDAI = "Hyundai";
export const BRAND_GENESIS = "Genesis";

export const BRANDS: Record<number, string> = {
  1: BRAND_KIA,
  2: BRAND_HYUNDAI,
  3: BRAND_GENESIS,
};

export const GOOGLE = "google";
export const OPENSTREETMAP = "openstreetmap";
export const GEO_LOCATION_PROVIDERS: Record<number, string> = {
  1: OPENSTREETMAP,
  2: GOOGLE,
};

export const REGION_EUROPE = "Europe";
export const REGION_CANADA = "Canada";
export const REGION_USA = "USA";
export const REGION_CHINA = "China";
export const REGION_AUSTRALIA = "Australia";
export const REGION_NZ = "New Zealand";
export const REGION_INDIA = "India";
export const REGION_BRAZIL = "Brazil";

export const REGIONS: Record<number, string> = {
  1: REGION_EUROPE,
  2: REGION_CANADA,
  3: REGION_USA,
  4: REGION_CHINA,
  5: REGION_AUSTRALIA,
  6: REGION_INDIA,
  7: REGION_NZ,
  8: REGION_BRAZIL,
};

export const LOGIN_TOKEN_LIFETIME_HOURS = 23;

export const LENGTH_KILOMETERS = "km";
export const LENGTH_MILES = "mi";
export const DISTANCE_UNITS: Record<number | string, string | null> = {
  0: null,
  1: LENGTH_KILOMETERS,
  2: LENGTH_MILES,
  3: LENGTH_MILES,
};

export const TEMPERATURE_C = "°C";
export const TEMPERATURE_F = "°F";
export const TEMPERATURE_UNITS: Record<number | string, string | null> = {
  0: TEMPERATURE_C,
  1: TEMPERATURE_F,
};

export const SEAT_STATUS: Record<number, string | null> = {
  0: "Off",
  1: "On",
  2: "Off",
  3: "Low Cool",
  4: "Medium Cool",
  5: "High Cool",
  6: "Low Heat",
  7: "Medium Heat",
  8: "High Heat",
};

export const HEAT_STATUS: Record<number, string | null> = {
  0: "Off",
  1: "Steering Wheel and Rear Window",
  2: "Rear Window",
  3: "Steering Wheel",
  4: "Steering Wheel and Rear Window",
};

export enum ENGINE_TYPES {
  ICE = "ICE",
  EV = "EV",
  PHEV = "PHEV",
  HEV = "HEV",
}

export enum VEHICLE_LOCK_ACTION {
  LOCK = "close",
  UNLOCK = "open",
}

export enum CHARGE_PORT_ACTION {
  CLOSE = "close",
  OPEN = "open",
}

export enum ORDER_STATUS {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

export enum WINDOW_STATE {
  CLOSED = 0,
  OPEN = 1,
  VENTILATION = 2,
}

export enum VALET_MODE_ACTION {
  ACTIVATE = "activate",
  DEACTIVATE = "deactivate",
}

export enum OTP_NOTIFY_TYPE {
  EMAIL = "EMAIL",
  SMS = "SMS",
}
