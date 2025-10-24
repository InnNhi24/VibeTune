import logger from '../utils/logger';
interface OfflineMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'audio';
  content: string;
  audio_url?: string;
  created_at: string;
  synced: boolean;
  device_id?: string;
}

interface OfflineConversation {
  id: string;
  profile_id: string;
  topic: string;
  is_placement_test: boolean;
  started_at: string;
  ended_at?: string;
  synced: boolean;
  device_id?: string;
}

export class OfflineService {
  private static readonly STORAGE_KEYS = {
    MESSAGES: 'speakpro_offline_messages',
    CONVERSATIONS: 'speakpro_offline_conversations',
    SYNC_QUEUE: 'speakpro_sync_queue',
    LAST_SYNC: 'speakpro_last_sync'
  };

  // Storage abstraction for both web and mobile
  private static getStorage() {
    if (typeof window !== 'undefined') {
      // Web - use IndexedDB wrapper or fallback to localStorage
      return {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => localStorage.setItem(key, value),
        removeItem: (key: string) => localStorage.removeItem(key)
      };
    } else {
      // React Native - would use AsyncStorage
      return {
        getItem: async (key: string) => null, // AsyncStorage.getItem(key)
        setItem: async (key: string, value: string) => {}, // AsyncStorage.setItem(key, value)
        removeItem: async (key: string) => {} // AsyncStorage.removeItem(key)
      };
    }
  }

  // Save message offline
  static saveMessageOffline(message: OfflineMessage): void {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.MESSAGES);
      const messages: OfflineMessage[] = existing ? JSON.parse(existing) : [];
      
      // Add device ID and mark as unsynced
      const offlineMessage = {
        ...message,
        device_id: this.getDeviceId(),
        synced: false
      };
      
