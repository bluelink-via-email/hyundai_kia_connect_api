import { Hono } from "hono";
import type { Env } from "../index";
import * as db from "../db/supabase";

const router = new Hono<{ Bindings: Env }>();

// GET /api/custom-commands - List custom commands
router.get("/", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const commands = await db.getCustomCommands(userId, c.env);
    return c.json({ commands });
  } catch (error) {
    console.error("Get custom commands error:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get custom commands",
      },
      500
    );
  }
});

// POST /api/custom-commands - Create custom command
router.post("/", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const { alias, command } = await c.req.json<{
      alias: string;
      command: Record<string, unknown>;
    }>();

    if (!alias || !command) {
      return c.json({ error: "Alias and command required" }, 400);
    }

    const commandJson = JSON.stringify(command);
    const customCommand = await db.createCustomCommand(
      userId,
      alias,
      commandJson,
      c.env
    );

    return c.json({ customCommand }, 201);
  } catch (error) {
    console.error("Create custom command error:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create custom command",
      },
      500
    );
  }
});

// DELETE /api/custom-commands/:id - Delete custom command
router.delete("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const customCommandId = c.req.param("id");
    await db.deleteCustomCommand(customCommandId, userId, c.env);

    return c.json({});
  } catch (error) {
    console.error("Delete custom command error:", error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete custom command",
      },
      500
    );
  }
});

export default router;
