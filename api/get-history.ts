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
    // Get user ID from Authorization header
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // In a real app, you'd decode the JWT token here
      // For now, we'll try to get user info from the token
      try {
        const token = authHeader.substring(7);
        // Simple token parsing - in production use proper JWT verification
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = payload.sub || payload.user_id;
      } catch (e) {
        console.warn('Failed to parse token:', e);
      }
    }

    // Try to fetch from Supabase if configured
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    let conversations = [];
    let messages = [];
    
    if (SUPABASE_URL && SUPABASE_KEY && userId) {
      try {
        const supabaseHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY
        };

        // Fetch conversations
        const convResponse = await fetch(`${SUPABASE_URL}/rest/v1/conversations?profile_id=eq.${userId}&order=started_at.desc&limit=50`, {
          headers: supabaseHeaders
        });
        
        if (convResponse.ok) {
          conversations = await convResponse.json();
        }

        // Fetch recent messages for active conversations
        if (conversations.length > 0) {
          const conversationIds = conversations.slice(0, 10).map(c => c.id).join(',');
          const msgResponse = await fetch(`${SUPABASE_URL}/rest/v1/messages?conversation_id=in.(${conversationIds})&order=created_at.asc&limit=1000`, {
            headers: supabaseHeaders
          });
          
          if (msgResponse.ok) {
            messages = await msgResponse.json();
          }
        }
        
        console.log(`Fetched ${conversations.length} conversations and ${messages.length} messages for user ${userId}`);
      } catch (error) {
        console.error('Supabase fetch error:', error);
        // Continue with empty data rather than failing
      }
    }

    const response = {
      conversations,
      messages,
      success: true,
      message: conversations.length > 0 ? 'Data loaded from database' : 'Using local store data'
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