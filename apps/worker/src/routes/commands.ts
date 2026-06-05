import { Hono } from "hono";
import type { Env } from "../index";
import * as vehicleService from "../services/vehicleService";

const router = new Hono<{ Bindings: Env }>();

// POST /api/commands/:vehicleId/lock
router.post("/:vehicleId/lock", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("vehicleId");
    const result = await vehicleService.executeCommand(
      vehicleId,
      userId,
      "LOCK",
      {},
      c.env
    );

    return c.json(result);
  } catch (error) {
    console.error("Lock error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      500
    );
  }
});

// POST /api/commands/:vehicleId/unlock
router.post("/:vehicleId/unlock", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("vehicleId");
    const result = await vehicleService.executeCommand(
      vehicleId,
      userId,
      "UNLOCK",
      {},
      c.env
    );

    return c.json(result);
  } catch (error) {
    console.error("Unlock error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      500
    );
  }
});

// POST /api/commands/:vehicleId/start
router.post("/:vehicleId/start", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("vehicleId");
    const { temp, duration, defrost } = await c.req.json<{
      temp?: number;
      duration?: number;
      defrost?: boolean;
    }>();

    const options: Record<string, unknown> = {};
    if (temp !== undefined) options.temp = temp;
    if (duration !== undefined) options.duration = duration;
    if (defrost !== undefined) options.defrost = defrost;

    const result = await vehicleService.executeCommand(
      vehicleId,
      userId,
      "START",
      options,
      c.env
    );

    return c.json(result);
  } catch (error) {
    console.error("Start error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      500
    );
  }
});

// POST /api/commands/:vehicleId/stop
router.post("/:vehicleId/stop", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("vehicleId");
    const result = await vehicleService.executeCommand(
      vehicleId,
      userId,
      "STOP",
      {},
      c.env
    );

    return c.json(result);
  } catch (error) {
    console.error("Stop error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      500
    );
  }
});

// POST /api/commands/:vehicleId/charge-start
router.post("/:vehicleId/charge-start", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("vehicleId");
    const result = await vehicleService.executeCommand(
      vehicleId,
      userId,
      "CHARGE_START",
      {},
      c.env
    );

    return c.json(result);
  } catch (error) {
    console.error("Charge start error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      500
    );
  }
});

// POST /api/commands/:vehicleId/charge-stop
router.post("/:vehicleId/charge-stop", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("vehicleId");
    const result = await vehicleService.executeCommand(
      vehicleId,
      userId,
      "CHARGE_STOP",
      {},
      c.env
    );

    return c.json(result);
  } catch (error) {
    console.error("Charge stop error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      500
    );
  }
});

// GET /api/commands/:vehicleId/status
router.get("/:vehicleId/status", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("vehicleId");
    const result = await vehicleService.executeCommand(
      vehicleId,
      userId,
      "STATUS",
      {},
      c.env
    );

    return c.json(result);
  } catch (error) {
    console.error("Status error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      500
    );
  }
});

export default router;
