import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/appStore';
import type { Message, Conversation } from '../../store/appStore';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('AppStore', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      user: null,
      conversations: [],
      activeConversationId: null,
      messages: [],
      currentTopic: 'General Conversation',
      placementTestProgress: {
        currentQuestion: 0,
        totalQuestions: 10,
        answers: [],
        topic_scores: {},
        overall_progress: 0,
      },
      sync: {
        online: true,
        lastSync: null,
        syncing: false,
        hasOfflineChanges: false,
      },
      retryQueue: [],
    });

    vi.clearAllMocks();
  });

  describe('User State', () => {
    it('should set user correctly', () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        level: 'Intermediate' as const,
        placement_test_completed: true,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-01T00:00:00Z',
        device_id: 'device123'
      };

      useAppStore.getState().setUser(mockUser);
      
      expect(useAppStore.getState().user).toEqual(mockUser);
    });

    it('should clear user when set to null', () => {
      useAppStore.getState().setUser(null);
      
      expect(useAppStore.getState().user).toBeNull();
    });
  });

  describe('Message Management', () => {
    it('should add message correctly', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addMessage(mockMessage);
      
      expect(useAppStore.getState().messages).toContain(mockMessage);
    });

    it('should update message correctly', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addMessage(mockMessage);
      useAppStore.getState().updateMessage('msg123', { content: 'Updated message' });
      
      const updatedMessage = useAppStore.getState().messages.find(m => m.id === 'msg123');
      expect(updatedMessage?.content).toBe('Updated message');
    });

    it('should delete message correctly', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addMessage(mockMessage);
      useAppStore.getState().deleteMessage('msg123');
      
      expect(useAppStore.getState().messages).not.toContain(mockMessage);
    });

    it('should clear all messages', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addMessage(mockMessage);
      useAppStore.getState().clearMessages();
      
      expect(useAppStore.getState().messages).toHaveLength(0);
    });

    it('should mark offline changes when adding message offline', () => {
      // Set offline state
      useAppStore.getState().setSyncOnline(false);
      
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addMessage(mockMessage);
      
      expect(useAppStore.getState().sync.hasOfflineChanges).toBe(true);
    });
  });

  describe('Conversation Management', () => {
    it('should set conversations correctly', () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv123',
          profile_id: 'user123',
          topic: 'Travel',
          is_placement_test: false,
          started_at: '2024-01-01T00:00:00Z'
        }
      ];

      useAppStore.getState().setConversations(mockConversations);
      
      expect(useAppStore.getState().conversations).toEqual(mockConversations);
    });

    it('should set active conversation', () => {
      useAppStore.getState().setActiveConversation('conv123');
      
      expect(useAppStore.getState().activeConversationId).toBe('conv123');
    });

    it('should clear active conversation', () => {
      useAppStore.getState().setActiveConversation('conv123');
      useAppStore.getState().setActiveConversation(null);
      
      expect(useAppStore.getState().activeConversationId).toBeNull();
    });
  });

  describe('Placement Test', () => {
    it('should update placement test progress', () => {
      const updates = {
        currentQuestion: 5,
        overall_progress: 50
      };

      useAppStore.getState().updatePlacementTestProgress(updates);
      
      const progress = useAppStore.getState().placementTestProgress;
      expect(progress.currentQuestion).toBe(5);
      expect(progress.overall_progress).toBe(50);
    });

    it('should reset placement test', () => {
      // Set some progress first
      useAppStore.getState().updatePlacementTestProgress({
        currentQuestion: 5,
        overall_progress: 50
      });

      useAppStore.getState().resetPlacementTest();
      
      const progress = useAppStore.getState().placementTestProgress;
      expect(progress.currentQuestion).toBe(0);
      expect(progress.overall_progress).toBe(0);
      expect(progress.answers).toHaveLength(0);
    });
  });

  describe('Sync State', () => {
    it('should update online status', () => {
      useAppStore.getState().setSyncOnline(false);
      
      expect(useAppStore.getState().sync.online).toBe(false);
    });

    it('should update sync status', () => {
      useAppStore.getState().setSyncStatus(true);
      
      expect(useAppStore.getState().sync.syncing).toBe(true);
    });

    it('should update last sync time', () => {
      const now = new Date();
      useAppStore.getState().setLastSync(now);
      
      expect(useAppStore.getState().sync.lastSync).toBe(now);
    });

    it('should update offline changes flag', () => {
      useAppStore.getState().setHasOfflineChanges(true);
      
      expect(useAppStore.getState().sync.hasOfflineChanges).toBe(true);
    });
  });

  describe('Retry Queue', () => {
    it('should add message to retry queue', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addToRetryQueue(mockMessage);
      
      expect(useAppStore.getState().retryQueue).toContain(mockMessage);
    });

    it('should remove message from retry queue', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addToRetryQueue(mockMessage);
      useAppStore.getState().removeFromRetryQueue('msg123');
      
      expect(useAppStore.getState().retryQueue).not.toContain(mockMessage);
    });

    it('should clear retry queue', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Hello, AI!',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addToRetryQueue(mockMessage);
      useAppStore.getState().clearRetryQueue();
      
      expect(useAppStore.getState().retryQueue).toHaveLength(0);
    });
  });

  describe('Topic Management', () => {
    it('should set current topic', () => {
      useAppStore.getState().setCurrentTopic('Travel');
      
      expect(useAppStore.getState().currentTopic).toBe('Travel');
    });
  });

  describe('Store Reset', () => {
    it('should reset entire store', () => {
      // Set some state first
      useAppStore.getState().setUser({
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        level: 'Intermediate',
        placement_test_completed: true,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-01T00:00:00Z',
        device_id: 'device123'
      });
      useAppStore.getState().setCurrentTopic('Travel');

      useAppStore.getState().resetStore();
      
      const state = useAppStore.getState();
      expect(state.user).toBeNull();
      expect(state.currentTopic).toBe('General Conversation');
      expect(state.conversations).toHaveLength(0);
      expect(state.messages).toHaveLength(0);
      expect(state.retryQueue).toHaveLength(0);
    });
  });
});