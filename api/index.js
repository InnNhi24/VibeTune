const serverless = require('serverless-http');

let app;
try {
  const mod = require('../backend/dist/server');
  app = mod.default || mod.app || mod;
} catch (e) {
  module.exports = (req, res) => {
    res.statusCode = 500;
    res.end('Backend not built. Ensure backend/dist/server.js exists.');
  };
  return;
}

module.exports = (req, res) => serverless(app)(req, res);

