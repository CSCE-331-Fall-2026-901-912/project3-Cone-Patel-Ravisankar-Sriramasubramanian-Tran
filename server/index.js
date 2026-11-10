
import express from "express";
import cors from "cors";
import "dotenv/config";
import { pool, testDatabaseConnection } from "./db.js";
import inventoryRoutes from "./routes/inventory.js";
import session from "express-session";
import authRoutes from "./routes/auth.js";
import connectPgSimple from "connect-pg-simple";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Boba Bliss API",
  });
});

app.get("/api/health/database", async (req, res) => {
  try {
    const result = await testDatabaseConnection();

    res.json({
      status: "connected",
      database: result.database,
      serverTime: result.server_time,
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);

    res.status(503).json({
      status: "disconnected",
      message: "Unable to connect to PostgreSQL",
    });
  }
});

// GET /api/menu - Retrieve all menu items
app.get("/api/menu", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        menu_id,
        item_name,
        category,
        price,
        availability
      FROM menu
      ORDER BY category, item_name
    `);

    res.json({
      items: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch menu:", error.message);

    res.status(500).json({
      error: "Unable to retrieve menu items",
    });
  }
});

app.use("/api/inventory", inventoryRoutes);

const PgSession = connectPgSimple(session);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}

app.use(
  session({
    name: "bobabliss.sid",
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);


function requireTrustedOrigin(req, res, next) {
  const allowedOrigin =
    process.env.CLIENT_ORIGIN || "http://localhost:5173";

  const origin = req.get("Origin");

  if (origin !== allowedOrigin) {
    return res.status(403).json({
      error: "Forbidden origin",
    });
  }

  next();
}

app.use("/api/auth/logout", requireTrustedOrigin);
app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`Boba Bliss API running on port ${PORT}`);
});
