import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import chatRoute from './routes/chat';
import placementScoreRoute from './routes/placementScore';
import eventsIngestRoute from './routes/eventsIngest';
import feedbackRoute from './routes/feedback';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(bodyParser.json());

app.post('/api/chat', chatRoute);
app.post('/api/placement-score', placementScoreRoute);
app.post('/api/events-ingest', eventsIngestRoute);
app.post('/api/feedback', feedbackRoute);

const frontendPath = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendPath));
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    next();
  }
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
export default app;