      messages.push(offlineMessage);
      storage.setItem(this.STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
      
      // Add to sync queue
      this.addToSyncQueue('message', offlineMessage.id);
    } catch (error) {
        logger.error('Failed to save message offline:', error);
    }
  }

  // Save conversation offline
  static saveConversationOffline(conversation: OfflineConversation): void {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.CONVERSATIONS);
      const conversations: OfflineConversation[] = existing ? JSON.parse(existing) : [];
      
      const offlineConversation = {
        ...conversation,
        device_id: this.getDeviceId(),
        synced: false
      };
      
      conversations.push(offlineConversation);
      storage.setItem(this.STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
      
      this.addToSyncQueue('conversation', offlineConversation.id);
    } catch (error) {
        logger.error('Failed to save conversation offline:', error);
    }
  }

  // Get offline messages for a conversation
  static getOfflineMessages(conversationId: string): OfflineMessage[] {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.MESSAGES);
      const messages: OfflineMessage[] = existing ? JSON.parse(existing) : [];
      
      return messages.filter(msg => msg.conversation_id === conversationId);
    } catch (error) {
        logger.error('Failed to get offline messages:', error);
      return [];
    }
  }

  // Get all offline conversations
  static getOfflineConversations(): OfflineConversation[] {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.CONVERSATIONS);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
        logger.error('Failed to get offline conversations:', error);
      return [];
    }
  }

  // Get unsynchronized items
  static getUnsyncedItems(): {
    messages: OfflineMessage[];
    conversations: OfflineConversation[];
  } {
    const allMessages = this.getAllOfflineMessages();
    const allConversations = this.getOfflineConversations();
    
    return {
      messages: allMessages.filter(msg => !msg.synced),
      conversations: allConversations.filter(conv => !conv.synced)
    };
  }

  // Mark items as synced
  static markAsSynced(type: 'message' | 'conversation', id: string): void {
    try {
      const storage = this.getStorage();
      const storageKey = type === 'message' 
        ? this.STORAGE_KEYS.MESSAGES 
        : this.STORAGE_KEYS.CONVERSATIONS;
      
      const existing = storage.getItem(storageKey);
      if (!existing) return;
      
      const items = JSON.parse(existing);
      const updatedItems = items.map((item: any) => 
        item.id === id ? { ...item, synced: true } : item
      );
      
      storage.setItem(storageKey, JSON.stringify(updatedItems));
      this.removeFromSyncQueue(type, id);
    } catch (error) {
        logger.error('Failed to mark item as synced:', error);
    }
  }

  // Add item to sync queue
  private static addToSyncQueue(type: 'message' | 'conversation', id: string): void {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.SYNC_QUEUE);
      const queue: Array<{ type: string; id: string; timestamp: number }> = 
        existing ? JSON.parse(existing) : [];
      
      queue.push({ type, id, timestamp: Date.now() });
      storage.setItem(this.STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (error) {
        logger.error('Failed to add to sync queue:', error);
    }
  }

  // Remove item from sync queue
  private static removeFromSyncQueue(type: 'message' | 'conversation', id: string): void {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.SYNC_QUEUE);
      if (!existing) return;
      
      const queue = JSON.parse(existing);
      const filtered = queue.filter((item: any) => !(item.type === type && item.id === id));
      
      storage.setItem(this.STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(filtered));
    } catch (error) {
      logger.error('Failed to remove from sync queue:', error);
    }
  }

  // Get sync queue
  static getSyncQueue(): Array<{ type: string; id: string; timestamp: number }> {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.SYNC_QUEUE);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
        logger.error('Failed to get sync queue:', error);
      return [];
    }
  }

  // Clear synced items (cleanup)
  static clearSyncedItems(): void {
    try {
      const storage = this.getStorage();
      
      // Clear synced messages older than 7 days
      const messagesData = storage.getItem(this.STORAGE_KEYS.MESSAGES);
      if (messagesData) {
        const messages: OfflineMessage[] = JSON.parse(messagesData);
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        
        const filtered = messages.filter(msg => 
          !msg.synced || new Date(msg.created_at).getTime() > cutoff
        );
        
        storage.setItem(this.STORAGE_KEYS.MESSAGES, JSON.stringify(filtered));
      }
      
      // Clear synced conversations older than 30 days
      const conversationsData = storage.getItem(this.STORAGE_KEYS.CONVERSATIONS);
      if (conversationsData) {
        const conversations: OfflineConversation[] = JSON.parse(conversationsData);
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
        
        const filtered = conversations.filter(conv => 
          !conv.synced || new Date(conv.started_at).getTime() > cutoff
        );
        
        storage.setItem(this.STORAGE_KEYS.CONVERSATIONS, JSON.stringify(filtered));
      }
    } catch (error) {
      logger.error('Failed to clear synced items:', error);
    }
  }

  // Get device ID (persistent identifier)
  private static getDeviceId(): string {
    try {
      const storage = this.getStorage();
      let deviceId = storage.getItem('device_id');
      
      if (!deviceId) {
        deviceId = 'web_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        storage.setItem('device_id', deviceId);
      }
      
      return deviceId;
    } catch (error) {
        logger.error('Failed to get device ID:', error);
      return 'unknown_device';
    }
  }

  // Get all offline messages
  private static getAllOfflineMessages(): OfflineMessage[] {
    try {
      const storage = this.getStorage();
      const existing = storage.getItem(this.STORAGE_KEYS.MESSAGES);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
        logger.error('Failed to get all offline messages:', error);
      return [];
    }
  }

  // Update last sync timestamp
  static updateLastSync(): void {
    try {
      const storage = this.getStorage();
      storage.setItem(this.STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      logger.error('Failed to update last sync:', error);
    }
  }

  // Get last sync timestamp
  static getLastSync(): number {
    try {
      const storage = this.getStorage();
      const lastSync = storage.getItem(this.STORAGE_KEYS.LAST_SYNC);
      return lastSync ? parseInt(lastSync) : 0;
    } catch (error) {
        logger.error('Failed to get last sync:', error);
      return 0;
    }
  }

  // Check if offline
  static isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  }

  // Get offline storage stats
  static getStorageStats(): {
    messageCount: number;
    conversationCount: number;
    unsyncedMessages: number;
    unsyncedConversations: number;
    lastSync: number;
  } {
    const messages = this.getAllOfflineMessages();
    const conversations = this.getOfflineConversations();
    const unsynced = this.getUnsyncedItems();
    
    return {
      messageCount: messages.length,
      conversationCount: conversations.length,
      unsyncedMessages: unsynced.messages.length,
      unsyncedConversations: unsynced.conversations.length,
      lastSync: this.getLastSync()
    };
  }
}