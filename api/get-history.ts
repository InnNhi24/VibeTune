import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Since we're using local store primarily, we'll return a success response
    // The frontend will use its local store data
    // In production, this would fetch from Supabase and merge with local data
    const response = {
      conversations: [],
      messages: [],
      success: true,
      message: 'Using local store data'
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Get history error:', error);
    return res.status(500).json({ 
      error: 'Failed to get history', 
      details: error.message 
    });
  }
}