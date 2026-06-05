interface Vehicle {
  id: string;
  nickname: string;
  brand: number;
  status?: string;
  battery?: number;
  fuelLevel?: number;
  odometer?: number;
  locked?: boolean;
  charging?: boolean;
  temperature?: number;
  message?: string;
}

export function formatSuccessReply(command: string, vehicle: Vehicle): string {
  const lines: string[] = [];
  lines.push(`Command: ${command}`);
  lines.push(`Vehicle: ${vehicle.nickname}`);
  lines.push(`Status: Success`);
  if (vehicle.message) {
    lines.push(`Message: ${vehicle.message}`);
  }
  lines.push("");
  lines.push("--");
  lines.push("Hyundai/Kia Vehicle Control System");
  return lines.join("\n");
}

export function formatErrorReply(command: string, error: string): string {
  const lines: string[] = [];
  lines.push(`Command: ${command}`);
  lines.push(`Status: Error`);
  lines.push(`Error: ${error}`);
  lines.push("");
  lines.push("--");
  lines.push("Hyundai/Kia Vehicle Control System");
  return lines.join("\n");
}

export function formatStatusReply(vehicle: Vehicle): string {
  const lines: string[] = [];
  lines.push(`Vehicle: ${vehicle.nickname}`);
  lines.push(`Status: ${vehicle.status || "unknown"}`);
  lines.push("");

  if (vehicle.battery !== undefined) {
    lines.push(`Battery: ${vehicle.battery}%`);
  }
  if (vehicle.fuelLevel !== undefined) {
    lines.push(`Fuel Level: ${vehicle.fuelLevel}%`);
  }
  if (vehicle.odometer !== undefined) {
    lines.push(`Odometer: ${vehicle.odometer} miles`);
  }
  if (vehicle.locked !== undefined) {
    lines.push(`Locked: ${vehicle.locked ? "Yes" : "No"}`);
  }
  if (vehicle.charging !== undefined) {
    lines.push(`Charging: ${vehicle.charging ? "Yes" : "No"}`);
  }
  if (vehicle.temperature !== undefined) {
    lines.push(`Temperature: ${vehicle.temperature}°F`);
  }

  lines.push("");
  lines.push("--");
  lines.push("Hyundai/Kia Vehicle Control System");
  return lines.join("\n");
}

export function formatHelpReply(): string {
  const lines: string[] = [];
  lines.push("Available Commands:");
  lines.push("");
  lines.push("LOCK - Lock the vehicle");
  lines.push("UNLOCK - Unlock the vehicle");
  lines.push("START [temp] [duration] - Start the engine");
  lines.push("  temp: Temperature in Fahrenheit (optional)");
  lines.push("  duration: Duration in minutes (optional)");
  lines.push("  Example: START 72 10");
  lines.push("");
  lines.push("STOP - Stop the engine");
  lines.push("CHARGE START - Start charging (EV only)");
  lines.push("CHARGE STOP - Stop charging (EV only)");
  lines.push("STATUS - Get vehicle status");
  lines.push("");
  lines.push("Examples:");
  lines.push("  Subject: LOCK");
  lines.push("  Subject: START 72 10 my-car");
  lines.push("  Subject: STATUS");
  lines.push("");
  lines.push("--");
  lines.push("Hyundai/Kia Vehicle Control System");
  return lines.join("\n");
}
