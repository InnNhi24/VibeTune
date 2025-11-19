import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Profile } from '../services/supabaseClient';

// Types
export interface Message {
  id: string;
  conversation_id: string;
  profile_id?: string | null;
  sender: 'user' | 'ai';
  type: 'text' | 'audio';
  content: string;
  audio_url?: string | Blob | null;
  prosody_feedback?: ProsodyFeedback;
  vocab_suggestions?: VocabSuggestion[];
  guidance?: string;
  retry_of_message_id?: string;
  version?: number;
  created_at: string;
  timestamp: string;
  isProcessing?: boolean;
}

export interface ProsodyFeedback {
  overall_score: number;
  pronunciation_score: number;
  rhythm_score: number;
  intonation_score: number;
  fluency_score: number;
  detailed_feedback: {
    strengths: string[];
    improvements: string[];
    specific_issues: ProsodyIssue[];
  };
  suggestions: string[];
  next_focus_areas: string[];
}

export interface ProsodyIssue {
  type: 'pronunciation' | 'rhythm' | 'intonation' | 'stress' | 'pace';
  word: string;
  severity: 'low' | 'medium' | 'high';
  feedback: string;
  suggestion: string;
}

export interface VocabSuggestion {
  word: string;
  simpler_alternative?: string;
  definition: string;
}

export interface Conversation {
  id: string;
  profile_id: string;
  topic: string;
  // Human-friendly title shown in the sidebar UI
  title?: string;
  is_placement_test: boolean;
  started_at: string;
  ended_at?: string;
  message_count?: number;
  avg_prosody_score?: number;
  // Convenience fields used by UI components (optional)
  timestamp?: string;
  messagesCount?: number;
}

export interface SyncStatus {
  online: boolean;
  lastSync: Date | null;
  syncing: boolean;
  hasOfflineChanges: boolean;
}

export interface PlacementTestProgress {
  currentQuestion: number;
  totalQuestions: number;
  answers: Array<{
    question_id: string;
    answer: string;
    audio_url?: string;
    timestamp: string;
  }>;
  topic_scores: Record<string, number>;
  overall_progress: number;
}

// Store interface
interface AppStore {
  // User state
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  clearUserData: () => void;
  
  // Conversation state
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  currentTopic: string;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversationId: string | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => void;
  setCurrentTopic: (topic: string) => void;
  clearMessages: () => void;
  addConversation: (conversation: Conversation) => void;
  deleteConversation: (conversationId: string) => void;
  // Reconcile a locally-created conversation id (local_<ts>) with the server canonical id
  reconcileConversationId: (localId: string, serverId: string) => void;
  endConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  
  // Placement test state
  placementTestProgress: PlacementTestProgress;
  setPlacementTestProgress: (progress: PlacementTestProgress) => void;
  updatePlacementTestProgress: (updates: Partial<PlacementTestProgress>) => void;
  resetPlacementTest: () => void;
  
  // Sync state
  sync: SyncStatus;
  setSyncOnline: (online: boolean) => void;
  setSyncStatus: (syncing: boolean) => void;
  setLastSync: (date: Date) => void;
  setHasOfflineChanges: (hasChanges: boolean) => void;
  
  // Retry queue
  retryQueue: Message[];
  addToRetryQueue: (message: Message) => void;
  removeFromRetryQueue: (messageId: string) => void;
  clearRetryQueue: () => void;
  
  // Analytics
  trackEvent: (eventType: string, metadata?: Record<string, any>) => void;
  
  // Actions
  initializeApp: () => Promise<void>;
  syncData: () => Promise<void>;
  resetStore: () => void;
  clearActiveSession: () => void;
}

// Default values
const defaultPlacementTestProgress: PlacementTestProgress = {
  currentQuestion: 0,
  totalQuestions: 10,
  answers: [],
  topic_scores: {},
  overall_progress: 0,
};

const defaultSyncStatus: SyncStatus = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSync: null,
  syncing: false,
  hasOfflineChanges: false,
};

