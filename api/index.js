const serverless = require('serverless-http');

// Import the backend app
let app;
try {
  app = require('../backend/dist/index.js').default || require('../backend/dist/index.js');
} catch (error) {
  console.error('Failed to load backend app:', error);
  // Create a minimal fallback app
  const express = require('express');
  app = express();
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend not loaded' });
  });
}

module.exports = serverless(app);

