import { DISTANCE_UNITS, ENGINE_TYPES } from "../constants/index.js";
import { getFloat } from "../utils/index.js";

export interface TripInfo {
  hhmmss: string | null;
  drive_time: number | null;
  idle_time: number | null;
  distance: number | null;
  avg_speed: number | null;
  max_speed: number | null;
}

export interface DayTripCounts {
  yyyymmdd: string | null;
  trip_count: number | null;
}

export interface MonthTripInfo {
  yyyymm: string | null;
  summary: TripInfo | null;
  day_list: DayTripCounts[];
}

export interface DayTripInfo {
  yyyymmdd: string | null;
  summary: TripInfo | null;
  trip_list: TripInfo[];
}

export interface DailyDrivingStats {
  date: Date | null;
  total_consumed: number | null;
  engine_consumption: number | null;
  climate_consumption: number | null;
  onboard_electronics_consumption: number | null;
  battery_care_consumption: number | null;
  regenerated_energy: number | null;
  distance: number | null;
  distance_unit: string;
}

export interface Vehicle {
  id: string | null;
  name: string | null;
  model: string | null;
  registration_date: string | null;
  year: number | null;
  VIN: string | null;
  key: string | null;
  ccu_ccs2_protocol_support: number | null;
  generation: number | null;
  enabled: boolean;

