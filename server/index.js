
import express from "express";
import cors from "cors";
import "dotenv/config";
import { pool, testDatabaseConnection } from "./db.js";
import inventoryRoutes from "./routes/inventory.js";
import session from "express-session";
import authRoutes from "./routes/auth.js";
import connectPgSimple from "connect-pg-simple";
import ordersRouter from "./routes/orders.js";

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

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Boba Bliss API</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            max-width: 650px;
            margin: 80px auto;
            padding: 0 24px;
            background: #faf7f2;
            color: #44352e;
          }
          h1 { color: #674936; }
          a { color: #8a6045; }
          li { margin: 18px 0; }
        </style>
      </head>
      <body>
        <h1>Boba Bliss API</h1>
        <p>Backend service is running.</p>
        <h2>Available Endpoints</h2>
        <ul>
          <li>
            <a href="/api/health/database">Database Health</a>
            — Check PostgreSQL connection
          </li>
          <li>
            <a href="/api/auth/google">Google Login</a>
            — Start Google authentication
          </li>
          <li>
            <a href="/api/auth/me">Current Session</a>
            — Check logged-in user
          </li>
        </ul>
        <p>
          <a href="https://boba-bliss.onrender.com">
            Open Boba Bliss Frontend
          </a>
        </p>
      </body>
    </html>
  `);
});
app.use("/api/orders", ordersRouter);
app.listen(PORT, () => {
  console.log(`Boba Bliss API running on port ${PORT}`);
});
