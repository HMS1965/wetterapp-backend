import { Router } from 'express';
import { parseWeatherQuery, generateWeatherAnswer } from '../services/claude.js';
import { geocodeCity, geocodeAddress, reverseGeocode } from '../services/openweather.js';
import { getWeatherData, iconForCode } from '../services/openmeteo.js';
import { getLocations } from '../db/database.js';

const router = Router();

router.post('/ask', async (req, res) => {
  const { question, profileId, gpsLat, gpsLon } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Frage fehlt' });

  try {
    // Load saved locations for this profile
    const savedLocations = profileId ? getLocations(Number(profileId)) : [];

    // Step 1: Parse the question with Claude Haiku
    const parsed = await parseWeatherQuery(question, savedLocations);

    // Step 2: Resolve location to lat/lon
    let lat, lon, locationName;

    if (parsed.location_type === 'gps') {
      if (!gpsLat || !gpsLon) {
        return res.status(400).json({ error: 'GPS-Standort nicht verfügbar. Bitte Standort-Zugriff erlauben.' });
      }
      lat = gpsLat;
      lon = gpsLon;
      locationName = await reverseGeocode(lat, lon);
    } else if (parsed.location_type === 'saved') {
      const savedLoc = savedLocations.find(l =>
        l.label === parsed.location_value?.toLowerCase().trim()
      );
      if (!savedLoc) {
        return res.status(404).json({ error: `Gespeicherter Ort "${parsed.location_value}" nicht gefunden.` });
      }
      if (savedLoc.lat && savedLoc.lon) {
        lat = savedLoc.lat;
        lon = savedLoc.lon;
        locationName = savedLoc.city;
      } else {
        const geo = await geocodeCity(savedLoc.city);
        lat = geo.lat;
        lon = geo.lon;
        locationName = geo.name;
      }
    } else if (parsed.location_type === 'address') {
      const geo = await geocodeAddress(parsed.location_value);
      lat = geo.lat;
      lon = geo.lon;
      locationName = parsed.location_value;
    } else {
      const geo = await geocodeCity(parsed.location_value);
      lat = geo.lat;
      lon = geo.lon;
      locationName = `${geo.name}, ${geo.country}`;
    }

    // Step 3: Get weather data
    const weatherData = await getWeatherData(lat, lon);

    // Step 4: Generate natural language answer with Claude Sonnet
    const answer = await generateWeatherAnswer(question, parsed, weatherData, locationName);

    // Icon: morgen → days[1], sonst heute
    const iconDay = parsed.date === 'tomorrow' ? weatherData.days[1] : weatherData.days[0];
    const iconName = iconDay?.icon ?? 'partly-cloudy-day';

    res.json({ answer, locationName, parsed, iconName });
  } catch (err) {
    console.error(err);
    const msg = err.message?.includes('nicht gefunden')
      ? 'Diesen Ort kenne ich leider nicht. Versuch es mit dem nächsten Stadtnamen.'
      : err.message || 'Interner Fehler';
    res.status(500).json({ error: msg });
  }
});

export default router;
