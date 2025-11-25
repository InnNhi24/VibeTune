import { Request, Response } from 'express';

// Import the serverless Vercel handler for /api/data
// The function exports a default handler: (req, res) => Promise<void>
// We dynamically require the file so ts-node can load the TS module.
const dataHandler = require('../../../api/data').default;

const dataProxy = async (req: Request, res: Response) => {
  try {
    // Delegate to the Vercel-style handler
    await dataHandler(req, res);
  } catch (err: any) {
    console.error('Error in data proxy:', err);
    res.status(500).json({ error: 'Data proxy error', details: err?.message || String(err) });
  }
};

export default dataProxy;
