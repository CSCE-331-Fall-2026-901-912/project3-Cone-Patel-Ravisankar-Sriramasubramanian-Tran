import { Router } from "express";

// SCRUM-58: Weather forecast for the shop's location.
// Uses Open-Meteo (https://open-meteo.com), which is free and needs no API key.
// Defaults to College Station, TX; override with WEATHER_LAT / WEATHER_LON.
const router = Router();

const LOCATION = {
  name: process.env.WEATHER_LOCATION_NAME || "College Station, TX",
  latitude: Number(process.env.WEATHER_LAT || 30.628),
  longitude: Number(process.env.WEATHER_LON || -96.3344),
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_MS = 15 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

let cache = null;
let pendingFetch = null;
let retryAfter = 0;

// WMO weather codes used by Open-Meteo -> readable label and icon.
// https://open-meteo.com/en/docs#weathervariables
function describe(code) {
  if (code === 0) return { condition: "Clear", icon: "☀️" };
  if (code <= 2) return { condition: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { condition: "Cloudy", icon: "☁️" };
  if (code === 45 || code === 48) return { condition: "Foggy", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { condition: "Drizzle", icon: "🌦️" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { condition: "Rain", icon: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: "Snow", icon: "❄️" };
  if (code >= 95) return { condition: "Thunderstorms", icon: "⛈️" };
  return { condition: "Unknown", icon: "🌡️" };
}

function isWet(code) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

// A drink suggestion the kiosk can show based on the current weather.
function suggestDrink(temperature, code) {
  if (isWet(code)) return "Rainy day? Warm up with a cozy milk tea.";
  if (temperature >= 85) return "It's hot out! Cool off with an iced fruit tea.";
  if (temperature <= 55) return "Chilly today. A warm milk tea hits the spot.";
  return "Perfect weather for a classic milk tea.";
}

async function fetchForecast() {
  const params = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    current: "temperature_2m,apparent_temperature,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone: "America/Chicago",
    forecast_days: "5",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${FORECAST_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) {
      const errorBody = await response.text();
      const retryAfter = response.headers.get("retry-after");

      console.error("Open-Meteo error details:", {
        status: response.status,
        retryAfter,
        body: errorBody.slice(0, 500)
      });

      const error = new Error(
        `Open-Meteo responded with ${response.status}`
      );

      error.status = response.status;
      error.retryAfter = retryAfter;

      throw error;
    }
    const raw = await response.json();

    const temperature = Math.round(raw.current.temperature_2m);
    const code = raw.current.weather_code;

    return {
      location: LOCATION.name,
      units: "°F",
      current: {
        temperature,
        feelsLike: Math.round(raw.current.apparent_temperature),
        code,
        ...describe(code),
      },
      daily: raw.daily.time.map((date, i) => ({
        date,
        high: Math.round(raw.daily.temperature_2m_max[i]),
        low: Math.round(raw.daily.temperature_2m_min[i]),
        precipitationChance: raw.daily.precipitation_probability_max[i] ?? null,
        code: raw.daily.weather_code[i],
        ...describe(raw.daily.weather_code[i]),
      })),
      suggestion: suggestDrink(temperature, code),
      updatedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/weather - current conditions, 5-day forecast, and a drink suggestion
router.get("/", async (req, res) => {
  const now = Date.now();

  // Return cached data if still fresh
  if (cache && now - cache.fetchedAt < CACHE_MS) {
    return res.json({ ...cache.data, stale: false });
  }

  // Don't retry while Open-Meteo is rate-limiting us
  if (now < retryAfter) {
    if (cache) {
      return res.json({ ...cache.data, stale: true });
    }

    return res.status(503).json({
      error: "Weather is temporarily unavailable"
    });
  }

  try {
    // Share one API request across simultaneous visitors
    if (!pendingFetch) {
      pendingFetch = fetchForecast().finally(() => {
        pendingFetch = null;
      });
    }

    const data = await pendingFetch;

    cache = {
      data,
      fetchedAt: Date.now()
    };

    retryAfter = 0;

    return res.json({ ...data, stale: false });

  } catch (error) {
    console.error("Weather fetch failed:", error.message);

    const retrySeconds = Number(error.retryAfter);

    const cooldownMs =
      error.status === 429 &&
      Number.isFinite(retrySeconds) &&
      retrySeconds > 0
        ? Math.max(RETRY_MS, retrySeconds * 1000)
        : RETRY_MS;

    retryAfter = Date.now() + cooldownMs;

    if (cache) {
      return res.json({ ...cache.data, stale: true });
    }

    return res.status(502).json({
      error: "Weather is unavailable right now"
    });
  }
});

export default router;
