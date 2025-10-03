import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

interface OfflineMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'audio';
  content: string;
  audio_url?: string;
  timestamp: string;
  device_id?: string;
  synced: boolean;
}

interface OfflineConversation {
  id: string;
  profile_id: string;
  topic: string;
  is_placement_test: boolean;
  started_at: string;
  device_id?: string;
  synced: boolean;
}

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingMessages: number;
  pendingConversations: number;
  syncErrors: string[];
}

const OFFLINE_MESSAGES_KEY = 'speakpro_offline_messages';
const OFFLINE_CONVERSATIONS_KEY = 'speakpro_offline_conversations';
const LAST_SYNC_KEY = 'speakpro_last_sync';

export function useOfflineSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncTime: localStorage.getItem(LAST_SYNC_KEY),
    pendingMessages: 0,
    pendingConversations: 0,
    syncErrors: []
  });

  // Save message offline
  const saveMessageOffline = useCallback(async (message: Partial<OfflineMessage>) => {
    try {
      const existingMessages = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const offlineMessage: OfflineMessage = {
        id: message.id || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conversation_id: message.conversation_id || '',
        sender: message.sender || 'user',
        type: message.type || 'text',
        content: message.content || '',
        audio_url: message.audio_url,
        timestamp: message.timestamp || new Date().toISOString(),
        device_id: message.device_id || localStorage.getItem('device_id') || undefined,
        synced: false
      };

      const updatedMessages = [...existingMessages, offlineMessage];
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(updatedMessages));
      
      setSyncState(prev => ({
        ...prev,
        pendingMessages: updatedMessages.filter(m => !m.synced).length
      }));

      return offlineMessage;
    } catch (error) {
      console.error('Error saving message offline:', error);
      throw error;
    }
  }, []);

  // Save conversation offline
  const saveConversationOffline = useCallback(async (conversation: Partial<OfflineConversation>) => {
    try {
      const existingConversations = JSON.parse(localStorage.getItem(OFFLINE_CONVERSATIONS_KEY) || '[]');
      const offlineConversation: OfflineConversation = {
        id: conversation.id || `offline_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        profile_id: conversation.profile_id || '',
        topic: conversation.topic || 'Offline Conversation',
        is_placement_test: conversation.is_placement_test || false,
        started_at: conversation.started_at || new Date().toISOString(),
        device_id: conversation.device_id || localStorage.getItem('device_id') || undefined,
        synced: false
      };

      const updatedConversations = [...existingConversations, offlineConversation];
      localStorage.setItem(OFFLINE_CONVERSATIONS_KEY, JSON.stringify(updatedConversations));
      
      setSyncState(prev => ({
        ...prev,
        pendingConversations: updatedConversations.filter(c => !c.synced).length
      }));

      return offlineConversation;
    } catch (error) {
      console.error('Error saving conversation offline:', error);
      throw error;
    }
  }, []);

  // Sync offline messages
  const syncOfflineMessages = useCallback(async () => {
    if (!navigator.onLine) return;

    setSyncState(prev => ({ ...prev, isSyncing: true, syncErrors: [] }));

    try {
      const offlineMessages: OfflineMessage[] = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const unsyncedMessages = offlineMessages.filter(m => !m.synced);

      if (unsyncedMessages.length === 0) {
        setSyncState(prev => ({ ...prev, isSyncing: false }));
        return;
      }

      const syncErrors: string[] = [];
      const syncedMessageIds: string[] = [];

      for (const message of unsyncedMessages) {
        try {
          // Check if conversation exists in the database
          let conversationExists = true;
          if (message.conversation_id.startsWith('offline_conv_')) {
            // Need to sync conversation first
            await syncOfflineConversations();
            // Find the synced conversation ID
            const conversations: OfflineConversation[] = JSON.parse(localStorage.getItem(OFFLINE_CONVERSATIONS_KEY) || '[]');
            const syncedConv = conversations.find(c => c.id === message.conversation_id && c.synced);
            if (syncedConv) {
              message.conversation_id = syncedConv.id;
            } else {
              conversationExists = false;
            }
          }

          if (conversationExists) {
            // Insert message into database
            const { error } = await supabase
              .from('messages')
              .insert({
                conversation_id: message.conversation_id,
                sender: message.sender,
                type: message.type,
                content: message.content,
                audio_url: message.audio_url,
                created_at: message.timestamp,
                version: 1,
                device_id: message.device_id
              });

            if (error) {
              throw error;
            }

            syncedMessageIds.push(message.id);
          } else {
            syncErrors.push(`Failed to sync message: conversation not found`);
          }
        } catch (error) {
          console.error('Error syncing message:', message.id, error);
          syncErrors.push(`Message sync failed: ${error}`);
        }
      }

      // Update local storage with synced status
      const updatedMessages = offlineMessages.map(m => 
        syncedMessageIds.includes(m.id) ? { ...m, synced: true } : m
      );
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(updatedMessages));

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date().toISOString(),
        pendingMessages: updatedMessages.filter(m => !m.synced).length,
        syncErrors
      }));

      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    } catch (error) {
      console.error('Error syncing offline messages:', error);
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncErrors: [...prev.syncErrors, `Sync failed: ${error}`]
      }));
    }
  }, []);

  // Sync offline conversations
  const syncOfflineConversations = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      const offlineConversations: OfflineConversation[] = JSON.parse(localStorage.getItem(OFFLINE_CONVERSATIONS_KEY) || '[]');
      const unsyncedConversations = offlineConversations.filter(c => !c.synced);

      if (unsyncedConversations.length === 0) return;

      const syncedConversationIds: string[] = [];

      for (const conversation of unsyncedConversations) {
        try {
          const { data, error } = await supabase
            .from('conversations')
            .insert({
              profile_id: conversation.profile_id,
              topic: conversation.topic,
              is_placement_test: conversation.is_placement_test,
              started_at: conversation.started_at
            })
            .select()
            .single();

          if (error) {
            throw error;
          }

          // Update the conversation with the real database ID
          if (data) {
            const updatedConversation = { ...conversation, id: data.id, synced: true };
            const updatedConversations = offlineConversations.map(c =>
              c.id === conversation.id ? updatedConversation : c
            );
            localStorage.setItem(OFFLINE_CONVERSATIONS_KEY, JSON.stringify(updatedConversations));
            syncedConversationIds.push(conversation.id);
          }
        } catch (error) {
          console.error('Error syncing conversation:', conversation.id, error);
        }
      }

      setSyncState(prev => ({
        ...prev,
        pendingConversations: offlineConversations.filter(c => !c.synced).length
      }));

    } catch (error) {
      console.error('Error syncing offline conversations:', error);
    }
  }, []);

  // Handle sync conflicts
  const resolveConflicts = useCallback(async (localMessages: any[], serverMessages: any[]) => {
    // Simple conflict resolution: server wins for conflicts, merge non-conflicting
    const resolvedMessages = [...serverMessages];
    
    localMessages.forEach(localMsg => {
      const serverMsg = serverMessages.find(sm => 
        sm.conversation_id === localMsg.conversation_id &&
        Math.abs(new Date(sm.created_at).getTime() - new Date(localMsg.created_at).getTime()) < 5000 // Within 5 seconds
      );

      if (!serverMsg) {
        // No conflict, add local message
        resolvedMessages.push(localMsg);
      } else {
        // Conflict detected - server message wins, but log for potential manual resolution
        console.log('Sync conflict resolved (server wins):', { local: localMsg, server: serverMsg });
      }
    });

    return resolvedMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, []);

  // Auto-sync when online
  useEffect(() => {
    const handleOnline = () => {
      if (navigator.onLine) {
        setTimeout(() => {
          syncOfflineConversations();
          syncOfflineMessages();
        }, 1000); // Wait a second for connection to stabilize
      }
    };

    // Check pending items on mount
    const checkPendingItems = () => {
      const messages: OfflineMessage[] = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const conversations: OfflineConversation[] = JSON.parse(localStorage.getItem(OFFLINE_CONVERSATIONS_KEY) || '[]');
      
      setSyncState(prev => ({
        ...prev,
        pendingMessages: messages.filter(m => !m.synced).length,
        pendingConversations: conversations.filter(c => !c.synced).length
      }));
    };

    checkPendingItems();
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineMessages, syncOfflineConversations]);

  // Clean up old synced items periodically
  const cleanupSyncedItems = useCallback(() => {
    try {
      const messages: OfflineMessage[] = JSON.parse(localStorage.getItem(OFFLINE_MESSAGES_KEY) || '[]');
      const conversations: OfflineConversation[] = JSON.parse(localStorage.getItem(OFFLINE_CONVERSATIONS_KEY) || '[]');
      
      // Keep only unsynced items and items from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const filteredMessages = messages.filter(m => 
        !m.synced || new Date(m.timestamp) > oneDayAgo
      );
      
      const filteredConversations = conversations.filter(c =>
        !c.synced || new Date(c.started_at) > oneDayAgo
      );
      
      localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(filteredMessages));
      localStorage.setItem(OFFLINE_CONVERSATIONS_KEY, JSON.stringify(filteredConversations));
      
    } catch (error) {
      console.error('Error cleaning up synced items:', error);
    }
  }, []);

  // Manual sync trigger
  const manualSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState(prev => ({
        ...prev,
        syncErrors: ['Cannot sync while offline']
      }));
      return;
    }

    await syncOfflineConversations();
    await syncOfflineMessages();
    cleanupSyncedItems();
  }, [syncOfflineConversations, syncOfflineMessages, cleanupSyncedItems]);

  return {
    syncState,
    saveMessageOffline,
    saveConversationOffline,
    syncOfflineMessages,
    syncOfflineConversations,
    resolveConflicts,
    manualSync,
    cleanupSyncedItems
  };
}