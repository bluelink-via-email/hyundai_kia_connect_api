import { WINDOW_STATE } from "../constants/index.js";

export interface ClimateRequestOptions {
  set_temp?: number | null;
  duration?: number | null;
  defrost?: boolean | null;
  climate?: boolean | null;
  heating?: number | null;
  front_left_seat?: number | null;
  front_right_seat?: number | null;
  rear_left_seat?: number | null;
  rear_right_seat?: number | null;
  steering_wheel?: number | null;
}

export interface WindowRequestOptions {
  back_left?: WINDOW_STATE | null;
  back_right?: WINDOW_STATE | null;
  front_left?: WINDOW_STATE | null;
  front_right?: WINDOW_STATE | null;
}

export interface OTPRequest {
  request_id: string | null;
  otp_key: string | null;
  has_email: boolean | null;
  has_sms: boolean | null;
  email: string | null;
  sms: string | null;
}

export interface DepartureOptions {
  enabled?: boolean | null;
  days?: number[] | null;
  time?: string | null;
}

export interface ScheduleChargingClimateRequestOptions {
  first_departure?: DepartureOptions | null;
  second_departure?: DepartureOptions | null;
  charging_enabled?: boolean | null;
  off_peak_start_time?: string | null;
  off_peak_end_time?: string | null;
  off_peak_charge_only_enabled?: boolean | null;
  climate_enabled?: boolean | null;
  temperature?: number | null;
  temperature_unit?: number | null;
  defrost?: boolean | null;
}

export interface POICoord {
  lat: number;
  lon: number;
  alt?: number;
  type?: number;
}

export interface POIInfo {
  phone?: string;
  waypoint_id?: number;
  lang?: number;
  src?: string;
  coord: POICoord;
  addr?: string;
  zip?: string;
  place_id?: string;
  name?: string;
}

export function poiInfoToDict(poi: POIInfo): Record<string, unknown> {
  return {
    phone: poi.phone ?? "",
    waypointID: poi.waypoint_id ?? 1,
    lang: poi.lang ?? 1,
    src: poi.src ?? "HERE",
    coord: {
      lat: poi.coord.lat,
      alt: poi.coord.alt ?? 0,
      lon: poi.coord.lon,
      type: poi.coord.type ?? 0,
    },
    addr: poi.addr ?? "",
    zip: poi.zip ?? "",
    placeid: poi.place_id ?? "",
    name: poi.name ?? "",
  };
}
