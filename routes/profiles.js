import { Router } from 'express';
import { getProfiles, createProfile, deleteProfile, getLocations, createLocation, deleteLocation } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getProfiles());
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  try {
    res.json(createProfile(name.trim()));
  } catch (e) {
    res.status(409).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  deleteProfile(Number(req.params.id));
  res.json({ ok: true });
});

router.get('/:id/locations', (req, res) => {
  res.json(getLocations(Number(req.params.id)));
});

router.post('/:id/locations', (req, res) => {
  const { label, city, address, lat, lon } = req.body;
  if (!label || !city) return res.status(400).json({ error: 'Label und Stadt erforderlich' });
  try {
    res.json(createLocation(Number(req.params.id), { label, city, address, lat, lon }));
  } catch (e) {
    res.status(409).json({ error: e.message });
  }
});

router.delete('/:id/locations/:locId', (req, res) => {
  deleteLocation(Number(req.params.id), Number(req.params.locId));
  res.json({ ok: true });
});

export default router;
