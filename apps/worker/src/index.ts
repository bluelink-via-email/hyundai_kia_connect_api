import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/cloudflare-workers";
import { getSession } from "./services/authService";
import { handleIncomingEmail } from "./email/handler";
import authRoutes from "./routes/auth";
import vehicleRoutes from "./routes/vehicles";
import commandRoutes from "./routes/commands";
import historyRoutes from "./routes/history";
import customCommandRoutes from "./routes/customCommands";
import settingsRoutes from "./routes/settings";

export interface Env {
  // KV namespaces
  VEHICLE_TOKENS: KVNamespace;
  USER_SESSIONS: KVNamespace;

  // Secrets
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENCRYPTION_KEY: string;
  SESSION_SECRET: string;
  EMAIL_FROM: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://hyundai-kia.app",
      "https://www.hyundai-kia.app",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Client-Info",
      "Apikey",
    ],
    credentials: true,
  })
);

// Auth middleware - extract and validate session
app.use("*", async (c, next) => {
  // Skip auth middleware for public routes
  const path = new URL(c.req.url).pathname;
  const publicRoutes = ["/api/auth/signup", "/api/auth/signin"];

  if (publicRoutes.includes(path)) {
    return next();
  }

  // Extract session ID from Authorization header or cookie
  const authHeader = c.req.header("Authorization");
  let sessionId: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    sessionId = authHeader.substring(7);
  } else {
    const cookieHeader = c.req.header("Cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === "sessionId") {
          sessionId = decodeURIComponent(value);
          break;
        }
      }
    }
  }

  if (sessionId) {
    const session = await getSession(sessionId, c.env);
    if (session) {
      c.set("userId", session.userId);
      c.set("sessionId", sessionId);
    }
  }

  return next();
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/vehicles", vehicleRoutes);
app.route("/api/commands", commandRoutes);
app.route("/api/history", historyRoutes);
app.route("/api/custom-commands", customCommandRoutes);
app.route("/api/settings", settingsRoutes);

// Email handler
app.post("/email", async (c) => {
  try {
    const message = await c.req.json();
    // The email message would come from Cloudflare Email Routing
    // This endpoint is called via the email binding
    await handleIncomingEmail(message, c.env);
    return c.json({ success: true });
  } catch (error) {
    console.error("Email handler error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Email processing failed" },
      500
    );
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    { error: err instanceof Error ? err.message : "Internal server error" },
    500
  );
});

export default app;
