import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event_type, metadata, user_id } = req.body;

    // Log analytics event (in production, save to database)
    console.log('Analytics event:', {
      event_type,
      metadata,
      user_id,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ 
      success: true,
      message: 'Event tracked successfully'
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: 'Failed to track event', 
      details: error.message 
    });
  }
}