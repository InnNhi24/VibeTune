import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { AppSidebar } from "./AppSidebar";
import { ChatPanel } from "./ChatPanel";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { AIConnectionStatus } from "./AIConnectionStatus";
import { Settings } from "./Settings";
import { Menu, Mic, TrendingUp, Zap, PanelLeftClose } from "lucide-react";
import { motion } from "framer-motion";
import { Profile } from "../services/supabaseClient";
import { useAppStore, useConversations, useSync, Conversation } from "../store/appStore";
import "../utils/debugStore"; // Import debug utilities



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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Get state from Zustand store
  const conversations = useConversations();
  const sync = useSync();
  

  const { 
    currentTopic, 
    setCurrentTopic, 
    setActiveConversation,
    activeConversationId,
    initializeApp,
    syncData,
    trackEvent,
    setUser,
    deleteConversation
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
  };

  const handleConversationDelete = (conversationId: string) => {
    // Check if deleting the currently active conversation
    const isActiveConversation = activeConversationId === conversationId;
    
    // Use store method to delete conversation and all its messages
    // This will trigger re-render because we're using the hook
    deleteConversation(conversationId);
    
    // If deleting active conversation, update UI to show new conversation state
    if (isActiveConversation) {
      setCurrentTopic('New Conversation');
      setActiveConversation(null);
    }
    
    // Attempt server-side deletion (non-blocking)
    console.log('🗑️ Deleting conversation from server:', conversationId);
    fetch(`/api/data?action=delete-conversation&id=${conversationId}`, { method: 'DELETE' })
      .then(async response => {
        const data = await response.json();
        if (response.ok) {
          console.log('✅ Conversation deleted from server:', conversationId, data);
        } else {
          console.error('❌ Failed to delete from server:', response.status, data);
        }
      })
      .catch(error => {
        console.error('❌ Delete request failed:', error);
      });
  };

  const handleNewConversation = () => {
    // Clear active conversation and reset to completely new session
    setActiveConversation(null);
    setCurrentTopic('New Conversation');
    
    // Force ChatPanel to reset completely by clearing any cached state
    // This ensures we start fresh topic discovery for new session
    const store = useAppStore.getState();
    store.clearActiveSession(); // Will implement this method
    
    trackEvent('new_conversation_started', { user_level: currentLevel });
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
  <div className="main-app-container flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.div 
        className="hidden md:block h-full relative"
        initial={false}
        animate={{ 
          width: isSidebarCollapsed ? 60 : 320 
        }}
        transition={{ 
          duration: 0.3, 
          ease: "easeInOut" 
        }}
      >
        <AppSidebar
          user={user}
          conversations={conversations}
          onConversationSelect={handleConversationSelect}
          onConversationDelete={handleConversationDelete}
          onNewConversation={handleNewConversation}
          onLogout={onLogout}
          onSettings={() => setShowSettings(true)}
          isCollapsed={isSidebarCollapsed}
        />
        
        {/* Collapse Toggle at Border */}
        <motion.div 
          className="absolute top-1/2 -translate-y-1/2 z-20"
          animate={{ 
            right: isSidebarCollapsed ? -12 : -12 
          }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="h-12 w-6 p-0 rounded-r-lg rounded-l-none bg-background/95 backdrop-blur-sm border border-l-0 border-border/50 shadow-md hover:shadow-lg hover:bg-accent/10 transition-all duration-200 group"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <motion.div
              animate={{ rotate: isSidebarCollapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <PanelLeftClose className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            </motion.div>
          </Button>
        </motion.div>
      </motion.div>

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
                  onConversationDelete={handleConversationDelete}
                  onNewConversation={() => {
                    handleNewConversation();
                    setIsSidebarOpen(false);
                  }}
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
        key={activeConversationId || 'new'} // Force re-mount when switching conversations
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

