import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { AppSidebar } from "./AppSidebar";
import { ChatPanel } from "./ChatPanel";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { AIConnectionStatus } from "./AIConnectionStatus";
import { Settings } from "./Settings";
import { Menu, Mic, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Profile } from "../services/supabaseClient";
import { useAppStore, useConversations, useSync, Conversation } from "../store/appStore";



interface MainAppScreenProps {
  user: Profile;
  onLogout: () => void;
  onStartPlacementTest: () => void;
  onUserUpdate?: (updatedUser: Profile) => void;
}

export function MainAppScreen({ user, onLogout, onStartPlacementTest, onUserUpdate }: MainAppScreenProps) {
  // Use user's actual level, fallback to Beginner if no level set
  const currentLevel = user.level || "Beginner";
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Get state from Zustand store
  const conversations = useConversations();
  const sync = useSync();
  
  // Debug logging
  useEffect(() => {
    console.log('MainAppScreen - Debug Info:', {
      user: user,
      userId: user?.id,
      conversationsCount: conversations.length,
      conversations: conversations
    });
  }, [user, conversations]);
  const { 
    currentTopic, 
    setCurrentTopic, 
    setActiveConversation, 
    initializeApp,
    syncData,
    trackEvent,
    setUser
  } = useAppStore();

  // Initialize app when component mounts
  useEffect(() => {
    // Set user in store first
    setUser(user);
    initializeApp();
    trackEvent('main_app_viewed', { user_level: currentLevel });
  }, [user, setUser, initializeApp, trackEvent, currentLevel]);

  // Auto-sync when online
  useEffect(() => {
    if (sync.online && !sync.syncing && sync.hasOfflineChanges) {
      syncData();
    }
  }, [sync.online, sync.syncing, sync.hasOfflineChanges, syncData]);

  const handleConversationSelect = (conversation: Conversation) => {
    // Set topic from conversation if available, otherwise use title
    const topicToSet = conversation.topic || conversation.title || 'New Conversation';
    setCurrentTopic(topicToSet);
    setActiveConversation(conversation.id);
    setIsSidebarOpen(false);
    trackEvent('conversation_selected', { 
      conversation_id: conversation.id,
      topic: topicToSet
    });
    
    // Force sync to load messages for this conversation
    try {
      void syncData();
    } catch (e) {
      console.warn('Failed to sync data when selecting conversation:', e);
    }
  };

  const handleConversationDelete = (conversationId: string) => {
    // Remove locally and trigger sync. Caller should confirm deletion in UI.
    const store = useAppStore.getState();
    const remaining = store.conversations.filter(c => c.id !== conversationId);
    try {
      store.setConversations(remaining);
      // attempt server-side deletion as best-effort (backend route optional)
      void fetch(`/api/delete-conversation/${conversationId}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {
      // ignore
    }
  };

  // Determine placement test button text based on user status
  const getPlacementTestButtonText = () => {
    if (user.placement_test_completed) {
      return "Retake Placement Test";
    } else {
      return "Take Placement Test";
    }
  };

  const getPlacementTestIcon = () => {
    if (user.placement_test_completed) {
      return TrendingUp;
    } else {
      return Zap;
    }
  };

  return (
  // Root: lock viewport height and prevent page scroll
  <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-80 h-full">
        <AppSidebar
          user={user}
          conversations={conversations}
          onConversationSelect={handleConversationSelect}
          onConversationDelete={handleConversationDelete}
          onLogout={onLogout}
          onSettings={() => setShowSettings(true)}
        />
      </div>

    {/* Main Content */}
  <div className="flex-1 flex flex-col">
  {/* Header - Both Mobile and Desktop */}
  <div className="shrink-0 bg-card border-b border-border p-4">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <AppSidebar
                  user={user}
                  conversations={conversations}
                  onConversationSelect={handleConversationSelect}
                  onLogout={onLogout}
                  onSettings={() => {
                    setShowSettings(true);
                    setIsSidebarOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-accent" />
              <h1 className="font-semibold">VibeTune</h1>
            </div>

            <div className="flex items-center gap-2">
              <SyncStatusIndicator compact={true} showLabel={false} />
              <AIConnectionStatus size="sm" showLabel={false} />
              {/* Prominent Placement Test Button - Mobile */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  onClick={onStartPlacementTest}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-md"
                  size="sm"
                >
                  {React.createElement(getPlacementTestIcon(), { className: "w-4 h-4 mr-1" })}
                  <span className="hidden xs:inline">
                    {user.placement_test_completed ? "Retake Test" : "Take Test"}
                  </span>
                  <span className="xs:hidden">
                    {user.placement_test_completed ? "Retake" : "Test"}
                  </span>
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-accent" />
              <h1 className="text-lg font-semibold">VibeTune</h1>
            </div>

            <div className="flex items-center gap-4">
              <SyncStatusIndicator compact={false} showLabel={true} />
              <AIConnectionStatus size="md" showLabel={true} />
              
              {/* Prominent Placement Test Button - Desktop */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  onClick={onStartPlacementTest}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg px-4 py-2"
                  size="default"
                >
                  {React.createElement(getPlacementTestIcon(), { className: "w-4 h-4 mr-2" })}
                  {getPlacementTestButtonText()}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>

    {/* Chat Panel - Relative container for absolute positioned ChatPanel */}
  <main className="flex-1 p-4 relative">
      <ChatPanel
        topic={currentTopic}
        level={currentLevel}
        onTopicChange={setCurrentTopic}
        user={user}
      />
    </main>
      </div>

      {/* Settings Modal/Overlay */}
      {showSettings && (
        // Make the overlay scrollable so the Settings content can be scrolled on small viewports
        <div className="fixed inset-0 z-50 bg-background overflow-auto">
          <Settings
            user={user}
            onUserUpdate={(updatedUser) => {
              if (onUserUpdate) {
                onUserUpdate(updatedUser);
              }
            }}
            onBack={() => setShowSettings(false)}
            onStartPlacementTest={() => {
              setShowSettings(false);
              onStartPlacementTest();
            }}
          />
        </div>
      )}
    </div>
  );
}