// Storage configuration
const getStorage = () => {
  if (typeof window !== 'undefined') {
    return createJSONStorage(() => localStorage);
  }
  // Fallback to sessionStorage for web
  return createJSONStorage(() => sessionStorage);
};

// Create store
export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // User state
        user: null,
        setUser: (user) => set({ user }),
        clearUserData: () => set({
          user: null,
          activeConversationId: null,
          currentTopic: 'General Conversation',
          placementTestProgress: {
            currentQuestion: 0,
            totalQuestions: 10,
            answers: [],
            topic_scores: {},
            overall_progress: 0
          }
          // Keep conversations and messages - they are filtered by user ID anyway
        }),
        
        // Conversation state
        conversations: [],
        activeConversationId: null,
        messages: [],
        currentTopic: 'General Conversation',
        
        setConversations: (conversations) => set({ conversations }),
        setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),
        
        addMessage: (message) => {
          set((state) => ({
            messages: [...state.messages, message]
          }));
          
          // Always mark as having offline changes to ensure persistence
          set((state) => ({
            sync: { ...state.sync, hasOfflineChanges: true }
          }));
          
          // Force immediate localStorage backup
          try {
            const currentState = get();
            const backupData = {
              messages: currentState.messages,
              conversations: currentState.conversations,
              activeConversationId: currentState.activeConversationId,
              timestamp: new Date().toISOString()
            };
            localStorage.setItem('vibetune-messages-backup', JSON.stringify(backupData));
            console.log('✅ Message backup saved to localStorage');
          } catch (e) {
            console.error('❌ Failed to backup message:', e);
          }
        },
        
        updateMessage: (messageId, updates) => {
          set((state) => ({
            messages: state.messages.map(msg => 
              msg.id === messageId ? { ...msg, ...updates } : msg
            )
          }));
        },
        
        deleteMessage: (messageId) => {
          set((state) => ({
            messages: state.messages.filter(msg => msg.id !== messageId)
          }));
        },
        
        setCurrentTopic: (topic) => set({ currentTopic: topic }),
        // Don't clear all messages - this would lose conversation history
        clearMessages: () => {
          console.warn('⚠️ clearMessages called - this should not clear all messages');
          // Only clear if really needed, otherwise keep messages for history
        },
        // Conversations management
        addConversation: (conversation) => {
          set((state) => ({
            conversations: [conversation, ...state.conversations],
            activeConversationId: conversation.id
          }));
        },
        
        deleteConversation: (conversationId) => {
          set((state) => {
            // Remove conversation
            const conversations = state.conversations.filter(c => c.id !== conversationId);
            
            // Remove all messages for this conversation
            const messages = state.messages.filter(m => m.conversation_id !== conversationId);
            
            // Clear active conversation if it's the one being deleted
            const activeConversationId = state.activeConversationId === conversationId 
              ? null 
              : state.activeConversationId;
            
            return {
              conversations,
              messages,
              activeConversationId,
              currentTopic: activeConversationId ? state.currentTopic : 'New Conversation'
            };
          });
        },
        reconcileConversationId: (localId, serverId) => {
          // Replace conversation id and update any messages referencing the local id
          set((state) => {
            const conversations = state.conversations.map(conv =>
              conv.id === localId ? { ...conv, id: serverId } : conv
            );

            const messages = state.messages.map(msg =>
              msg.conversation_id === localId ? { ...msg, conversation_id: serverId } : msg
            );

            return {
              conversations,
              messages,
              activeConversationId: serverId
            };
          });
        },
        endConversation: (conversationId, updates) => {
          set((state) => ({
            conversations: state.conversations.map(conv =>
              conv.id === conversationId ? { ...conv, ...updates } : conv
            )
          }));
        },
        
        // Placement test state
        placementTestProgress: defaultPlacementTestProgress,
        setPlacementTestProgress: (progress) => set({ placementTestProgress: progress }),
        updatePlacementTestProgress: (updates) => {
          set((state) => ({
            placementTestProgress: { ...state.placementTestProgress, ...updates }
          }));
        },
        resetPlacementTest: () => set({ placementTestProgress: defaultPlacementTestProgress }),
        
        // Sync state
        sync: defaultSyncStatus,
        setSyncOnline: (online) => {
          set((state) => ({
            sync: { ...state.sync, online }
          }));
        },
        setSyncStatus: (syncing) => {
          set((state) => ({
            sync: { ...state.sync, syncing }
          }));
        },
        setLastSync: (date) => {
          set((state) => ({
            sync: { ...state.sync, lastSync: date }
          }));
        },
        setHasOfflineChanges: (hasChanges) => {
          set((state) => ({
            sync: { ...state.sync, hasOfflineChanges: hasChanges }
          }));
        },
        
        // Retry queue
        retryQueue: [],
        addToRetryQueue: (message) => {
          set((state) => ({
            retryQueue: [...state.retryQueue, message]
          }));
        },
        removeFromRetryQueue: (messageId) => {
          set((state) => ({
            retryQueue: state.retryQueue.filter(msg => msg.id !== messageId)
          }));
        },
        clearRetryQueue: () => set({ retryQueue: [] }),
        
        // Analytics
        trackEvent: async (eventType, metadata = {}) => {
          const { user } = get();
          if (!user) return;
          
          try {
            const event = {
              event_type: eventType,
              metadata: {
                ...metadata,
                timestamp: new Date().toISOString(),
                user_level: user.level,
                app_version: '1.0.0'
              }
            };
            
            // If online, send immediately (with timeout)
            if (get().sync.online) {
              try {
                // Import auth service dynamically to avoid circular deps
                const { SimpleAuthService } = await import('../services/authServiceSimple');
                const session = await SimpleAuthService.getCurrentSession();
                
                const token = (session as any)?.data?.session?.access_token || (session as any)?.access_token || null;
                if (token) {
                  // Add timeout to prevent hanging
                  const fetchPromise = fetch(`/api/analytics`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(event)
                  });
                  
                  const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Analytics timeout')), 3000)
                  );
                  
                    await Promise.race([fetchPromise, timeoutPromise]);
                }
              } catch (error) {
                  (await import('../utils/logger')).logger.warn('Analytics tracking failed:', error);
                // Continue without blocking
              }
            } else {
              // Queue for later sync
                (await import('../utils/logger')).logger.info('Offline: queued analytics event', eventType);
            }
          } catch (error) {
              (await import('../utils/logger')).logger.warn('Failed to track event:', error);
          }
        },
        
        // Actions
        initializeApp: async () => {
          // Initialize app state
          const { user } = get();
          if (user) {
            // Check for backup data and restore if main store is empty
            try {
              const currentMessages = get().messages;
              const currentConversations = get().conversations;
              
              if (currentMessages.length === 0 && currentConversations.length === 0) {
                const backup = localStorage.getItem('vibetune-messages-backup');
                if (backup) {
                  const parsed = JSON.parse(backup);
                  if (parsed.messages && parsed.messages.length > 0) {
                    console.log('🔄 Restoring from backup:', parsed.messages.length, 'messages');
                    set({ 
                      messages: parsed.messages,
                      conversations: parsed.conversations || [],
                      activeConversationId: parsed.activeConversationId || null
                    });
                  }
                }
              }
            } catch (error) {
              console.warn('Failed to restore from backup:', error);
            }
            
            // Load conversations and recent messages
            try {
              await get().syncData();
            } catch (error) {
              (await import('../utils/logger')).logger.warn('Failed to sync data on app init:', error);
            }
          }
        },
        
        syncData: async () => {
          const { user, sync } = get();
          if (!user) return;
          
          set((state) => ({
            sync: { ...state.sync, syncing: true }
          }));
          
          try {
            // First, try to save any pending messages
            const currentMessages = get().messages;
            const retryQueue = get().retryQueue;
            
            if (sync.online && (currentMessages.length > 0 || retryQueue.length > 0)) {
              const { SimpleAuthService } = await import('../services/authServiceSimple');
              const session = await SimpleAuthService.getCurrentSession();
              
              const token2 = (session as any)?.data?.session?.access_token || (session as any)?.access_token || null;
              if (token2) {
                // Save recent messages that might not be persisted
                const recentMessages = currentMessages.filter(msg => {
                  const msgTime = new Date(msg.created_at).getTime();
                  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
                  return msgTime > fiveMinutesAgo;
                });
                
                for (const message of recentMessages) {
                  try {
                    await fetch(`/api/data?action=save-message`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token2}`,
                      },
                      body: JSON.stringify(message)
                    });
                    console.log('✅ Synced message:', message.id);
                  } catch (error) {
                    console.warn('❌ Failed to sync message:', message.id, error);
                    // Add to retry queue if not already there
                    if (!retryQueue.find(m => m.id === message.id)) {
                      get().addToRetryQueue(message);
                    }
                  }
                }
                
                // Process retry queue
                for (const message of retryQueue) {
                  try {
                    await fetch(`/api/data?action=save-message`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token2}`,
                      },
                      body: JSON.stringify(message)
                    });
                    
                    get().removeFromRetryQueue(message.id);
                    console.log('✅ Retry message synced:', message.id);
                  } catch (error) {
                    console.warn('❌ Failed to sync retry message:', message.id, error);
                  }
                }
              }
            }
            
            // Then fetch latest data from server
            if (sync.online) {
              const { SimpleAuthService } = await import('../services/authServiceSimple');
              const session = await SimpleAuthService.getCurrentSession();
              
              const token2 = (session as any)?.data?.session?.access_token || (session as any)?.access_token || null;
              if (token2) {
                const fetchPromise = fetch(`/api/data?action=get-history`, {
                  headers: {
                    'Authorization': `Bearer ${token2}`,
                  }
                });
                
                const timeoutPromise = new Promise<Response>((_, reject) => 
                  setTimeout(() => reject(new Error('Sync timeout')), 8000)
                );
                
                const response = await Promise.race([fetchPromise, timeoutPromise]);
                
                if (response.ok) {
                  const data = await response.json();
                  
                  // Fetch messages from database
                  try {
                    const messagesResponse = await fetch(`/api/data?action=get-messages&profile_id=${user.id}`, {
                      headers: {
                        'Authorization': `Bearer ${token2}`,
                      }
                    });
                    
                    if (messagesResponse.ok) {
                      const messagesData = await messagesResponse.json();
                      console.log('📥 Messages API response:', messagesData);
                      if (messagesData.messages && messagesData.messages.length > 0) {
                        console.log(`✅ Loaded ${messagesData.messages.length} messages from database`);
                        console.log('📝 Sample message:', messagesData.messages[0]);
                        
                        // Merge with local messages (avoid duplicates)
                        const localMessages = get().messages;
                        const serverMessageIds = new Set(messagesData.messages.map((m: any) => m.id));
                        const localOnlyMessages = localMessages.filter(m => !serverMessageIds.has(m.id));
                        
                        set({ messages: [...messagesData.messages, ...localOnlyMessages] });
                        console.log('✅ Messages set in store, total:', get().messages.length);
                      } else {
                        console.warn('⚠️ No messages returned from API');
                      }
                    } else {
                      console.error('❌ Messages API failed:', messagesResponse.status);
                    }
                  } catch (error) {
                    console.warn('⚠️ Failed to load messages from database:', error);
                  }
                  
                  // Merge server data with local data
                  if (data.conversations && data.conversations.length > 0) {
                    const localConversations = get().conversations;
                    const mergedConversations = [...data.conversations];
                    
                    // Add any local conversations not on server
                    localConversations.forEach(localConv => {
                      if (!mergedConversations.find(c => c.id === localConv.id)) {
                        mergedConversations.push(localConv);
                      }
                    });
                    
                    set({ conversations: mergedConversations });
                  }
                  
                  // Merge messages
                  if (data.messages && data.messages.length > 0) {
                    const localMessages = get().messages;
                    const mergedMessages = [...data.messages];
                    
                    // Add any local messages not on server
                    localMessages.forEach(localMsg => {
                      if (!mergedMessages.find(m => m.id === localMsg.id)) {
                        mergedMessages.push(localMsg);
                      }
                    });
                    
                    set({ messages: mergedMessages });
                  }
                  
                  console.log('✅ Sync completed successfully');
                }
              }
            }
            
            // Update sync status
            set((state) => ({
              sync: { 
                ...state.sync, 
                lastSync: new Date(), 
                hasOfflineChanges: false,
                syncing: false
              }
            }));
            
          } catch (error) {
            console.error('❌ Sync failed:', error);
            (await import('../utils/logger')).logger.error('Sync failed:', error);
          } finally {
            set((state) => ({
              sync: { ...state.sync, syncing: false }
            }));
          }
        },
        
        resetStore: () => {
          set({
            user: null,
            conversations: [],
            activeConversationId: null,
            messages: [],
            currentTopic: 'General Conversation',
            placementTestProgress: defaultPlacementTestProgress,
            sync: defaultSyncStatus,
            retryQueue: []
          });
        },

        clearActiveSession: () => {
          // Clear current session state but keep user and conversations history
          set(() => ({
            activeConversationId: null,
            // DON'T clear messages - keep them for when user returns to old conversations
            currentTopic: 'New Conversation',
            // Keep user, conversations, messages, and other persistent data
          }));
        }
      }),
      {
        name: 'vibetune-app-store',
        storage: getStorage(),
        partialize: (state) => ({
          // Only persist essential data
          user: state.user,
          conversations: state.conversations,
          messages: state.messages, // IMPORTANT: Persist messages so they survive reload
          activeConversationId: state.activeConversationId, // Also persist active conversation
          placementTestProgress: state.placementTestProgress,
          retryQueue: state.retryQueue,
          currentTopic: state.currentTopic,
          sync: {
            ...state.sync,
            syncing: false // Don't persist syncing state
          }
        }),
        onRehydrateStorage: () => (state) => {
          // Initialize online status after rehydration
          if (state && typeof navigator !== 'undefined') {
            state.setSyncOnline(navigator.onLine);
          }
        },
      }
    )
  )
);

