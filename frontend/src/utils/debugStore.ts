// Debug utilities for store
import { useAppStore } from '../store/appStore';

export const debugStore = {
  // Log current store state
  logState: () => {
    const state = useAppStore.getState();
    console.log('=== STORE DEBUG ===');
    console.log('User:', state.user);
    console.log('Conversations:', state.conversations);
    console.log('Messages:', state.messages);
    console.log('Active Conversation ID:', state.activeConversationId);
    console.log('Current Topic:', state.currentTopic);
    console.log('==================');
  },

  // Clear all store data
  clearStore: () => {
    const { resetStore } = useAppStore.getState();
    resetStore();
    console.log('Store cleared');
  },

  // Clear localStorage
  clearLocalStorage: () => {
    localStorage.removeItem('vibetune-app-store');
    console.log('LocalStorage cleared');
  },

  // Add test conversation
  addTestConversation: (userId: string) => {
    const { addConversation } = useAppStore.getState();
    const testConv = {
      id: `test_${Date.now()}`,
      profile_id: userId,
      topic: 'Test Topic',
      title: 'Test Conversation',
      is_placement_test: false,
      started_at: new Date().toISOString(),
      message_count: 2,
      avg_prosody_score: 85
    };
    addConversation(testConv);
    console.log('Test conversation added:', testConv);
  },

  // Check localStorage content
  checkLocalStorage: () => {
    const stored = localStorage.getItem('vibetune-app-store');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('LocalStorage content:', parsed);
        return parsed;
      } catch (e) {
        console.error('Failed to parse localStorage:', e);
      }
    } else {
      console.log('No localStorage data found');
    }
  }
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugStore = debugStore;
}