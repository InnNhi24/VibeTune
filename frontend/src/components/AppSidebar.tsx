import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
// Progress component not used here
import { ScrollArea } from "./ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { 
  GraduationCap, 
  MessageCircle, 
  ChevronDown, 
  Clock, 
  CheckCircle2,
  User,
  Settings,
  LogOut,
  Award,
  BookOpen,
  Globe,
  Coffee,
  Briefcase,
  Heart,
  Gamepad2,
  Camera,
  Music,
  Utensils
} from "lucide-react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Profile } from "../services/supabaseClient";
import { Conversation } from "../store/appStore";

// Use the Conversation type from store
import { Conversation } from "../store/appStore";

interface AppSidebarProps {
  user: Profile;
  conversations: Conversation[];
  onConversationSelect: (conversation: Conversation) => void;
  onConversationDelete?: (conversationId: string) => void;
  onLogout: () => void;
  onSettings?: () => void;
}

export function AppSidebar({
  user,
  conversations,
  onConversationSelect,
  onConversationDelete,
  onLogout,
  onSettings
}: AppSidebarProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  
  // Group conversations by topic
  const getTopicIcon = (topic: string) => {
    const topicIcons: Record<string, any> = {
      "Travel & Adventures": Globe,
      "Daily Life & Routines": Coffee,
      "Work & Career": Briefcase,
      "Hobbies & Interests": Heart,
      "Entertainment & Gaming": Gamepad2,
      "Education & Learning": BookOpen,
      "Technology & Social Media": Camera,
      "Music & Arts": Music,
      "Food & Cooking": Utensils,
      "General Conversation": MessageCircle
    };
    return topicIcons[topic] || MessageCircle;
  };
  
  const groupedConversations = conversations.reduce((groups, conversation) => {
    const topic = conversation.topic || "General Conversation";
    if (!groups[topic]) {
      groups[topic] = [];
    }
    groups[topic].push(conversation);
    return groups;
  }, {} as Record<string, Conversation[]>);
  
  // Sort topics by most recent conversation
  const sortedTopics = Object.keys(groupedConversations).sort((a, b) => {
    const aLatest = Math.max(...groupedConversations[a].map(c => {
      try {
        const date = new Date(c.started_at || c.timestamp || Date.now());
        return isNaN(date.getTime()) ? Date.now() : date.getTime();
      } catch (e) {
        return Date.now();
      }
    }));
    const bLatest = Math.max(...groupedConversations[b].map(c => {
      try {
        const date = new Date(c.started_at || c.timestamp || Date.now());
        return isNaN(date.getTime()) ? Date.now() : date.getTime();
      } catch (e) {
        return Date.now();
      }
    }));
    return bLatest - aLatest;
  });

  // Determine level status and origin
  const hasLevel = !!user.level;
  const placementTestCompleted = user.placement_test_completed;
  const isLevelFromTest = hasLevel && placementTestCompleted;
  const isLevelSelfSelected = hasLevel && !placementTestCompleted;

  const getLevelOrigin = () => {
    if (isLevelFromTest) {
      return "Set by Placement Test";
    } else if (isLevelSelfSelected) {
      return "Self-selected";
    } else {
      return "Not set";
    }
  };

  const getLevelDescription = () => {
    if (!hasLevel) return "No level has been set yet.";
    
    const descriptions = {
      'Beginner': 'New to English pronunciation and prosody. Focus on basic patterns and guided practice.',
      'Intermediate': 'Some experience with English speaking. Practice complex patterns and natural conversation.',
      'Advanced': 'Strong English skills, refining prosody. Work on subtle nuances and accent reduction.'
    };
    
    return descriptions[user.level as keyof typeof descriptions] || "Custom learning level.";
  };

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

      <ScrollArea className="flex-1 overflow-x-hidden min-h-0">
        <div className="p-4 space-y-4">
          {/* Current Level Display Only - No Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Current Level ({getLevelOrigin()})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasLevel ? (
                <>
                  {/* Level Display Badge */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center justify-center"
                  >
                    <div className="flex items-center gap-3 bg-sidebar-primary/10 border border-sidebar-primary/20 rounded-lg px-4 py-4 w-full">
                      <div className="w-10 h-10 bg-sidebar-primary rounded-full flex items-center justify-center flex-shrink-0">
                        {isLevelFromTest ? (
                          <Award className="w-5 h-5 text-sidebar-primary-foreground" />
                        ) : (
                          <BookOpen className="w-5 h-5 text-sidebar-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-lg text-sidebar-foreground">{user.level}</div>
                        <div className="text-xs text-sidebar-foreground/60">
                          {isLevelFromTest ? "Assessed level" : "Self-selected level"}
                        </div>
                        {user.placement_test_score && (
                          <div className="text-xs text-sidebar-foreground/80 mt-1">
                            Test Score: {user.placement_test_score}%
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Level Description */}
                  <div className="bg-sidebar-accent/10 border border-sidebar-accent/20 rounded-lg p-3">
                    <p className="text-xs text-sidebar-foreground/80 leading-relaxed">
                      {getLevelDescription()}
                    </p>
                  </div>

                  {/* Level Status Note */}
                  <div className="text-center">
                    <p className="text-xs text-sidebar-foreground/60">
                      {isLevelFromTest 
                        ? "Your level was determined by placement test results for optimal learning."
                        : "You selected this level manually. Consider taking the placement test for a personalized assessment."
                      }
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* No Level Set */}
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-sidebar-accent/20 rounded-full flex items-center justify-center mx-auto">
                      <GraduationCap className="w-8 h-8 text-sidebar-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-sidebar-foreground">No Level Set</p>
                      <p className="text-xs text-sidebar-foreground/60 mt-1">
                        Use the placement test button in the top-right corner to get started with a personalized level assessment.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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
              <div className="mt-2 space-y-3 max-h-48 overflow-y-auto overflow-x-hidden pr-1">
                {conversations.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        No conversations yet. Start chatting to build your practice history!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  sortedTopics.map((topicName) => {
                    const topicConversations = groupedConversations[topicName];
                    const TopicIcon = getTopicIcon(topicName);
                    const avgScore = topicConversations
                      .filter(conv => conv.avg_prosody_score)
                      .reduce((sum, conv, _, arr) => sum + (conv.avg_prosody_score || 0) / arr.length, 0);

                    return (
                      <div key={topicName} className="space-y-2 overflow-hidden">
                        {/* Topic Header */}
                        <div className="flex items-center gap-2 px-2 py-1 bg-sidebar-accent/20 rounded">
                          <TopicIcon className="w-3 h-3 text-sidebar-accent" />
                          <span className="text-xs font-medium text-sidebar-foreground">{topicName}</span>
                          <div className="flex-1" />
                          <Badge variant="outline" className="text-xs">
                            {topicConversations.length} session{topicConversations.length !== 1 ? 's' : ''}
                          </Badge>
                          {avgScore > 0 && (
                            <Badge className="text-xs bg-sidebar-primary/20 text-sidebar-primary">
                              {Math.round(avgScore)}% avg
                            </Badge>
                          )}
                        </div>

                        {/* Conversations in Topic */}
                        <div className="space-y-1 ml-4 overflow-hidden">
                          {topicConversations
                            .sort((a, b) => {
                              try {
                                const dateA = new Date(a.started_at || Date.now());
                                const dateB = new Date(b.started_at || Date.now());
                                const timeA = isNaN(dateA.getTime()) ? Date.now() : dateA.getTime();
                                const timeB = isNaN(dateB.getTime()) ? Date.now() : dateB.getTime();
                                return timeB - timeA;
                              } catch (e) {
                                return 0;
                              }
                            })
                            .map((conversation) => {
                              const getScoreColor = (score: number) => {
                                if (score >= 85) return "bg-success text-success-foreground";
                                if (score >= 70) return "bg-secondary text-secondary-foreground";
                                if (score >= 60) return "bg-accent text-accent-foreground";
                                return "bg-destructive text-destructive-foreground";
                              };

                              const getCompletionStatus = (messagesCount: number) => {
                                if (messagesCount >= 20) return { status: "Complete", icon: CheckCircle2, color: "text-success" };
                                if (messagesCount >= 10) return { status: "In Progress", icon: Clock, color: "text-accent" };
                                return { status: "Started", icon: MessageCircle, color: "text-secondary" };
                              };

                              const completion = getCompletionStatus(conversation.message_count || 0);
                              const StatusIcon = completion.icon;

                                return (
                                <motion.div
                                  key={conversation.id}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                >
                                  <Card 
                                      className="group cursor-pointer hover:bg-sidebar-accent/30 transition-all duration-200 border-l-2 border-l-sidebar-primary/30 hover:border-l-sidebar-primary hover:shadow-sm w-full min-w-0 relative overflow-hidden"
                                      onClick={() => onConversationSelect(conversation)}
                                    >
                                    <CardContent className="p-2 relative overflow-hidden">
                                      <div className="space-y-2">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2 min-w-0">
                                          <h4 className="text-xs font-medium truncate text-sidebar-foreground flex-1 min-w-0">{conversation.title || 'New Conversation'}</h4>
                                          <div className="flex items-center gap-1">
                                            <StatusIcon className={`w-3 h-3 ${completion.color}`} />
                                            {conversation.avg_prosody_score && (
                                              <Badge className={`text-xs ${getScoreColor(conversation.avg_prosody_score)}`}>
                                                {conversation.avg_prosody_score}%
                                              </Badge>
                                            )}
                                          </div>
                                        </div>

                                        {/* Status and Time */}
                                        <div className="flex items-center justify-between min-w-0">
                                          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 flex-1 min-w-0">
                                            <Clock className="w-2 h-2 flex-shrink-0" />
                                            <span className="truncate">{
                                              (() => {
                                                try {
                                                  const date = new Date(conversation.started_at || Date.now());
                                                  return isNaN(date.getTime()) ? 'Today' : date.toLocaleDateString();
                                                } catch (e) {
                                                  return 'Today';
                                                }
                                              })()
                                            }</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Badge variant="outline" className={`text-xs ${completion.color}`}>
                                              {completion.status}
                                            </Badge>
                                            <span className="text-xs text-sidebar-foreground/60">{conversation.message_count || 0}msg</span>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                    {typeof onConversationDelete === 'function' && (
                                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onConversationDelete(conversation.id);
                                          }}
                                          className="h-6 w-6 p-0 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </Card>
                                </motion.div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Settings Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={onSettings}
          disabled={!onSettings}
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
        

      </div>
    </div>
  );
}