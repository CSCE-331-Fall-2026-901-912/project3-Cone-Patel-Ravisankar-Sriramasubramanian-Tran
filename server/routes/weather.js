import { Router } from "express";

// SCRUM-58: Weather forecast for the shop's location.
// Primary source: Open-Meteo (https://open-meteo.com), free and needs no API key.
// Backup source: U.S. National Weather Service (https://www.weather.gov/documentation/services-web-api),
// also free with no key. Open-Meteo limits requests per IP address, and shared
// hosting like Render's free tier can hit that limit. While Open-Meteo is
// rate-limiting us (or down), the forecast comes from NWS instead.
// Defaults to College Station, TX; override with WEATHER_LAT / WEATHER_LON.
const router = Router();

const LOCATION = {
  name: process.env.WEATHER_LOCATION_NAME || "College Station, TX",
  latitude: Number(process.env.WEATHER_LAT || 30.628),
  longitude: Number(process.env.WEATHER_LON || -96.3344),
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const NWS_URL = "https://api.weather.gov";
// NWS asks every app to identify itself in the User-Agent header.
const NWS_HEADERS = {
  "User-Agent": "BobaBlissPOS/1.0 (CSCE 331 student project)",
  Accept: "application/geo+json",
};

const CACHE_MS = 15 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000; // how long to skip Open-Meteo after it fails
const ALL_FAILED_RETRY_MS = 2 * 60 * 1000; // both sources failed: short pause before trying again
const FORECAST_DAYS = 5;

let cache = null;
let pendingFetch = null;
let openMeteoRetryAfter = 0; // skip Open-Meteo until this time (rate limit cooldown)
let retryAfter = 0; // skip every source until this time (both failed)
let nwsForecastUrls = null; // the NWS grid lookup never changes for a location, so remember it

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

// NWS describes weather in words ("Chance Showers And Thunderstorms").
// Convert that to the matching weather code so both sources look the same.
function codeFromText(text = "") {
  const t = text.toLowerCase();
  if (t.includes("thunder")) return 95;
  if (t.includes("snow") || t.includes("sleet") || t.includes("flurr") || t.includes("ice")) return 71;
  if (t.includes("drizzle")) return 51;
  if (t.includes("rain") || t.includes("shower")) return 61;
  if (t.includes("fog") || t.includes("haze") || t.includes("smoke")) return 45;
  if (t.includes("partly") || t.includes("mostly sunny") || t.includes("mostly clear")) return 2;
  if (t.includes("cloud") || t.includes("overcast")) return 3;
  return 0; // sunny / clear
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

function buildResult({ temperature, feelsLike, code, daily, source }) {
  return {
    location: LOCATION.name,
    units: "°F",
    current: { temperature, feelsLike, code, ...describe(code) },
    daily,
    suggestion: suggestDrink(temperature, code),
    source,
    updatedAt: new Date().toISOString(),
  };
}

// GET a JSON URL with an 8-second timeout. Failed responses throw an error that
// carries the HTTP status and Retry-After header.
async function getJson(url, options = {}) {
  const source = new URL(url).hostname;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const retryAfterHeader = response.headers.get("retry-after");

      console.error(`${source} error details:`, {
        status: response.status,
        retryAfter: retryAfterHeader,
        body: errorBody.slice(0, 500),
      });

      const error = new Error(`${source} responded with ${response.status}`);
      error.status = response.status;
      error.retryAfter = retryAfterHeader;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`${source} timed out`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fromOpenMeteo() {
  const params = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    current: "temperature_2m,apparent_temperature,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone: "America/Chicago",
    forecast_days: String(FORECAST_DAYS),
  });
  const raw = await getJson(`${FORECAST_URL}?${params}`);

  return buildResult({
    temperature: Math.round(raw.current.temperature_2m),
    feelsLike: Math.round(raw.current.apparent_temperature),
    code: raw.current.weather_code,
    daily: raw.daily.time.map((date, i) => ({
      date,
      high: Math.round(raw.daily.temperature_2m_max[i]),
      low: Math.round(raw.daily.temperature_2m_min[i]),
      precipitationChance: raw.daily.precipitation_probability_max[i] ?? null,
      code: raw.daily.weather_code[i],
      ...describe(raw.daily.weather_code[i]),
    })),
    source: "Open-Meteo",
  });
}

function toFahrenheit(temperature, unit) {
  return unit === "C" ? Math.round((temperature * 9) / 5 + 32) : Math.round(temperature);
}

async function fromNationalWeatherService() {
  if (!nwsForecastUrls) {
    const point = await getJson(
      `${NWS_URL}/points/${LOCATION.latitude.toFixed(4)},${LOCATION.longitude.toFixed(4)}`,
      { headers: NWS_HEADERS }
    );
    nwsForecastUrls = {
      daily: point.properties.forecast,
      hourly: point.properties.forecastHourly,
    };
  }

  const [hourly, daily] = await Promise.all([
    getJson(nwsForecastUrls.hourly, { headers: NWS_HEADERS }),
    getJson(nwsForecastUrls.daily, { headers: NWS_HEADERS }),
  ]);

  const now = hourly.properties.periods[0];
  const temperature = toFahrenheit(now.temperature, now.temperatureUnit);

  // NWS splits each day into a daytime and a nighttime period; combine them per date.
  const days = new Map();
  for (const period of daily.properties.periods) {
    const date = period.startTime.slice(0, 10); // local date, e.g. "2026-11-16"
    const temp = toFahrenheit(period.temperature, period.temperatureUnit);
    const rain = period.probabilityOfPrecipitation?.value ?? null;
    const day = days.get(date) || { date, high: null, low: null, precipitationChance: null, text: null };

    if (period.isDaytime) {
      day.high = temp;
      day.text = period.shortForecast;
    } else {
      day.low = temp;
      day.text = day.text || period.shortForecast; // tonight-only first day
    }
    if (rain != null) day.precipitationChance = Math.max(day.precipitationChance ?? 0, rain);
    days.set(date, day);
  }

  const dailyList = [...days.values()].slice(0, FORECAST_DAYS).map((day) => {
    const code = codeFromText(day.text);
    return {
      date: day.date,
      // Late in the day only the night period is left; use it for both.
      high: day.high ?? day.low,
      low: day.low ?? day.high,
      precipitationChance: day.precipitationChance,
      code,
      ...describe(code),
    };
  });

  const code = codeFromText(now.shortForecast);
  return buildResult({
    temperature,
    feelsLike: temperature, // NWS hourly forecasts don't include a "feels like" value
    code,
    daily: dailyList,
    source: "National Weather Service",
  });
}

// Try Open-Meteo unless it's cooling down after a rate limit, then fall back to NWS.
async function fetchForecast() {
  if (Date.now() >= openMeteoRetryAfter) {
    try {
      const data = await fromOpenMeteo();
      openMeteoRetryAfter = 0;
      return data;
    } catch (error) {
      // Respect Open-Meteo's Retry-After header when it rate-limits us (429).
      const retrySeconds = Number(error.retryAfter);
      const cooldownMs =
        error.status === 429 && Number.isFinite(retrySeconds) && retrySeconds > 0
          ? Math.max(RETRY_MS, retrySeconds * 1000)
          : RETRY_MS;
      openMeteoRetryAfter = Date.now() + cooldownMs;
      console.error(
        `Weather fetch failed (Open-Meteo): ${error.message}. Using National Weather Service for ${Math.round(cooldownMs / 60000)} min.`
      );
    }
  }
  return fromNationalWeatherService();
}

// GET /api/weather - current conditions, 5-day forecast, and a drink suggestion
router.get("/", async (req, res) => {
  const now = Date.now();

  // Return cached data if still fresh
  if (cache && now - cache.fetchedAt < CACHE_MS) {
    return res.json({ ...cache.data, stale: false });
  }

  // Both sources failed moments ago; wait before trying again
  if (now < retryAfter) {
    if (cache) {
      return res.json({ ...cache.data, stale: true });
    }

    return res.status(503).json({
      error: "Weather is temporarily unavailable",
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
      fetchedAt: Date.now(),
    };

    retryAfter = 0;

    return res.json({ ...data, stale: false });
  } catch (error) {
    console.error("Weather fetch failed (all sources):", error.message);

    retryAfter = Date.now() + ALL_FAILED_RETRY_MS;

    if (cache) {
      return res.json({ ...cache.data, stale: true });
    }

    return res.status(502).json({
      error: "Weather is unavailable right now",
    });
  }
});

export default router;
