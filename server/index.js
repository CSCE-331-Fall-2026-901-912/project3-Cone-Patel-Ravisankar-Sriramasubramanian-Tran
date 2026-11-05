
import express from "express";
import cors from "cors";
import "dotenv/config";
import { testDatabaseConnection } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
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

app.listen(PORT, () => {
  console.log(`Boba Bliss API running on port ${PORT}`);
});
