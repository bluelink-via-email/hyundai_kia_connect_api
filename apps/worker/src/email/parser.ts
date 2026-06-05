export interface ParsedCommand {
  command: string;
  vehicleAlias: string | null;
  options: Record<string, unknown>;
}

export function parseEmailCommand(subject: string, body: string): ParsedCommand {
  const fullText = `${subject}\n${body}`.toUpperCase().trim();

  // Remove extra whitespace
  const normalized = fullText.replace(/\s+/g, " ");

  let command = "";
  let vehicleAlias: string | null = null;
  const options: Record<string, unknown> = {};

  // Try to match common command patterns
  if (normalized.includes("LOCK")) {
    command = "LOCK";
  } else if (normalized.includes("UNLOCK")) {
    command = "UNLOCK";
  } else if (normalized.includes("START")) {
    command = "START";
    // Parse temperature, duration, defrost options
    const tempMatch = normalized.match(/(?:TEMP|TEMPERATURE)\s*(\d+)/);
    const durationMatch = normalized.match(/(?:DURATION|MIN|MINUTES)\s*(\d+)/);
    const defrostMatch = normalized.includes("DEFROST");

    if (tempMatch) options.temp = parseInt(tempMatch[1], 10);
    if (durationMatch) options.duration = parseInt(durationMatch[1], 10);
    if (defrostMatch) options.defrost = true;
  } else if (normalized.includes("STOP")) {
    command = "STOP";
  } else if (normalized.includes("CHARGE") && normalized.includes("START")) {
    command = "CHARGE_START";
  } else if (normalized.includes("CHARGE") && normalized.includes("STOP")) {
    command = "CHARGE_STOP";
  } else if (normalized.includes("STATUS")) {
    command = "STATUS";
  } else if (normalized.includes("HELP")) {
    command = "HELP";
  } else {
    // Default to unknown
    command = "UNKNOWN";
  }

  // Extract vehicle alias if present (e.g., "LOCK my-car" or "START my-tesla 72")
  const words = normalized.split(" ");
  if (words.length > 1) {
    // Simple heuristic: last word that's not a number is the alias
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (!/^\d+$/.test(word) && word !== command && !["TEMP", "TEMPERATURE", "DURATION", "MIN", "MINUTES", "DEFROST"].includes(word)) {
        vehicleAlias = word.toLowerCase().replace(/[^a-z0-9-]/g, "");
        break;
      }
    }
  }

  // Parse START command with positional args: START [temp] [duration]
  if (command === "START" && !options.temp && !options.duration) {
    const parts = normalized.split(/\s+/);
    const startIdx = parts.indexOf("START");
    if (startIdx !== -1) {
      let idx = startIdx + 1;
      // Skip over vehicle alias if it exists
      if (vehicleAlias && parts[idx]?.includes(vehicleAlias)) idx++;
      // First number is temp
      if (idx < parts.length && /^\d+$/.test(parts[idx])) {
        options.temp = parseInt(parts[idx], 10);
        idx++;
      }
      // Second number is duration
      if (idx < parts.length && /^\d+$/.test(parts[idx])) {
        options.duration = parseInt(parts[idx], 10);
      }
    }
  }

  return { command, vehicleAlias, options };
}
