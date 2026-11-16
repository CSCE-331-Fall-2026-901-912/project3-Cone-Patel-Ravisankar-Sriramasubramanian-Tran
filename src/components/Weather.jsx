import { useEffect, useState } from "react";
import "./Weather.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const REFRESH_MS = 15 * 60 * 1000;

// Loads GET /api/weather and refreshes it every 15 minutes.
function useWeather() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`${API_URL}/api/weather`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Weather is unavailable");
        if (!cancelled) {
          setWeather(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return { weather, error };
}

// Kiosk banner: current weather plus a drink suggestion.
// Hides itself if the weather can't be loaded so customers never see an error.
export function WeatherBanner({ t = (text) => text }) {
  const { weather } = useWeather();
  if (!weather) return null;

  const { current, suggestion, units } = weather;
  return (
    <aside className="weather-banner" aria-label={t("Today's weather")}>
      <span className="weather-banner-icon" aria-hidden="true">
        {current.icon}
      </span>
      <span className="weather-banner-temp">
        {current.temperature}
        {units}
      </span>
      <span className="weather-banner-condition">{t(current.condition)}</span>
      <span className="weather-banner-suggestion">{t(suggestion)}</span>
    </aside>
  );
}

// Manager panel: today's conditions and the 5-day forecast for planning.
export function WeatherForecast() {
  const { weather, error } = useWeather();

  return (
    <section className="panel weather-forecast">
      <h2>Weather forecast</h2>
      {!weather && !error && (
        <p className="muted" role="status">
          Loading forecast…
        </p>
      )}
      {!weather && error && <p className="muted">{error}.</p>}
      {weather && (
        <>
          <p className="weather-now">
            <span aria-hidden="true">{weather.current.icon}</span> {weather.current.temperature}
            {weather.units} and {weather.current.condition.toLowerCase()} in {weather.location} · feels like{" "}
            {weather.current.feelsLike}
            {weather.units}
          </p>
          <ol className="weather-days">
            {weather.daily.map((day, i) => (
              <li key={day.date} className="weather-day">
                <span className="weather-day-name">{i === 0 ? "Today" : dayName(day.date)}</span>
                <span className="weather-day-icon" aria-hidden="true">
                  {day.icon}
                </span>
                <span className="visually-hidden">{day.condition}, </span>
                <span className="weather-day-temps">
                  <strong>{day.high}°</strong> / {day.low}°
                </span>
                {day.precipitationChance != null && (
                  <span className="weather-day-rain">{day.precipitationChance}% rain</span>
                )}
              </li>
            ))}
          </ol>
          {weather.stale && <p className="muted small">Showing the last available forecast.</p>}
        </>
      )}
    </section>
  );
}

function dayName(isoDate) {
  // Parse as a local date so the weekday doesn't shift with time zones.
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { weekday: "short" });
}
