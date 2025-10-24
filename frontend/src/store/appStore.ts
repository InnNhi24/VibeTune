import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Profile } from '../services/supabaseClient';

// Types
export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'audio';
  content: string;
  audio_url?: string;
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
  is_placement_test: boolean;
  started_at: string;
  ended_at?: string;
  message_count?: number;
  avg_prosody_score?: number;
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
          
          // Mark as having offline changes if we're offline
          if (!get().sync.online) {
            set((state) => ({
              sync: { ...state.sync, hasOfflineChanges: true }
            }));
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
        clearMessages: () => set({ messages: [] }),
        
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
          if (!user || !sync.online) return;
          
          set((state) => ({
            sync: { ...state.sync, syncing: true }
          }));
          
          try {
            const { SimpleAuthService } = await import('../services/authServiceSimple');
            const session = await SimpleAuthService.getCurrentSession();
            
            const token2 = (session as any)?.data?.session?.access_token || (session as any)?.access_token || null;
            if (!token2) {
              throw new Error('No valid session for sync');
            }
            
            // Get history from server with timeout
            const fetchPromise = fetch(`/api/get-history`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              }
            });
            
            const timeoutPromise = new Promise<Response>((_, reject) => 
              setTimeout(() => reject(new Error('Sync timeout')), 5000)
            );
            
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (response.ok) {
              const data = await response.json();
              
              // Update conversations
              if (data.conversations) {
                set({ conversations: data.conversations });
              }
              
              // Update messages for active conversation
              if (data.messages && get().activeConversationId) {
                const conversationMessages = data.messages.filter(
                  (msg: Message) => msg.conversation_id === get().activeConversationId
                );
                set({ messages: conversationMessages });
              }
              
              // Clear offline changes flag
              set((state) => ({
                sync: { 
                  ...state.sync, 
                  lastSync: new Date(), 
                  hasOfflineChanges: false,
                  syncing: false
                }
              }));
              
              // Process retry queue
              const retryQueue = get().retryQueue;
              if (retryQueue.length > 0) {
                for (const message of retryQueue) {
                  try {
                    await fetch(`/api/save-message`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token2}`,
                      },
                      body: JSON.stringify(message)
                    });
                    
                    get().removeFromRetryQueue(message.id);
                  } catch (error) {
                    (await import('../utils/logger')).logger.warn('Failed to sync retry message:', message.id, error);
                  }
                }
              }
            }
          } catch (error) {
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
        }
      }),
      {
        name: 'vibetune-app-store',
        storage: getStorage(),
        partialize: (state) => ({
          // Only persist essential data
          user: state.user,
          conversations: state.conversations,
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
export const useConversations = () => useAppStore((state) => state.conversations);
export const useMessages = () => useAppStore((state) => state.messages);
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