// Selectors
export const useUser = () => useAppStore((state) => state.user);
export const useConversations = () => useAppStore((state) => {
  const conversations = state.conversations;
  const user = state.user;
  // Filter conversations by current user to prevent data leakage
  if (!user) {
    console.log('🔍 useConversations: No user found');
    return [];
  }
  
  const userConversations = conversations.filter(conv => conv.profile_id === user.id);
  
  // Debug log only when there's a mismatch
  if (conversations.length > 0 && userConversations.length === 0) {
    console.log('🔍 useConversations: Filtering issue detected');
    console.log('- Total conversations:', conversations.length);
    console.log('- User ID:', user.id);
    console.log('- Profile IDs in conversations:', conversations.map(c => c.profile_id));
    console.log('- User conversations after filter:', userConversations.length);
  }
  
  return userConversations;
});
export const useMessages = () => useAppStore((state) => {
  const messages = state.messages;
  const user = state.user;
  const activeConversationId = state.activeConversationId;
  // Filter messages by current user and active conversation
  return user && activeConversationId 
    ? messages.filter(msg => msg.conversation_id === activeConversationId)
    : [];
});
export const useSync = () => useAppStore((state) => state.sync);
export const usePlacementTest = () => useAppStore((state) => state.placementTestProgress);
export const useRetryQueue = () => useAppStore((state) => state.retryQueue);

// Auto-sync on online status change
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setSyncOnline(true);
    useAppStore.getState().syncData();
  });
  
  window.addEventListener('offline', () => {
    useAppStore.getState().setSyncOnline(false);
  });
}