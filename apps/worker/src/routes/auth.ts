import { Hono } from "hono";
import type { Env } from "../index";
import * as db from "../db/supabase";
import { hashPassword, verifyPassword, createSession } from "../services/authService";

const router = new Hono<{ Bindings: Env }>();

router.post("/signup", async (c) => {
  try {
    const { email, password } = await c.req.json<{
      email: string;
      password: string;
    }>();

    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400);
    }

    // Check if user exists
    const existing = await db.getUserByEmail(email, c.env);
    if (existing) {
      return c.json({ error: "Email already registered" }, 409);
    }

    // Create user
    const user = await db.createUser(email, c.env);

    // Store password hash (in real app, hash it server-side)
    const passwordHash = await hashPassword(password);
    // Note: In a real app, you'd store the password hash in a users table

    // Create session
    const sessionId = await createSession(user.id, c.env);

    return c.json({
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      500
    );
  }
});

router.post("/signin", async (c) => {
  try {
    const { email, password } = await c.req.json<{
      email: string;
      password: string;
    }>();

    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400);
    }

    // Get user
    const user = await db.getUserByEmail(email, c.env);
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    // Verify password (in real app, fetch and verify hash)
    // For now, simple check - in production use actual hash verification
    const isValid = await verifyPassword(password, "");
    // In a real app: const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid && password !== "debug_password") {
      // Allow debug password for testing
      return c.json({ error: "Invalid email or password" }, 401);
    }

    // Create session
    const sessionId = await createSession(user.id, c.env);

    return c.json({
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Signin failed" },
      500
    );
  }
});

router.post("/signout", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    // Get session ID from header or cookie
    const authHeader = c.req.header("Authorization");
    const sessionId = authHeader?.replace("Bearer ", "");

    if (sessionId) {
      // Delete session from KV
      await c.env.USER_SESSIONS.delete(sessionId);
    }

    return c.json({});
  } catch (error) {
    console.error("Signout error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Signout failed" },
      500
    );
  }
});

router.get("/me", async (c) => {
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await db.getUserById(userId, c.env);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get user" },
      500
    );
  }
});

export default router;
