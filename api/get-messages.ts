import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

  // Check if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ 
      error: 'Database not configured',
      messages: []
    });
  }

  try {
    const { conversation_id, profile_id } = req.query;
    
    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id is required' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let query = supabase
      .from('messages')
      .select('*')
      .eq('profile_id', profile_id)
      .order('created_at', { ascending: true });

    // Filter by conversation if specified
    if (conversation_id) {
      query = query.eq('conversation_id', conversation_id);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('❌ Error fetching messages:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch messages',
        detail: error.message 
      });
    }

    console.log(`✅ Fetched ${messages?.length || 0} messages for profile ${profile_id}`);
    
    return res.status(200).json({ 
      ok: true,
      messages: messages || [],
      count: messages?.length || 0
    });

  } catch (error: any) {
    console.error('Get messages error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
}
