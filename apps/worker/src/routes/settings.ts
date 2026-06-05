import { Hono } from "hono";
import type { Env } from "../index";
import * as db from "../db/supabase";

const router = new Hono<{ Bindings: Env }>();

// GET /api/settings - Get user settings
router.get("/", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    let settings = await db.getUserSettings(userId, c.env);
    if (!settings) {
      // Return defaults if not set
      settings = {
        user_id: userId,
        default_temp_f: 70,
        default_duration: 10,
        defrost_default: false,
      };
    }

    return c.json({ settings });
  } catch (error) {
    console.error("Get settings error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get settings" },
      500
    );
  }
});

// PUT /api/settings - Update settings
router.put("/", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const { default_temp_f, default_duration, defrost_default } =
      await c.req.json<{
        default_temp_f?: number;
        default_duration?: number;
        defrost_default?: boolean;
      }>();

    const updates: Partial<db.UserSettings> = {};
    if (default_temp_f !== undefined) updates.default_temp_f = default_temp_f;
    if (default_duration !== undefined)
      updates.default_duration = default_duration;
    if (defrost_default !== undefined) updates.defrost_default = defrost_default;

    const settings = await db.upsertUserSettings(userId, updates, c.env);

    return c.json({ settings });
  } catch (error) {
    console.error("Update settings error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      500
    );
  }
});

export default router;
