/**
 * Migration helper to handle old conversation ID formats
 */

import { useAppStore } from '../store/appStore';

/**
 * Check if a conversation ID is in old format (non-UUID)
 */
export function isOldFormatId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return !uuidRegex.test(id);
}

/**
 * Migrate old conversation IDs to UUID format
 * This should be called once on app initialization
 */
export function migrateOldConversationIds(): void {
  try {
    const store = useAppStore.getState();
    const { conversations, messages } = store;
    
    let hasChanges = false;
    const idMapping = new Map<string, string>();
    
    // Find conversations with old IDs and create mapping
    conversations.forEach(conv => {
      if (isOldFormatId(conv.id)) {
        const newId = crypto.randomUUID();
        idMapping.set(conv.id, newId);
        hasChanges = true;
        console.log(`🔄 Migrating conversation ID: ${conv.id} → ${newId}`);
      }
    });
    
    if (!hasChanges) {
      console.log('✅ No conversation IDs need migration');
      return;
    }
    
    // Update conversations with new IDs
    const updatedConversations = conversations.map(conv => {
      const newId = idMapping.get(conv.id);
      if (newId) {
        return { ...conv, id: newId };
      }
      return conv;
    });
    
    // Update messages with new conversation IDs
    const updatedMessages = messages.map(msg => {
      const newConvId = idMapping.get(msg.conversation_id);
      if (newConvId) {
        return { ...msg, conversation_id: newConvId };
      }
      return msg;
    });
    
    // Update store
    store.conversations = updatedConversations;
    store.messages = updatedMessages;
    
    // Update active conversation ID if needed
    if (store.activeConversationId && idMapping.has(store.activeConversationId)) {
      store.activeConversationId = idMapping.get(store.activeConversationId) || null;
    }
    
    console.log(`✅ Migrated ${idMapping.size} conversations to UUID format`);
    
    // Force persist to localStorage
    const storeData = {
      user: store.user,
      conversations: updatedConversations,
      messages: updatedMessages,
      activeConversationId: store.activeConversationId,
      placementTestProgress: store.placementTestProgress,
      retryQueue: store.retryQueue,
      currentTopic: store.currentTopic,
      sync: store.sync
    };
    
    localStorage.setItem('vibetune-app-store', JSON.stringify({ state: storeData }));
    console.log('✅ Migration persisted to localStorage');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

/**
 * Clean up orphaned messages (messages without a conversation)
 */
export function cleanupOrphanedMessages(): void {
  try {
    const store = useAppStore.getState();
    const { conversations, messages } = store;
    
    const conversationIds = new Set(conversations.map(c => c.id));
    const orphanedMessages = messages.filter(m => !conversationIds.has(m.conversation_id));
    
    if (orphanedMessages.length > 0) {
      console.log(`🧹 Found ${orphanedMessages.length} orphaned messages`);
      const cleanedMessages = messages.filter(m => conversationIds.has(m.conversation_id));
      store.messages = cleanedMessages;
      console.log(`✅ Cleaned up ${orphanedMessages.length} orphaned messages`);
    } else {
      console.log('✅ No orphaned messages found');
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}
