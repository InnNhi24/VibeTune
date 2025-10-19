import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import chatRoute from './routes/chat';
import placementScoreRoute from './routes/placementScore';
import eventsIngestRoute from './routes/eventsIngest';
import feedbackRoute from './routes/feedback';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/chat', chatRoute);
app.post('/placement-score', placementScoreRoute);
app.post('/events-ingest', eventsIngestRoute);
app.post('/feedback', feedbackRoute);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

