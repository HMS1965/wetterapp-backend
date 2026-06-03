import fetch from 'node-fetch';

// Open-Meteo: kostenlos, kein API-Key, DWD/ICON-Modell für Deutschland und Europa.
// Liefert fertige Tageswerte (Min/Max, Regen, Wind) — kein Raten durch das Modell nötig.
// Docs: https://open-meteo.com/en/docs

const BASE = 'https://api.open-meteo.com/v1/forecast';

// WMO-Wettercodes → lesbare deutsche Bezeichnung
function describeWeatherCode(code) {
  if (code === 0) return 'Klarer Himmel';
  if (code <= 2) return 'Überwiegend klar';
  if (code === 3) return 'Bedeckt';
  if (code <= 48) return 'Neblig';
  if (code <= 57) return 'Leichter Nieselregen';
  if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Regenschauer';
  if (code <= 86) return 'Schneeschauer';
  if (code <= 99) return 'Gewitter';
  return 'Unbekannt';
}

function isRainy(code) {
  return code >= 51;
}

export function iconForCode(code) {
  if (code === 0)            return 'clear-day';
  if (code <= 2)             return 'partly-cloudy-day';
  if (code === 3)            return 'overcast-day';
  if (code <= 48)            return 'fog';
  if (code <= 57)            return 'drizzle';
  if (code <= 67)            return 'rain';
  if (code <= 77)            return 'snow';
  if (code <= 82)            return 'rain';
  if (code <= 86)            return 'snow';
  if (code === 95)           return 'thunderstorms';
  if (code <= 99)            return 'thunderstorms-rain';
  return 'cloudy';
}

export async function getWeatherData(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weathercode,windspeed_10m,precipitation',
    daily: [
      'weathercode',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'windspeed_10m_max',
    ].join(','),
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    forecast_days: 10,
  });

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo Fehler: ${res.status}`);
  const raw = await res.json();

  // Aktuelles Wetter
  const c = raw.current;
  const current = {
    temperature: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m),
    wind: Math.round(c.windspeed_10m),
    condition: describeWeatherCode(c.weathercode),
    isRainy: isRainy(c.weathercode),
    precipitation: c.precipitation,
  };

  // Tageswerte vorberechnet — Claude bekommt fertige Werte, muss nichts aggregieren
  const d = raw.daily;
  const days = d.time.map((date, i) => ({
    date,
    condition: describeWeatherCode(d.weathercode[i]),
    icon: iconForCode(d.weathercode[i]),
    isRainy: isRainy(d.weathercode[i]),
    tempMax: Math.round(d.temperature_2m_max[i]),
    tempMin: Math.round(d.temperature_2m_min[i]),
    feelsMax: Math.round(d.apparent_temperature_max[i]),
    feelsMin: Math.round(d.apparent_temperature_min[i]),
    rainProbability: d.precipitation_probability_max[i],    // Prozent
    rainAmount: Math.round(d.precipitation_sum[i] * 10) / 10, // mm, 1 Nachkommastelle
    windMax: Math.round(d.windspeed_10m_max[i]),
  }));

  return { current, days };
}
