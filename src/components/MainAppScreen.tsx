import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { AppSidebar } from "./AppSidebar";
import { ChatPanel } from "./ChatPanel";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { AIConnectionStatus } from "./AIConnectionStatus";
import { Menu, Mic, TrendingUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import { Profile } from "../services/supabaseClient";
import { useAppStore, useConversations, useSync } from "../store/appStore";

interface Conversation {
  id: string;
  title: string;
  topic?: string;
  timestamp: string;
  messagesCount: number;
  prosodyScore?: number;
}

interface MainAppScreenProps {
  user: Profile;
  onLogout: () => void;
  onStartPlacementTest: () => void;
}

export function MainAppScreen({ user, onLogout, onStartPlacementTest }: MainAppScreenProps) {
  // Use user's actual level, fallback to Beginner if no level set
  const currentLevel = user.level || "Beginner";
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Get state from Zustand store
  const conversations = useConversations();
  const sync = useSync();
  const { 
    currentTopic, 
    setCurrentTopic, 
    setActiveConversation, 
    initializeApp,
    syncData,
    trackEvent
  } = useAppStore();

  // Initialize app when component mounts
  useEffect(() => {
    initializeApp();
    trackEvent('main_app_viewed', { user_level: currentLevel });
  }, [initializeApp, trackEvent, currentLevel]);

  // Auto-sync when online
  useEffect(() => {
    if (sync.online && !sync.syncing && sync.hasOfflineChanges) {
      syncData();
    }
  }, [sync.online, sync.syncing, sync.hasOfflineChanges, syncData]);

  const handleConversationSelect = (conversation: Conversation) => {
    // Set topic from conversation if available, otherwise use title
    const topicToSet = conversation.topic || conversation.title;
    setCurrentTopic(topicToSet);
    setActiveConversation(conversation.id);
    setIsSidebarOpen(false);
    trackEvent('conversation_selected', { 
      conversation_id: conversation.id,
      topic: topicToSet
    });
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
    <div className="h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-80 h-full">
        <AppSidebar
          user={user}
          conversations={conversations}
          onConversationSelect={handleConversationSelect}
          onLogout={onLogout}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header - Both Mobile and Desktop */}
        <div className="bg-card border-b border-border p-4">
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

        {/* Chat Panel */}
        <div className="flex-1">
          <ChatPanel
            topic={currentTopic}
            level={currentLevel}
            onTopicChange={setCurrentTopic}
          />
        </div>
      </div>
    </div>
  );
}

