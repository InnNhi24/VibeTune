import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoute from './routes/chat';
import placementScoreRoute from './routes/placementScore';
import eventsIngestRoute from './routes/eventsIngest';
import feedbackRoute from './routes/feedback';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(bodyParser.json());

app.post('/api/chat', chatRoute);
app.post('/api/placement-score', placementScoreRoute);
app.post('/api/events-ingest', eventsIngestRoute);
app.post('/api/feedback', feedbackRoute);

if (!process.env.VERCEL) {
  app.listen(process.env.PORT || 3000, () => console.log('Server running locally'));
}
export default app;

