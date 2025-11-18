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
    const conversation = req.body;
    
    if (!conversation || !conversation.id || !conversation.profile_id) {
      return res.status(400).json({ error: 'Conversation id and profile_id are required' });
    }

    // Try to save to Supabase if configured
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabaseHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Prefer': 'return=representation'
        };

        const conversationData = {
          id: conversation.id,
          profile_id: conversation.profile_id,
          topic: conversation.topic || null,
          title: conversation.title || conversation.topic || 'New Conversation',
          is_placement_test: conversation.is_placement_test || false,
          started_at: conversation.started_at || new Date().toISOString(),
          message_count: conversation.message_count || 0,
          avg_prosody_score: conversation.avg_prosody_score || 0
        };

        // Use upsert to handle both create and update
        const response = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify(conversationData)
        });

        if (response.ok) {
          const savedConversation = await response.json();
          console.log('✅ Conversation saved to Supabase:', conversation.id);
          return res.status(200).json({ 
            success: true, 
            message: 'Conversation saved successfully',
            data: savedConversation
          });
        } else {
          const errorText = await response.text();
          console.error('❌ Supabase save failed:', response.status, errorText);
          throw new Error(`Supabase error: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to save conversation to Supabase:', error);
        // Return error since conversation must be in database
        return res.status(500).json({ 
          error: 'Failed to save conversation to database',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Return error if Supabase not configured
    return res.status(503).json({ 
      error: 'Database not configured',
      message: 'Supabase configuration is missing'
    });

  } catch (error: any) {
    console.error('Save conversation error:', error);
    return res.status(500).json({ 
      error: 'Failed to save conversation', 
      details: error.message 
    });
  }
}
