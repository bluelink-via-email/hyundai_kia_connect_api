import type { Env } from "../index";
import * as db from "../db/supabase";
import * as vehicleService from "../services/vehicleService";
import { parseEmailCommand } from "./parser";
import {
  formatErrorReply,
  formatStatusReply,
  formatSuccessReply,
  formatHelpReply,
} from "./formatter";

export interface ForwardableEmailMessage {
  from: string;
  to: string;
  raw: string;
  headers: Headers;
  text: () => Promise<string>;
  html: () => Promise<string>;
  forward(rcptTo: string | string[], headers?: Headers): Promise<void>;
  reply(message: EmailMessage): Promise<void>;
}

export interface EmailMessage {
  to?: string;
  from?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

export async function handleIncomingEmail(
  message: ForwardableEmailMessage,
  env: Env
): Promise<void> {
  try {
    // Get email content
    const subject = message.headers.get("subject") || "";
    const body = await message.text();

    // Look up user by email
    const user = await db.getUserByEmail(message.from, env);
    if (!user) {
      // User not found, send error response
      await message.reply({
        to: message.from,
        subject: `Re: ${subject}`,
        text: formatErrorReply("UNKNOWN", "User not registered"),
        headers: { "In-Reply-To": message.headers.get("message-id") || "" },
      });
      return;
    }

    // Parse command
    const parsed = parseEmailCommand(subject, body);

    // Handle HELP command specially
    if (parsed.command === "HELP") {
      await message.reply({
        to: message.from,
        subject: "Command Help",
        text: formatHelpReply(),
        headers: { "In-Reply-To": message.headers.get("message-id") || "" },
      });
      return;
    }

    // Get vehicle accounts
    const vehicles = await db.getVehicleAccounts(user.id, env);
    if (vehicles.length === 0) {
      await message.reply({
        to: message.from,
        subject: `Re: ${subject}`,
        text: formatErrorReply(parsed.command, "No vehicle accounts configured"),
        headers: { "In-Reply-To": message.headers.get("message-id") || "" },
      });
      return;
    }

    // Resolve vehicle
    let vehicle = vehicles.find((v) => v.is_default);
    if (parsed.vehicleAlias && !vehicle) {
      vehicle = vehicles.find((v) =>
        v.nickname.toLowerCase().includes(parsed.vehicleAlias!)
      );
    }
    if (!vehicle) {
      vehicle = vehicles[0]; // Fall back to first
    }

    let replyText: string;

    try {
      if (parsed.command === "STATUS") {
        // Get live status
        const status = await vehicleService.getVehicleStatus(
          vehicle.id,
          user.id,
          env
        );
        replyText = formatStatusReply(status);
      } else if (parsed.command === "UNKNOWN") {
        replyText = formatErrorReply(
          "UNKNOWN",
          "Command not recognized. Send HELP for available commands."
        );
      } else {
        // Execute command
        const result = await vehicleService.executeCommand(
          vehicle.id,
          user.id,
          parsed.command,
          parsed.options,
          env
        );
        replyText = formatSuccessReply(parsed.command, {
          id: vehicle.id,
          nickname: vehicle.nickname,
          brand: vehicle.brand,
          status: "success",
          message: result.message,
        } as any);
      }
    } catch (error) {
      replyText = formatErrorReply(
        parsed.command,
        error instanceof Error ? error.message : "Command failed"
      );
    }

    // Send reply
    await message.reply({
      to: message.from,
      subject: `Re: ${subject}`,
      text: replyText,
      headers: { "In-Reply-To": message.headers.get("message-id") || "" },
    });
  } catch (error) {
    console.error("Error handling email:", error);
    // If we can't process, silently fail to avoid feedback loops
  }
}
