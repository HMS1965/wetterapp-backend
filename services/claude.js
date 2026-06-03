import dotenv from 'dotenv';
dotenv.config({ override: true });
import Anthropic from '@anthropic-ai/sdk';

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const PARSE_SYSTEM = `Du bist ein Wetter-Anfrage-Parser. Analysiere die Frage des Nutzers und extrahiere strukturierte Daten als JSON.

Gib IMMER valides JSON zurück, kein weiterer Text.

Schema:
{
  "location_type": "city" | "gps" | "saved" | "address",
  "location_value": "Stadtname, Adresse, oder gespeicherter Label-Name",
  "date": "today" | "tomorrow" | "YYYY-MM-DD" | "next_N_days:N",
  "time": "HH:MM" oder null,
  "aspects": ["rain", "temperature", "feels_like", "wind", "humidity", "general", "uv", "fog", "snow"],
  "decision": null | "umbrella" | "raincoat" | "awning" | "cycling" | "commute" | "outdoor_activity" | "other",
  "decision_label": null | "kurze Beschreibung was der Nutzer entscheiden will",
  "language": "de"
}

Regeln:
- "hier", "mein Standort", "bei mir", "wo ich bin" → location_type: "gps"
- Gespeicherte Orte wie "zuhause", "bei der Arbeit", "bei meinen Eltern" → location_type: "saved"
- Straßenadressen → location_type: "address"
- Stadtname → location_type: "city"
- Seen, Flüsse, Parks, Sehenswürdigkeiten, Strände → location_type: "city" mit der nächsten Stadt (z.B. "Unterbacher See" → "Düsseldorf", "Bodensee" → "Konstanz")
- Bei Aktivitäten (Fahrrad, Arbeit, Spaziergang) → passende decision setzen
- "nächste X Wochen" → maximal "next_N_days:10" und merke: mehr als 10 Tage sind nicht zuverlässig
- "schwül" → aspects: ["humidity", "temperature"]
- "gefühlte Temperatur" → aspects: ["feels_like", "temperature"]
- Kein date angegeben → "today"`;

const ANSWER_SYSTEM = `Du bist ein freundlicher Wetter-Assistent. Du antwortest natürlich und gesprächig auf Deutsch.

Regeln:
- Beantworte die Frage des Nutzers direkt und präzise
- Gib bei Entscheidungsfragen eine klare Empfehlung (Ja/Nein) + kurze Begründung
- Bei mehr als 10 Tagen: erkläre freundlich, dass Vorhersagen über 10 Tage unzuverlässig sind, und gib die verfügbaren 10 Tage
- Verwende natürliche Sprache, keine Tabellen oder Listen außer wenn wirklich hilfreich
- Sei prägnant: 2-4 Sätze reichen meist
- Erwähne konkrete Werte (Grad, %, km/h) wenn relevant
- Markisen-Empfehlung: einfahren wenn Windböen > 40 km/h oder starker Regen erwartet
- Fahrrad-Empfehlung: trocken wenn Regenwahrscheinlichkeit < 20% und Windstärke < 30 km/h
- KEIN Markdown: keine **Sterne**, keine Unterstriche, keine Rauten
- KEINE Emojis
- Keine Millimeter-Angaben (mm) — stattdessen "leichter Regen", "starker Regen" etc.
- Keine Abkürzungen außer Grad, Prozent, km/h`;

export async function parseWeatherQuery(question, savedLocations = []) {
  const savedLabels = savedLocations.map(l => l.label).join(', ');
  const contextNote = savedLabels
    ? `\nGespeicherte Orte dieses Nutzers: ${savedLabels}`
    : '';

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0.2,
    system: PARSE_SYSTEM + contextNote,
    messages: [{ role: 'user', content: question }]
  });

  const text = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

export async function generateWeatherAnswer(question, parsedQuery, weatherData, locationName) {
  // Wetterdaten kompakt formatieren — vorberechnet, kein Aggregieren durch das Modell
  const { current, days } = weatherData;
  const today = days[0];
  const tomorrow = days[1];

  const summary = `
Ort: ${locationName}
Zeitraum: ${parsedQuery.date}${parsedQuery.time ? ` um ${parsedQuery.time}` : ''}

Aktuell:
  Temperatur: ${current.temperature}°C (gefühlt ${current.feelsLike}°C)
  Luftfeuchtigkeit: ${current.humidity}%
  Wind: ${current.wind} km/h
  Zustand: ${current.condition}
  Regen jetzt: ${current.precipitation} mm

Heute (${today.date}):
  Min/Max: ${today.tempMin}°C / ${today.tempMax}°C (gefühlt ${today.feelsMin}–${today.feelsMax}°C)
  Regenwahrscheinlichkeit: ${today.rainProbability}%
  Regen gesamt: ${today.rainAmount} mm
  Windspitze: ${today.windMax} km/h
  Zustand: ${today.condition}

Morgen (${tomorrow.date}):
  Min/Max: ${tomorrow.tempMin}°C / ${tomorrow.tempMax}°C (gefühlt ${tomorrow.feelsMin}–${tomorrow.feelsMax}°C)
  Regenwahrscheinlichkeit: ${tomorrow.rainProbability}%
  Regen gesamt: ${tomorrow.rainAmount} mm
  Windspitze: ${tomorrow.windMax} km/h
  Zustand: ${tomorrow.condition}

Weitere Tage:
${days.slice(2).map(d =>
  `  ${d.date}: ${d.tempMin}–${d.tempMax}°C, Regen ${d.rainProbability}%, Wind ${d.windMax} km/h, ${d.condition}`
).join('\n')}
  `.trim();

  const context = `Nutzer-Frage: "${question}"\n\n${summary}`;

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    temperature: 0.2,
    system: ANSWER_SYSTEM,
    messages: [{ role: 'user', content: context }]
  });

  return message.content[0].text.trim();
}
