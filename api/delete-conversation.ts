import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow DELETE method
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get conversation ID from URL path
  const conversationId = req.query.id as string;
  
  if (!conversationId) {
    return res.status(400).json({ error: 'Conversation ID is required' });
  }

  // Check if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabase not configured, skipping database deletion');
    return res.status(200).json({ 
      ok: true, 
      message: 'Local deletion only (database not configured)' 
    });
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Delete all messages associated with this conversation first
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
      // Continue anyway to try deleting the conversation
    }

    // Delete the conversation
    const { error: conversationError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (conversationError) {
      console.error('Error deleting conversation:', conversationError);
      return res.status(500).json({ 
        error: 'Failed to delete conversation',
        detail: conversationError.message 
      });
    }

    return res.status(200).json({ 
      ok: true, 
      message: 'Conversation deleted successfully' 
    });

  } catch (error: any) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
}
