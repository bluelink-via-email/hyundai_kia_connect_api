import { Hono } from "hono";
import type { Env } from "../index";
import * as db from "../db/supabase";

const router = new Hono<{ Bindings: Env }>();

// GET /api/history - List recent command history
router.get("/", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const history = await db.getCommandHistory(userId, 50, c.env);
    return c.json({ history });
  } catch (error) {
    console.error("Get history error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get history" },
      500
    );
  }
});

export default router;
