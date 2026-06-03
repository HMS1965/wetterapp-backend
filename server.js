import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import cors from 'cors';
import weatherRoutes from './routes/weather.js';
import profileRoutes from './routes/profiles.js';
import ttsRoutes from './routes/tts.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/weather', weatherRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/tts', ttsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`WetterApp Backend läuft auf Port ${PORT}`);
});
