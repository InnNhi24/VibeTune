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
    const message = req.body;
    
    if (!message || !message.content) {
      return res.status(400).json({ error: 'Message content is required' });
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

        const messageData = {
          id: message.id,
          conversation_id: message.conversation_id,
          sender: message.sender,
          type: message.type || 'text',
          content: message.content,
          audio_url: message.audio_url || null,
          prosody_feedback: message.prosody_feedback || null,
          vocab_suggestions: message.vocab_suggestions || null,
          guidance: message.guidance || null,
          retry_of_message_id: message.retry_of_message_id || null,
          version: message.version || 1,
          created_at: message.created_at || new Date().toISOString()
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify([messageData])
        });

        if (response.ok) {
          const savedMessage = await response.json();
          console.log('✅ Message saved to Supabase:', message.id);
          return res.status(200).json({ 
            success: true, 
            message: 'Message saved successfully',
            data: savedMessage[0]
          });
        } else {
          const errorText = await response.text();
          console.error('❌ Supabase save failed:', response.status, errorText);
          throw new Error(`Supabase error: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to save message to Supabase:', error);
        // Continue to return success for local storage
      }
    }

    // Return success even if Supabase fails (local storage is primary)
    return res.status(200).json({ 
      success: true, 
      message: 'Message saved locally',
      supabase_available: !!(SUPABASE_URL && SUPABASE_KEY)
    });

  } catch (error: any) {
    console.error('Save message error:', error);
    return res.status(500).json({ 
      error: 'Failed to save message', 
      details: error.message 
    });
  }
}