  total_driving_range: number | null;
  total_driving_range_unit: string | null;
  odometer: number | null;
  odometer_unit: string | null;
  geocode_address: string | null;
  geocode_name: string | null;
  car_battery_percentage: number | null;
  engine_is_running: boolean | null;
  last_updated_at: Date | null;
  dtc_count: number | null;
  dtc_descriptions: Record<string, unknown> | null;
  smart_key_battery_warning_is_on: boolean | null;
  washer_fluid_warning_is_on: boolean | null;
  brake_fluid_warning_is_on: boolean | null;
  outside_temperature: number | null;
  outside_temperature_unit: string | null;
  air_temperature: number | null;
  air_temperature_unit: string | null;
  air_control_is_on: boolean | null;
  defrost_is_on: boolean | null;
  steering_wheel_heater_is_on: boolean | null;
  back_window_heater_is_on: boolean | null;
  side_mirror_heater_is_on: boolean | null;
  front_left_seat_status: string | null;
  front_right_seat_status: string | null;
  rear_left_seat_status: string | null;
  rear_right_seat_status: string | null;
  is_locked: boolean | null;
  front_left_door_is_locked: boolean | null;
  front_right_door_is_locked: boolean | null;
  back_left_door_is_locked: boolean | null;
  back_right_door_is_locked: boolean | null;
  front_left_door_is_open: boolean | null;
  front_right_door_is_open: boolean | null;
  back_left_door_is_open: boolean | null;
  back_right_door_is_open: boolean | null;
  trunk_is_open: boolean | null;
  hood_is_open: boolean | null;
  front_left_window_is_open: boolean | null;
  front_right_window_is_open: boolean | null;
  back_left_window_is_open: boolean | null;
  back_right_window_is_open: boolean | null;
  sunroof_is_open: boolean | null;
  supports_window_control: boolean | null;
  tire_pressure_all_warning_is_on: boolean | null;
  tire_pressure_rear_left_warning_is_on: boolean | null;
  tire_pressure_front_left_warning_is_on: boolean | null;
  tire_pressure_front_right_warning_is_on: boolean | null;
  tire_pressure_rear_right_warning_is_on: boolean | null;
  next_service_distance: number | null;
  next_service_distance_unit: string | null;
  last_service_distance: number | null;
  last_service_distance_unit: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  location_last_updated_at: Date | null;
  ev_charge_port_door_is_open: boolean | null;
  ev_charging_power: number | null;
  ev_charge_limits_dc: number | null;
  ev_charge_limits_ac: number | null;
  ev_charging_current: number | null;
  ev_v2l_discharge_limit: number | null;
  ev_v2l_status: boolean | null;
  ev_v2x_status: boolean | null;
  total_power_consumed: number | null;
  total_power_regenerated: number | null;
  power_consumption_30d: number | null;
  daily_stats: DailyDrivingStats[];
  month_trip_info: MonthTripInfo | null;
  day_trip_info: DayTripInfo | null;
  ev_battery_percentage: number | null;
  ev_battery_pack_voltage: number | null;
  ev_battery_chiller_rpm: number | null;
  ev_battery_heating_state: boolean | null;
  ev_battery_water_temperature: number | null;
  ev_battery_water_temperature_unit: string | null;
  ev_battery_temperature_min: number | null;
  ev_battery_temperature_min_unit: string | null;
  ev_battery_temperature_max: number | null;
  ev_battery_temperature_max_unit: string | null;
  ev_battery_winter_mode: boolean | null;
  ev_battery_soh_percentage: number | null;
  ev_battery_remain: number | null;
  ev_battery_capacity: number | null;
  ev_battery_is_charging: boolean | null;
  ev_battery_is_plugged_in: boolean | null;
  ev_driving_range: number | null;
  ev_driving_range_unit: string | null;
  ev_estimated_current_charge_duration: number | null;
  ev_estimated_fast_charge_duration: number | null;
  ev_estimated_portable_charge_duration: number | null;
  ev_estimated_station_charge_duration: number | null;
  ev_battery_precondition_enabled: boolean | null;
  ev_target_range_charge_AC: number | null;
  ev_target_range_charge_AC_unit: string | null;
  ev_target_range_charge_DC: number | null;
  ev_target_range_charge_DC_unit: string | null;
  ev_power_consumption_battery_cooling: number | null;
  ev_power_consumption_battery_heater: number | null;
  ev_power_consumption_air_conditioning: number | null;
  ev_first_departure_enabled: boolean | null;
  ev_second_departure_enabled: boolean | null;
  ev_first_departure_days: number[] | null;
  ev_second_departure_days: number[] | null;
  ev_first_departure_time: string | null;
  ev_second_departure_time: string | null;
  ev_first_departure_climate_enabled: boolean | null;
  ev_second_departure_climate_enabled: boolean | null;
  ev_first_departure_climate_temperature: number | null;
  ev_first_departure_climate_temperature_unit: string | null;
  ev_second_departure_climate_temperature: number | null;
  ev_second_departure_climate_temperature_unit: string | null;
  ev_first_departure_climate_defrost: boolean | null;
  ev_second_departure_climate_defrost: boolean | null;
  ev_off_peak_start_time: string | null;
  ev_off_peak_end_time: string | null;
  ev_off_peak_charge_only_enabled: boolean | null;
  ev_schedule_charge_enabled: boolean | null;
  fuel_driving_range: number | null;
  fuel_driving_range_unit: string | null;
  fuel_level: number | null;
  fuel_level_is_low: boolean | null;
  engine_type: ENGINE_TYPES | null;
  headlamp_status: string | null;
  headlamp_left_low: boolean | null;
  headlamp_right_low: boolean | null;
  headlamp_left_high: boolean | null;
  headlamp_right_high: boolean | null;
  headlamp_left_bifunc: boolean | null;
  headlamp_right_bifunc: boolean | null;
  stop_lamp_left: boolean | null;
  stop_lamp_right: boolean | null;
  turn_signal_left_front: boolean | null;
  turn_signal_right_front: boolean | null;
  turn_signal_left_rear: boolean | null;
  turn_signal_right_rear: boolean | null;
  accessory_on: boolean | null;
  ign3: boolean | null;
  remote_ignition: boolean | null;
  transmission_condition: string | null;
  sleep_mode_check: boolean | null;
  data: Record<string, unknown> | null;
}

