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
  },

  // Check backup messages
  checkBackup: () => {
    const backup = localStorage.getItem('vibetune-messages-backup');
    if (backup) {
      try {
        const parsed = JSON.parse(backup);
        console.log('Backup messages:', parsed);
        return parsed;
      } catch (e) {
        console.error('Failed to parse backup:', e);
      }
    } else {
      console.log('No backup data found');
    }
  },

  // Restore from backup
  restoreFromBackup: () => {
    const backup = localStorage.getItem('vibetune-messages-backup');
    if (backup) {
      try {
        const parsed = JSON.parse(backup);
        const { setConversations, setActiveConversation } = useAppStore.getState();
        
        if (parsed.conversations) {
          setConversations(parsed.conversations);
        }
        if (parsed.activeConversationId) {
          setActiveConversation(parsed.activeConversationId);
        }
        
        // Manually set messages
        useAppStore.setState({ messages: parsed.messages || [] });
        
        console.log('✅ Restored from backup:', parsed.messages?.length || 0, 'messages');
        return true;
      } catch (e) {
        console.error('❌ Failed to restore from backup:', e);
        return false;
      }
    } else {
      console.log('No backup to restore from');
      return false;
    }
  },

  // Force save current state
  forceSave: () => {
    try {
      const currentState = useAppStore.getState();
      const storeData = {
        user: currentState.user,
        conversations: currentState.conversations,
        messages: currentState.messages,
        activeConversationId: currentState.activeConversationId,
        placementTestProgress: currentState.placementTestProgress,
        retryQueue: currentState.retryQueue,
        currentTopic: currentState.currentTopic,
        sync: {
          ...currentState.sync,
          syncing: false,
          hasOfflineChanges: true
        }
      };
      localStorage.setItem('vibetune-app-store', JSON.stringify({ state: storeData, version: 0 }));
      console.log('✅ Force saved current state');
      return true;
    } catch (e) {
      console.error('❌ Failed to force save:', e);
      return false;
    }
  },

  // Create conversation for current topic if missing
  createMissingConversation: () => {
    const state = useAppStore.getState();
    const { user, currentTopic, activeConversationId, conversations, addConversation, setActiveConversation } = state;
    
    if (!user) {
      console.error('❌ No user found');
      return false;
    }

    if (!currentTopic || currentTopic === 'New Conversation') {
      console.error('❌ No valid topic to create conversation for');
      return false;
    }

    // Check if conversation already exists
    const existingConv = conversations.find(c => c.topic === currentTopic || c.id === activeConversationId);
    if (existingConv) {
      console.log('✅ Conversation already exists:', existingConv.id);
      return true;
    }

    // Create new conversation
    const newConvId = `topic_${Date.now()}`;
    const newConv = {
      id: newConvId,
      profile_id: user.id,
      topic: currentTopic,
      title: currentTopic,
      is_placement_test: false,
      started_at: new Date().toISOString(),
      message_count: 0,
      avg_prosody_score: 0
    };

    addConversation(newConv);
    setActiveConversation(newConvId);
    
    // Force save
    debugStore.forceSave();
    
    console.log('✅ Created missing conversation:', newConv);
    return true;
  },

  // Fix music conversation specifically
  fixMusicConversation: () => {
    const state = useAppStore.getState();
    const { user, setCurrentTopic, addConversation, setActiveConversation } = state;
    
    if (!user) {
      console.error('❌ No user found');
      return false;
    }

    // Create music conversation
    const musicConvId = `music_${Date.now()}`;
    const musicConv = {
      id: musicConvId,
      profile_id: user.id,
      topic: 'music',
      title: 'Music',
      is_placement_test: false,
      started_at: new Date().toISOString(),
      message_count: 2,
      avg_prosody_score: 0
    };

    addConversation(musicConv);
    setActiveConversation(musicConvId);
    setCurrentTopic('music');
    
    // Add some sample messages for music topic
    const welcomeMsg = {
      id: `msg_${Date.now()}_1`,
      conversation_id: musicConvId,
      sender: 'ai' as const,
      type: 'text' as const,
      content: "So let's talk about music! What kind of music do you like?",
      created_at: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const userMsg = {
      id: `msg_${Date.now()}_2`,
      conversation_id: musicConvId,
      sender: 'user' as const,
      type: 'text' as const,
      content: "I love music! I like pop and rock music.",
      created_at: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Add messages to store
    useAppStore.setState(state => ({
      messages: [...state.messages, welcomeMsg, userMsg]
    }));
    
    // Force save
    debugStore.forceSave();
    
    console.log('✅ Fixed music conversation with sample messages');
    return true;
  }
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugStore = debugStore;
}