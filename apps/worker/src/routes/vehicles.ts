import { Hono } from "hono";
import type { Env } from "../index";
import * as db from "../db/supabase";
import * as vehicleService from "../services/vehicleService";
import { encrypt } from "../services/encryptionService";

const router = new Hono<{ Bindings: Env }>();

// GET /api/vehicles - List vehicle accounts
router.get("/", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicles = await db.getVehicleAccounts(userId, c.env);
    return c.json({ vehicles });
  } catch (error) {
    console.error("Get vehicles error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get vehicles" },
      500
    );
  }
});

// POST /api/vehicles - Add vehicle account
router.post("/", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const {
      brand,
      region,
      username,
      password,
      pin,
      nickname,
    } = await c.req.json<{
      brand: number;
      region: number;
      username: string;
      password: string;
      pin: string;
      nickname: string;
    }>();

    if (!brand || !region || !username || !password || !pin || !nickname) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Encrypt credentials
    const passwordEncrypted = await encrypt(password, c.env.ENCRYPTION_KEY);
    const pinEncrypted = await encrypt(pin, c.env.ENCRYPTION_KEY);

    // Create vehicle account
    const vehicle = await db.createVehicleAccount(
      {
        user_id: userId,
        brand,
        region,
        username,
        password_encrypted: passwordEncrypted,
        pin_encrypted: pinEncrypted,
        nickname,
        is_default: false,
      },
      c.env
    );

    return c.json({ vehicle }, 201);
  } catch (error) {
    console.error("Create vehicle error:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create vehicle",
      },
      500
    );
  }
});

// GET /api/vehicles/:id - Get vehicle account details
router.get("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("id");
    const vehicle = await db.getVehicleAccount(vehicleId, userId, c.env);

    if (!vehicle) {
      return c.json({ error: "Vehicle not found" }, 404);
    }

    return c.json({ vehicle });
  } catch (error) {
    console.error("Get vehicle error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get vehicle" },
      500
    );
  }
});

// PUT /api/vehicles/:id - Update vehicle account
router.put("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("id");
    const updates = await c.req.json<Partial<db.VehicleAccount>>();

    // Encrypt sensitive fields if present
    if (updates.password_encrypted) {
      updates.password_encrypted = await encrypt(
        updates.password_encrypted,
        c.env.ENCRYPTION_KEY
      );
    }
    if (updates.pin_encrypted) {
      updates.pin_encrypted = await encrypt(
        updates.pin_encrypted,
        c.env.ENCRYPTION_KEY
      );
    }

    const vehicle = await db.updateVehicleAccount(
      vehicleId,
      userId,
      updates,
      c.env
    );

    return c.json({ vehicle });
  } catch (error) {
    console.error("Update vehicle error:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update vehicle",
      },
      500
    );
  }
});

// DELETE /api/vehicles/:id - Delete vehicle account
router.delete("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("id");
    await db.deleteVehicleAccount(vehicleId, userId, c.env);

    return c.json({});
  } catch (error) {
    console.error("Delete vehicle error:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete vehicle",
      },
      500
    );
  }
});

// POST /api/vehicles/:id/default - Set as default vehicle
router.post("/:id/default", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("id");
    await db.setDefaultVehicle(vehicleId, userId, c.env);

    return c.json({});
  } catch (error) {
    console.error("Set default vehicle error:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to set default vehicle",
      },
      500
    );
  }
});

// GET /api/vehicles/:id/status - Get live vehicle status
router.get("/:id/status", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const vehicleId = c.req.param("id");
    const status = await vehicleService.getVehicleStatus(
      vehicleId,
      userId,
      c.env
    );

    return c.json({ status });
  } catch (error) {
    console.error("Get status error:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to get status",
      },
      500
    );
  }
});

export default router;
