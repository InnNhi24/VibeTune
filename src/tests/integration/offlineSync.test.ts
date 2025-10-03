import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store/appStore';
import type { Message } from '../../store/appStore';

// Mock fetch
global.fetch = vi.fn();

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

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

describe('Offline Sync Integration', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      user: {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        level: 'Intermediate',
        placement_test_completed: true,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-01T00:00:00Z',
        device_id: 'device123'
      },
      conversations: [],
      activeConversationId: 'conv123',
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
    vi.mocked(fetch).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Offline Message Handling', () => {
    it('should queue messages when offline', () => {
      // Set offline
      useAppStore.getState().setSyncOnline(false);

      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Offline message',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addMessage(mockMessage);

      // Should mark as having offline changes
      expect(useAppStore.getState().sync.hasOfflineChanges).toBe(true);
      expect(useAppStore.getState().messages).toContain(mockMessage);
    });

    it('should add failed messages to retry queue', () => {
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Failed message',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addToRetryQueue(mockMessage);

      expect(useAppStore.getState().retryQueue).toContain(mockMessage);
    });

    it('should process retry queue when coming back online', async () => {
      // Mock successful API response
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // Add message to retry queue
      const mockMessage: Message = {
        id: 'msg123',
        conversation_id: 'conv123',
        sender: 'user',
        type: 'text',
        content: 'Retry message',
        created_at: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z'
      };

      useAppStore.getState().addToRetryQueue(mockMessage);
      useAppStore.getState().setSyncOnline(false);
      useAppStore.getState().setHasOfflineChanges(true);

      // Simulate coming back online and syncing
      useAppStore.getState().setSyncOnline(true);
      await useAppStore.getState().syncData();

      // Retry queue should be processed
      expect(useAppStore.getState().retryQueue).toHaveLength(0);
      expect(useAppStore.getState().sync.hasOfflineChanges).toBe(false);
    });
  });

  describe('Sync Data Flow', () => {
    it('should sync successfully when online', async () => {
      // Mock successful sync response
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'conv123',
              profile_id: 'user123',
              topic: 'Travel',
              is_placement_test: false,
              started_at: '2024-01-01T00:00:00Z'
            }
          ],
          messages: [
            {
              id: 'msg123',
              conversation_id: 'conv123',
              sender: 'ai',
              type: 'text',
              content: 'AI response',
              created_at: '2024-01-01T00:00:00Z',
              timestamp: '2024-01-01T00:00:00Z'
            }
          ]
        })
      } as Response);

      // Mock auth service
      vi.doMock('../../services/authServiceSimple', () => ({
        SimpleAuthService: {
          getCurrentSession: vi.fn().mockResolvedValue({
            access_token: 'mock-token'
          })
        }
      }));

      vi.doMock('../../utils/supabase/info', () => ({
        projectId: 'mock-project-id'
      }));

      useAppStore.getState().setHasOfflineChanges(true);
      await useAppStore.getState().syncData();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/get-history'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );

      expect(useAppStore.getState().sync.hasOfflineChanges).toBe(false);
      expect(useAppStore.getState().sync.lastSync).toBeTruthy();
    });

    it('should handle sync errors gracefully', async () => {
      // Mock failed sync response
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      // Mock auth service
      vi.doMock('../../services/authServiceSimple', () => ({
        SimpleAuthService: {
          getCurrentSession: vi.fn().mockResolvedValue({
            access_token: 'mock-token'
          })
        }
      }));

      vi.doMock('../../utils/supabase/info', () => ({
        projectId: 'mock-project-id'
      }));

      useAppStore.getState().setHasOfflineChanges(true);
      
      await expect(useAppStore.getState().syncData()).resolves.not.toThrow();

      // Should still be marked as having offline changes
      expect(useAppStore.getState().sync.hasOfflineChanges).toBe(true);
      expect(useAppStore.getState().sync.syncing).toBe(false);
    });

    it('should not sync when offline', async () => {
      useAppStore.getState().setSyncOnline(false);
      
      await useAppStore.getState().syncData();

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should not sync when no user is present', async () => {
      useAppStore.getState().setUser(null);
      
      await useAppStore.getState().syncData();

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Conflict Resolution', () => {
    it('should handle latest-wins conflict resolution', async () => {
      // Mock response with newer data
      const newerTimestamp = '2024-01-02T00:00:00Z';
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: 'conv123',
              profile_id: 'user123',
              topic: 'Updated Travel Topic',
              is_placement_test: false,
              started_at: newerTimestamp
            }
          ],
          messages: []
        })
      } as Response);

      // Mock auth service
      vi.doMock('../../services/authServiceSimple', () => ({
        SimpleAuthService: {
          getCurrentSession: vi.fn().mockResolvedValue({
            access_token: 'mock-token'
          })
        }
      }));

      vi.doMock('../../utils/supabase/info', () => ({
        projectId: 'mock-project-id'
      }));

      // Set local data with older timestamp
      useAppStore.getState().setConversations([
        {
          id: 'conv123',
          profile_id: 'user123',
          topic: 'Old Travel Topic',
          is_placement_test: false,
          started_at: '2024-01-01T00:00:00Z'
        }
      ]);

      await useAppStore.getState().syncData();

      // Should update with server data (latest wins)
      const conversations = useAppStore.getState().conversations;
      expect(conversations[0]?.topic).toBe('Updated Travel Topic');
      expect(conversations[0]?.started_at).toBe(newerTimestamp);
    });
  });

  describe('Analytics During Offline', () => {
    it('should track events when online', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // Mock auth service
      vi.doMock('../../services/authServiceSimple', () => ({
        SimpleAuthService: {
          getCurrentSession: vi.fn().mockResolvedValue({
            access_token: 'mock-token'
          })
        }
      }));

      vi.doMock('../../utils/supabase/info', () => ({
        projectId: 'mock-project-id'
      }));

      await useAppStore.getState().trackEvent('test_event', { test: 'data' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('test_event')
        })
      );
    });

    it('should queue analytics events when offline', async () => {
      useAppStore.getState().setSyncOnline(false);

      await useAppStore.getState().trackEvent('offline_event', { test: 'data' });

      // Should not make API call when offline
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});