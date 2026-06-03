import fetch from 'node-fetch';

const BASE = 'https://api.openweathermap.org';
const KEY = process.env.OPENWEATHER_API_KEY;

async function tryGeocode(q) {
  const url = `${BASE}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.length ? { lat: data[0].lat, lon: data[0].lon, name: data[0].name, country: data[0].country } : null;
}

// Nominatim (OpenStreetMap): kennt deutsche Ortsteile, Dörfer UND versteht Zusätze wie
// "im Odenwald" → löst Mehrdeutigkeiten, die OpenWeatherMaps Geocoder falsch rät.
async function geocodeNominatim(input) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=1&addressdetails=1&accept-language=de`;
  const res = await fetch(url, { headers: { 'User-Agent': 'WetterApp/1.0 (private Wetter-App)' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  const it = data[0];
  const a = it.address || {};
  const name = it.name || a.suburb || a.village || a.town || a.city || a.municipality || (it.display_name || '').split(',')[0];
  return { lat: parseFloat(it.lat), lon: parseFloat(it.lon), name, country: (a.country_code || '').toUpperCase() };
}

// Löst einen Ort auf: erst Nominatim (kennt Ortsteile + versteht Zusätze wie "im Odenwald"),
// dann als Rückfall OpenWeatherMap mit Kandidaten-Zerlegung (voller Name, Bindestrich→Leerzeichen,
// einzelne Teile) für den Fall, dass Nominatim mal nicht erreichbar ist.
async function resolveLocation(input) {
  try {
    const nom = await geocodeNominatim(input);
    if (nom) return nom;
  } catch { /* Nominatim nicht erreichbar → OWM-Rückfall */ }

  const candidates = [input.trim()];
  if (/[-/,]/.test(input)) {
    candidates.push(input.replace(/[-/]/g, ' ').trim());
    input.split(/[-/,]/).forEach(part => {
      const t = part.trim();
      if (t) candidates.push(t);
    });
  }
  const seen = new Set();
  for (const q of candidates) {
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    const hit = await tryGeocode(q);
    if (hit) return hit;
  }
  return null;
}

export async function geocodeCity(city) {
  const hit = await resolveLocation(city);
  if (!hit) throw new Error(`Stadt nicht gefunden: ${city}`);
  return hit;
}

export async function geocodeAddress(address) {
  const hit = await resolveLocation(address);
  if (!hit) throw new Error(`Adresse nicht gefunden: ${address}`);
  return { lat: hit.lat, lon: hit.lon, name: hit.name };
}

export async function reverseGeocode(lat, lon) {
  const url = `${BASE}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data[0]?.name || 'deinem Standort';
}

export async function getCurrentWeather(lat, lon) {
  const url = `${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric&lang=de`;
  const res = await fetch(url);
  return res.json();
}

export async function getForecast(lat, lon) {
  // 5-day forecast with 3-hour intervals
  const url = `${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric&lang=de`;
  const res = await fetch(url);
  return res.json();
}

export async function getWeatherData(lat, lon) {
  const [current, forecast] = await Promise.all([
    getCurrentWeather(lat, lon),
    getForecast(lat, lon)
  ]);
  return { current, forecast };
}
