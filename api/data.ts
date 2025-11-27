import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action as string;

  try {
    switch (action) {
      case 'save-conversation':
        return await handleSaveConversation(req, res);
      case 'update-conversation':
        return await handleUpdateConversation(req, res);
      case 'save-message':
        return await handleSaveMessage(req, res);
      case 'delete-conversation':
        return await handleDeleteConversation(req, res);
      case 'get-messages':
        return await handleGetMessages(req, res);
      case 'get-history':
        return await handleGetHistory(req, res);
      default:
        return res.status(400).json({ error: 'Unknown action. Use ?action=save-conversation|update-conversation|save-message|delete-conversation|get-messages|get-history' });
    }
  } catch (error: any) {
    console.error('Data API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

async function handleSaveConversation(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const conversation = req.body;
  
  if (!conversation || !conversation.id || !conversation.profile_id) {
    return res.status(400).json({ error: 'Conversation id and profile_id are required' });
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      const conversationData = {
        id: conversation.id,
        profile_id: conversation.profile_id,
        topic: conversation.topic || 'New Conversation',
        title: conversation.title || conversation.topic || 'New Conversation',
        is_placement_test: conversation.is_placement_test || false,
        started_at: conversation.started_at || new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('conversations')
        .upsert(conversationData, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase save failed:', error);
        return res.status(500).json({ 
          error: 'Failed to save conversation to database',
          details: error.message
        });
      }

      console.log('✅ Conversation saved:', conversation.id);
      return res.status(200).json({ 
        success: true, 
        message: 'Conversation saved successfully',
        data
      });
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
      return res.status(500).json({ 
        error: 'Failed to save conversation to database',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(503).json({ 
    error: 'Database not configured',
    message: 'Supabase configuration is missing'
  });
}

async function handleUpdateConversation(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, topic, title } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Conversation id is required' });
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      const updateData: any = {};
      if (topic !== undefined) updateData.topic = topic;
      if (title !== undefined) updateData.title = title;

      const { data, error } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase update failed:', error);
        return res.status(500).json({ 
          error: 'Failed to update conversation in database',
          details: error.message
        });
      }

      console.log('✅ Conversation updated:', id);
      return res.status(200).json({ 
        success: true, 
        message: 'Conversation updated successfully',
        data
      });
    } catch (error) {
      console.error('❌ Failed to update conversation:', error);
      return res.status(500).json({ 
        error: 'Failed to update conversation in database',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(503).json({ 
    error: 'Database not configured',
    message: 'Supabase configuration is missing'
  });
}

async function handleSaveMessage(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const message = req.body;
  
  if (!message || !message.content) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Don't create placeholder conversation here - client will create it when topic is confirmed
      // This prevents duplicate conversations with "New Conversation" topic

      // Don't save audio_url if it's a Blob object (can't serialize)
      const messageData = {
        id: message.id,
        conversation_id: message.conversation_id,
        profile_id: message.profile_id || null,
        sender: message.sender,
        type: message.type || 'text',
        content: message.content,
        audio_url: (typeof message.audio_url === 'string' ? message.audio_url : null),
        prosody_feedback: message.prosody_feedback || null,
        vocab_suggestions: message.vocab_suggestions || null,
        guidance: message.guidance || null,
        retry_of_message_id: message.retry_of_message_id || null,
        version: message.version || 1,
        created_at: message.created_at || new Date().toISOString()
      };

      console.log('💾 Saving message to database:', {
        id: messageData.id,
        conversation_id: messageData.conversation_id,
        profile_id: messageData.profile_id,
        sender: messageData.sender,
        content: messageData.content.substring(0, 50) + '...'
      });

      const { data, error } = await supabase
        .from('messages')
        .upsert(messageData, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase message save failed:', error);
        console.error('❌ Message data that failed:', messageData);
        // Don't fail the request, just log the error
        return res.status(200).json({ 
          success: true, 
          message: 'Message saved locally (database sync failed)',
          supabase_error: error.message
        });
      }

      console.log('✅ Message saved:', message.id);
      return res.status(200).json({ 
        success: true, 
        message: 'Message saved successfully',
        data
      });
    } catch (error) {
      console.error('❌ Failed to save message:', error);
    }
  }

  return res.status(200).json({ 
    success: true, 
    message: 'Message saved locally',
    supabase_available: !!(SUPABASE_URL && SUPABASE_KEY)
  });
}

async function handleDeleteConversation(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const conversationId = req.query.id as string;
  
  if (!conversationId) {
    return res.status(400).json({ error: 'Conversation ID is required' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase not configured, skipping database deletion');
    return res.status(200).json({ 
      ok: true, 
      message: 'Local deletion only (database not configured)' 
    });
  }

  console.log('🗑️ Deleting conversation:', conversationId);
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    console.log('⚠️ Non-UUID conversation ID (local only):', conversationId);
    return res.status(200).json({ 
      ok: true, 
      message: 'Local conversation deleted',
      localOnly: true
    });
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: deletedMessages, error: messagesError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)
    .select();

  if (messagesError) {
    console.error('❌ Error deleting messages:', messagesError);
  } else {
    console.log(`✅ Deleted ${deletedMessages?.length || 0} messages`);
  }

  const { data: deletedConv, error: conversationError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .select();

  if (conversationError) {
    console.error('❌ Error deleting conversation:', conversationError);
    return res.status(500).json({ 
      error: 'Failed to delete conversation',
      detail: conversationError.message 
    });
  }

  console.log('✅ Conversation deleted');
  
  return res.status(200).json({ 
    ok: true, 
    message: 'Conversation deleted successfully',
    deleted: deletedConv
  });
}

async function handleGetMessages(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ 
      error: 'Database not configured',
      messages: []
    });
  }

  const { conversation_id, profile_id } = req.query;
  
  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id is required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let query = supabase
    .from('messages')
    .select('*')
    .eq('profile_id', profile_id)
    .order('created_at', { ascending: true });

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

  console.log(`✅ Fetched ${messages?.length || 0} messages`);
  
  return res.status(200).json({ 
    ok: true,
    messages: messages || [],
    count: messages?.length || 0
  });
}

async function handleGetHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  let userId = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Guard against malformed tokens: token.split('.')[1] may be undefined
      const tokenBody = (token.split('.')[1] || '') as string;
      const decoded = Buffer.from(tokenBody || '', 'base64').toString() || '{}';
      const payload = JSON.parse(decoded);
      userId = payload.sub || payload.user_id;
    } catch (e) {
      console.warn('Failed to parse token:', e);
    }
  }

  let conversations = [];
  let messages = [];
  
  if (SUPABASE_URL && SUPABASE_KEY && userId) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('profile_id', userId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (convError) {
        console.error('Error fetching conversations:', convError);
      } else {
        conversations = convData || [];
      }

      if (conversations.length > 0) {
        const conversationIds = conversations.slice(0, 10).map((c: any) => c.id);
        
        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: true })
          .limit(1000);

        if (msgError) {
          console.error('Error fetching messages:', msgError);
        } else {
          messages = msgData || [];
        }
      }
      
      console.log(`Fetched ${conversations.length} conversations and ${messages.length} messages`);
    } catch (error) {
      console.error('Supabase fetch error:', error);
    }
  }

  return res.status(200).json({
    conversations,
    messages,
    success: true,
    message: conversations.length > 0 ? 'Data loaded from database' : 'Using local store data'
  });
}
