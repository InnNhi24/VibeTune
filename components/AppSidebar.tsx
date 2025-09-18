import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { 
  GraduationCap, 
  MessageCircle, 
  ChevronDown, 
  Clock, 
  TrendingUp,
  CheckCircle2,
  User,
  Settings,
  LogOut
} from "lucide-react";
import { Profile } from "../services/supabaseClient";

interface Conversation {
  id: string;
  title: string;
  timestamp: string;
  messagesCount: number;
  prosodyScore?: number;
}

interface AppSidebarProps {
  user: Profile;
  currentLevel: string;
  onLevelChange: (level: string) => void;
  conversations: Conversation[];
  onConversationSelect: (conversation: Conversation) => void;
  placementTestProgress?: number;
  onStartPlacementTest: () => void;
  onLogout: () => void;
}

export function AppSidebar({
  user,
  currentLevel,
  onLevelChange,
  conversations,
  onConversationSelect,
  placementTestProgress = 0,
  onStartPlacementTest,
  onLogout
}: AppSidebarProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isPlacementOpen, setIsPlacementOpen] = useState(false);

  const levels = ['Beginner', 'Intermediate', 'Advanced'];

  return (
    <div className="w-full h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* User Profile */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-accent rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sidebar-foreground truncate">{user.username}</p>
            <p className="text-sm text-sidebar-foreground/70 truncate">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Level Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Current Level
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {levels.map((level) => (
                <Button
                  key={level}
                  variant={currentLevel === level ? "default" : "outline"}
                  size="sm"
                  className={`w-full justify-start ${
                    currentLevel === level 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : ""
                  }`}
                  onClick={() => onLevelChange(level)}
                >
                  {level}
                  {currentLevel === level && (
                    <CheckCircle2 className="w-4 h-4 ml-auto" />
                  )}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Placement Test Panel - Only show for users who have completed placement test */}
          {user.placement_test_completed && (
            <Collapsible open={isPlacementOpen} onOpenChange={setIsPlacementOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Redo Placement Test
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${
                    isPlacementOpen ? 'rotate-180' : ''
                  }`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        Retake the placement test to update your learning level based on your current progress.
                      </p>
                      <Button
                        size="sm"
                        className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90"
                        onClick={onStartPlacementTest}
                      >
                        Retake Placement Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Conversation History */}
          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  History ({conversations.length})
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${
                  isHistoryOpen ? 'rotate-180' : ''
                }`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                {conversations.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        No conversations yet. Start chatting to build your history!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  conversations.map((conversation) => (
                    <Card 
                      key={conversation.id} 
                      className="cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
                      onClick={() => onConversationSelect(conversation)}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium truncate">{conversation.title}</h4>
                            {conversation.prosodyScore && (
                              <Badge variant="outline" className="text-xs">
                                {conversation.prosodyScore}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{conversation.timestamp}</span>
                            <span>•</span>
                            <span>{conversation.messagesCount} messages</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Settings Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <Button variant="outline" className="w-full justify-start">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}