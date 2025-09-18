import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { AppSidebar } from "./AppSidebar";
import { ChatPanel } from "./ChatPanel";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { Menu, Mic } from "lucide-react";
import { Profile } from "../services/supabaseClient";

interface Conversation {
  id: string;
  title: string;
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
  const [currentLevel, setCurrentLevel] = useState(user.level);
  const [currentTopic, setCurrentTopic] = useState("General Conversation");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Mock conversation history
  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Travel Discussion',
      timestamp: '2 hours ago',
      messagesCount: 12,
      prosodyScore: 85
    },
    {
      id: '2',
      title: 'Food & Culture',
      timestamp: 'Yesterday',
      messagesCount: 8,
      prosodyScore: 78
    },
    {
      id: '3',
      title: 'Job Interview Practice',
      timestamp: '2 days ago',
      messagesCount: 15,
      prosodyScore: 92
    }
  ]);

  const handleConversationSelect = (conversation: Conversation) => {
    setCurrentTopic(conversation.title);
    setIsSidebarOpen(false);
  };

  const handleLevelChange = (level: string) => {
    setCurrentLevel(level);
  };

  return (
    <div className="h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-80 h-full">
        <AppSidebar
          user={user}
          currentLevel={currentLevel}
          onLevelChange={handleLevelChange}
          conversations={conversations}
          onConversationSelect={handleConversationSelect}
          placementTestProgress={25}
          onStartPlacementTest={onStartPlacementTest}
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
                  currentLevel={currentLevel}
                  onLevelChange={handleLevelChange}
                  conversations={conversations}
                  onConversationSelect={handleConversationSelect}
                  placementTestProgress={25}
                  onStartPlacementTest={onStartPlacementTest}
                  onLogout={onLogout}
                />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-accent" />
              <h1 className="font-semibold">VibeTune</h1>
            </div>

            <div className="flex items-center gap-2">
              <SyncStatusIndicator />
              {user.placement_test_completed && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onStartPlacementTest}
                  className="text-xs px-2"
                >
                  Redo Test
                </Button>
              )}
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-accent" />
              <h1 className="text-lg font-semibold">VibeTune</h1>
            </div>

            <div className="flex items-center gap-3">
              <SyncStatusIndicator />
              {user.placement_test_completed && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onStartPlacementTest}
                  className="text-sm"
                >
                  Redo Placement Test
                </Button>
              )}
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