export function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: null,
    name: null,
    model: null,
    registration_date: null,
    year: null,
    VIN: null,
    key: null,
    ccu_ccs2_protocol_support: null,
    generation: null,
    enabled: true,
    total_driving_range: null,
    total_driving_range_unit: null,
    odometer: null,
    odometer_unit: null,
    geocode_address: null,
    geocode_name: null,
    car_battery_percentage: null,
    engine_is_running: null,
    last_updated_at: null,
    dtc_count: null,
    dtc_descriptions: null,
    smart_key_battery_warning_is_on: null,
    washer_fluid_warning_is_on: null,
    brake_fluid_warning_is_on: null,
    outside_temperature: null,
    outside_temperature_unit: null,
    air_temperature: null,
    air_temperature_unit: null,
    air_control_is_on: null,
    defrost_is_on: null,
    steering_wheel_heater_is_on: null,
    back_window_heater_is_on: null,
    side_mirror_heater_is_on: null,
    front_left_seat_status: null,
    front_right_seat_status: null,
    rear_left_seat_status: null,
    rear_right_seat_status: null,
    is_locked: null,
    front_left_door_is_locked: null,
    front_right_door_is_locked: null,
    back_left_door_is_locked: null,
    back_right_door_is_locked: null,
    front_left_door_is_open: null,
    front_right_door_is_open: null,
    back_left_door_is_open: null,
    back_right_door_is_open: null,
    trunk_is_open: null,
    hood_is_open: null,
    front_left_window_is_open: null,
    front_right_window_is_open: null,
    back_left_window_is_open: null,
    back_right_window_is_open: null,
    sunroof_is_open: null,
    supports_window_control: null,
    tire_pressure_all_warning_is_on: null,
    tire_pressure_rear_left_warning_is_on: null,
    tire_pressure_front_left_warning_is_on: null,
    tire_pressure_front_right_warning_is_on: null,
    tire_pressure_rear_right_warning_is_on: null,
    next_service_distance: null,
    next_service_distance_unit: null,
    last_service_distance: null,
    last_service_distance_unit: null,
    location_latitude: null,
    location_longitude: null,
    location_last_updated_at: null,
    ev_charge_port_door_is_open: null,
    ev_charging_power: null,
    ev_charge_limits_dc: null,
    ev_charge_limits_ac: null,
    ev_charging_current: null,
    ev_v2l_discharge_limit: null,
    ev_v2l_status: null,
    ev_v2x_status: null,
    total_power_consumed: null,
    total_power_regenerated: null,
    power_consumption_30d: null,
    daily_stats: [],
    month_trip_info: null,
    day_trip_info: null,
    ev_battery_percentage: null,
    ev_battery_pack_voltage: null,
    ev_battery_chiller_rpm: null,
    ev_battery_heating_state: null,
    ev_battery_water_temperature: null,
    ev_battery_water_temperature_unit: null,
    ev_battery_temperature_min: null,
    ev_battery_temperature_min_unit: null,
    ev_battery_temperature_max: null,
    ev_battery_temperature_max_unit: null,
    ev_battery_winter_mode: null,
    ev_battery_soh_percentage: null,
    ev_battery_remain: null,
    ev_battery_capacity: null,
    ev_battery_is_charging: null,
    ev_battery_is_plugged_in: null,
    ev_driving_range: null,
    ev_driving_range_unit: null,
    ev_estimated_current_charge_duration: null,
    ev_estimated_fast_charge_duration: null,
    ev_estimated_portable_charge_duration: null,
    ev_estimated_station_charge_duration: null,
    ev_battery_precondition_enabled: null,
    ev_target_range_charge_AC: null,
    ev_target_range_charge_AC_unit: null,
    ev_target_range_charge_DC: null,
    ev_target_range_charge_DC_unit: null,
    ev_power_consumption_battery_cooling: null,
    ev_power_consumption_battery_heater: null,
    ev_power_consumption_air_conditioning: null,
    ev_first_departure_enabled: null,
    ev_second_departure_enabled: null,
    ev_first_departure_days: null,
    ev_second_departure_days: null,
    ev_first_departure_time: null,
    ev_second_departure_time: null,
    ev_first_departure_climate_enabled: null,
    ev_second_departure_climate_enabled: null,
    ev_first_departure_climate_temperature: null,
    ev_first_departure_climate_temperature_unit: null,
    ev_second_departure_climate_temperature: null,
    ev_second_departure_climate_temperature_unit: null,
    ev_first_departure_climate_defrost: null,
    ev_second_departure_climate_defrost: null,
    ev_off_peak_start_time: null,
    ev_off_peak_end_time: null,
    ev_off_peak_charge_only_enabled: null,
    ev_schedule_charge_enabled: null,
    fuel_driving_range: null,
    fuel_driving_range_unit: null,
    fuel_level: null,
    fuel_level_is_low: null,
    engine_type: null,
    headlamp_status: null,
    headlamp_left_low: null,
    headlamp_right_low: null,
    headlamp_left_high: null,
    headlamp_right_high: null,
    headlamp_left_bifunc: null,
    headlamp_right_bifunc: null,
    stop_lamp_left: null,
    stop_lamp_right: null,
    turn_signal_left_front: null,
    turn_signal_right_front: null,
    turn_signal_left_rear: null,
    turn_signal_right_rear: null,
    accessory_on: null,
    ign3: null,
    remote_ignition: null,
    transmission_condition: null,
    sleep_mode_check: null,
    data: null,
    ...overrides,
  };
}
