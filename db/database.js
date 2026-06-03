import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'data.json');

function load() {
  if (!existsSync(DB_PATH)) {
    const initial = { profiles: [], locations: [], nextId: { profile: 1, location: 1 } };
    writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function save(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function getProfiles() {
  return load().profiles;
}

export function createProfile(name) {
  const data = load();
  if (data.profiles.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Name bereits vergeben');
  }
  const profile = { id: data.nextId.profile++, name, created_at: new Date().toISOString() };
  data.profiles.push(profile);
  save(data);
  return profile;
}

export function deleteProfile(id) {
  const data = load();
  data.profiles = data.profiles.filter(p => p.id !== id);
  data.locations = data.locations.filter(l => l.profile_id !== id);
  save(data);
}

export function getLocations(profileId) {
  return load().locations.filter(l => l.profile_id === profileId);
}

export function createLocation(profileId, { label, city, address, lat, lon }) {
  const data = load();
  const labelNorm = label.toLowerCase().trim();
  if (data.locations.find(l => l.profile_id === profileId && l.label === labelNorm)) {
    throw new Error('Label bereits vergeben');
  }
  const loc = {
    id: data.nextId.location++,
    profile_id: profileId,
    label: labelNorm,
    city,
    address: address || null,
    lat: lat || null,
    lon: lon || null
  };
  data.locations.push(loc);
  save(data);
  return loc;
}

export function deleteLocation(profileId, locId) {
  const data = load();
  data.locations = data.locations.filter(l => !(l.id === locId && l.profile_id === profileId));
  save(data);
}
