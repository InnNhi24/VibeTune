import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";

import { Card, CardContent } from "./ui/card";

import { MessageBubble } from "./MessageBubble";
import { RecordingControls } from "./RecordingControls";
import { ProsodyFeedback } from "./ProsodyFeedback";
import { AIConnectionStatus } from "./AIConnectionStatus";
import { Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { aiProsodyService, ConversationContext, ProsodyAnalysis, AIResponse } from "../services/aiProsodyService";
import { useAppStore, useMessages, Message as StoreMessage } from "../store/appStore";
import { useUser } from '../store/appStore';
import { logger } from "../utils/logger";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  isAudio?: boolean;
  audioBlob?: Blob;
  timestamp: string;
  prosodyAnalysis?: ProsodyAnalysis;
  aiResponse?: AIResponse;
  isProcessing?: boolean;
}

interface ChatPanelProps {
  topic?: string;
  level: string | null;
  onTopicChange?: (topic: string) => void;
}

export function ChatPanel({ topic = "New Conversation", level, onTopicChange }: ChatPanelProps) {
  // Handle null/undefined level gracefully
  const safeLevel = (level || "Beginner") as 'Beginner' | 'Intermediate' | 'Advanced';
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const sendingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationContext['conversation_history']>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>(['basic pronunciation', 'sentence stress']);
  const [currentAnalysis, setCurrentAnalysis] = useState<ProsodyAnalysis | null>(null);
  const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [isTextareaMode, setIsTextareaMode] = useState(false);
  const [waitingForTopic, setWaitingForTopic] = useState(true);
  const [currentTopic, setCurrentTopic] = useState(topic);
  const scrollAreaRef = useRef<HTMLDivElement>(null);




  // Check AI service status
  useEffect(() => {
    const checkAI = () => {
      setAiReady(aiProsodyService.isReady());
    };
    
    checkAI();
    
    // Check every 5 seconds for configuration changes
    const interval = setInterval(checkAI, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize with welcome message and topic request
  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      text: `🎉 Hi! I'm your VibeTune AI conversation partner. Let's practice English at a ${safeLevel.toLowerCase()} level with AI-powered pronunciation feedback!`,
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const topicQuestion: Message = {
      id: '2',
      text: "What would you like to talk about today? Feel free to tell me about anything that interests you - your hobbies, work, travel experiences, or any topic you'd like to practice discussing in English!",
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([welcomeMessage, topicQuestion]);
    setConversationHistory([]);
    setFocusAreas(getFocusAreasForLevel(safeLevel));
    setWaitingForTopic(true);
    setCurrentTopic("New Conversation");
  }, [safeLevel]);

  // Auto-scroll to bottom when new messages arrive.
  // Use the last-message element scrollIntoView first (more robust),
  // then fallback to the Radix viewport scrollTop behavior.
  useEffect(() => {
    try {
      if (scrollAreaRef.current) {
        // Try to find the last rendered message element that we mark with data-last-message
        const lastMsgEl = scrollAreaRef.current.querySelector('[data-last-message]');
        if (lastMsgEl) {
          // Use scrollIntoView so that varying content (images/audio) is handled correctly
          (lastMsgEl as HTMLElement).scrollIntoView({ block: 'end', behavior: 'smooth' });
          return;
        }

        // Fallback: target the Radix viewport directly
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          setTimeout(() => {
            try {
              (scrollContainer as HTMLElement).scrollTop = (scrollContainer as HTMLElement).scrollHeight;
            } catch (e) {
              // If scroll fails, surface a debug message to the console
              // so we can reproduce and inspect DOM structure in the app.
              // eslint-disable-next-line no-console
              console.warn('ChatPanel: fallback scroll failed', e);
            }
          }, 100);
          return;
        }
      }

      // If we reach here, both the last message and viewport were not found
      // Log an informative message to help debugging layout issues.
      // eslint-disable-next-line no-console
      console.warn('ChatPanel: unable to find scroll container or last message element to auto-scroll');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ChatPanel auto-scroll error:', err);
    }
  }, [messages]);

  const getFocusAreasForLevel = (userLevel: string): string[] => {
    switch (userLevel) {
      case 'Advanced':
        return ['accent reduction', 'complex intonation', 'natural rhythm', 'connected speech'];
      case 'Intermediate':
        return ['word stress', 'question intonation', 'sentence rhythm', 'linking sounds'];
      default:
        return ['basic pronunciation', 'sentence stress', 'clear articulation', 'simple intonation'];
    }
  };

  // Extract topic from user message
  const extractTopicFromMessage = (message: string): string => {
    const trimmed = message.trim();
    // Ignore very short messages or simple greetings as topics
    if (trimmed.length < 6) return null as any;
    const lowerMessage = message.toLowerCase();
    // common greetings should not be treated as topic
    const greetings = ['hi', 'hey', 'hello', 'hii', 'hiii', 'hiya'];
    if (greetings.includes(lowerMessage.trim())) return null as any;
    
    // Simple topic extraction based on keywords
    if (lowerMessage.includes('travel') || lowerMessage.includes('trip') || lowerMessage.includes('vacation') || lowerMessage.includes('country') || lowerMessage.includes('visit')) {
      return 'Travel & Adventures';
    } else if (lowerMessage.includes('work') || lowerMessage.includes('job') || lowerMessage.includes('career') || lowerMessage.includes('office') || lowerMessage.includes('business')) {
      return 'Work & Career';
    } else if (lowerMessage.includes('food') || lowerMessage.includes('cook') || lowerMessage.includes('eat') || lowerMessage.includes('restaurant') || lowerMessage.includes('recipe')) {
      return 'Food & Cooking';
    } else if (lowerMessage.includes('music') || lowerMessage.includes('art') || lowerMessage.includes('paint') || lowerMessage.includes('draw') || lowerMessage.includes('sing')) {
      return 'Music & Arts';
    } else if (lowerMessage.includes('hobby') || lowerMessage.includes('interest') || lowerMessage.includes('free time') || lowerMessage.includes('enjoy') || lowerMessage.includes('love')) {
      return 'Hobbies & Interests';
    } else if (lowerMessage.includes('daily') || lowerMessage.includes('routine') || lowerMessage.includes('morning') || lowerMessage.includes('evening') || lowerMessage.includes('weekend')) {
      return 'Daily Life & Routines';
    } else if (lowerMessage.includes('game') || lowerMessage.includes('movie') || lowerMessage.includes('tv') || lowerMessage.includes('entertainment') || lowerMessage.includes('fun')) {
      return 'Entertainment & Gaming';
    } else if (lowerMessage.includes('learn') || lowerMessage.includes('study') || lowerMessage.includes('school') || lowerMessage.includes('education') || lowerMessage.includes('book')) {
      return 'Education & Learning';
    } else if (lowerMessage.includes('technology') || lowerMessage.includes('computer') || lowerMessage.includes('phone') || lowerMessage.includes('internet') || lowerMessage.includes('social media')) {
      return 'Technology & Social Media';
    } else {
      // Try to extract a key noun or phrase as the topic
      const words = message.split(' ').filter(word => word.length > 3);
      if (words.length > 0) {
        return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
      }
      return 'General Conversation';
    }
  };

  // Map a human-readable topic label to a normalized topic code used by the DB
  const mapTopicLabelToCode = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('travel')) return 'travel';
    if (l.includes('work') || l.includes('career') || l.includes('job')) return 'work';
    if (l.includes('food') || l.includes('cook')) return 'food';
    if (l.includes('music') || l.includes('art')) return 'entertainment';
    if (l.includes('hobby') || l.includes('interest')) return 'hobby';
    if (l.includes('daily')) return 'daily_small_talk';
    if (l.includes('greet') || l.includes('hello')) return 'greeting';
    // default fallback code
    return 'general';
  };

  const buildConversationContext = (): ConversationContext => {
    return {
      user_level: safeLevel,
      topic: currentTopic,
      conversation_history: conversationHistory,
      focus_areas: focusAreas,
      learning_objectives: [
        'Improve pronunciation accuracy',
        'Master natural rhythm patterns',
        'Develop confident speaking skills'
      ]
    };
  };

  const handleSendMessage = async (messageText: string, isAudio: boolean = false, audioBlob?: Blob) => {
    if (!messageText.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = Date.now().toString();
    
    // If this is the first user message, extract topic and update conversation title
    if (waitingForTopic) {
      const extractedLabel = extractTopicFromMessage(messageText.trim());
      // Only proceed if we were able to extract a meaningful topic label
      if (extractedLabel) {
        const topicCode = mapTopicLabelToCode(extractedLabel);

        // Display the human-friendly label in the UI, but send topicCode to server/db
        setCurrentTopic(extractedLabel);
        setWaitingForTopic(false);

        if (onTopicChange) {
          onTopicChange(extractedLabel);
        }

        // Create a conversation immediately on topic confirmation so subsequent
        // messages can be attached to a conversationId. Call server /api/chat
        // with stage='topic' and use the returned conversationId to update app state.
        try {
          const store = useAppStore.getState();
          const profile = store.user;
          const payload = {
            text: messageText.trim(),
            stage: 'topic',
            profileId: profile?.id || null,
            level: safeLevel,
            // IMPORTANT: pass normalized topic code, not free-form message text
            topic: topicCode
          } as any;

          const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data) {
              // If the server confirms the topic (from model control tag), prefer that
              if (data.topic_confirmed) {
                // Update local UI and global store
                setCurrentTopic(data.topic_confirmed);
                if (onTopicChange) onTopicChange(data.topic_confirmed);
              }

              if (data.conversationId) {
                // Set active conversation and refresh history so sidebar updates
                store.setActiveConversation(data.conversationId);
                // Trigger a sync to refresh conversations list
                try { await store.syncData(); } catch (e) { /* best-effort */ }
              }

              // Helpful debug: surface when persistence is disabled on the server
              if (data.persistence_disabled) {
                console.warn('Server indicated persistence is disabled for /api/chat responses');
              }
            }
          }
        } catch (err) {
          logger.warn('Failed to create conversation on topic confirmation', err);
        }
      }
    }
    
    // Add user message immediately
    const userMessage: Message = {
      id: messageId,
      text: messageText.trim(),
      isUser: true,
      isAudio,
      audioBlob,
      timestamp,
      isProcessing: isAudio && aiReady
    };

    setMessages(prev => [...prev, userMessage]);
    setTextInput("");
    setIsLoading(true);

    // Update conversation history
    const newHistoryEntry = {
      role: 'user' as const,
      content: messageText.trim(),
      timestamp: new Date().toISOString()
    };

    try {
      let prosodyAnalysis: ProsodyAnalysis | undefined;
      let aiResponse: AIResponse;

      // If it's audio and AI is ready, analyze it
      if (isAudio && audioBlob && aiReady) {
        const context = buildConversationContext();
        
          try {
          prosodyAnalysis = await aiProsodyService.analyzeAudio(
            audioBlob,
            messageText.trim(),
            context
          );

          // Update the message with analysis
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, prosodyAnalysis, isProcessing: false }
              : msg
          ));

          // Update conversation history with analysis
          newHistoryEntry.audio_analysis = prosodyAnalysis;
          
        } catch (error) {
          logger.error('Audio analysis failed:', error);
          // Continue without analysis
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, isProcessing: false }
              : msg
          ));
        }
      }

      // Generate AI response
      if (aiReady) {
        try {
          const context = buildConversationContext();
          aiResponse = await aiProsodyService.generateResponse(
            messageText.trim(),
            context,
            prosodyAnalysis
          );

          // Update focus areas based on AI suggestions
          if (prosodyAnalysis && prosodyAnalysis.next_focus_areas.length > 0) {
            setFocusAreas(prosodyAnalysis.next_focus_areas);
          }
        } catch (error) {
          logger.error('AI response generation failed:', error);
          // Fallback to basic response
          aiResponse = {
            text_response: generateFallbackResponse(messageText, safeLevel),
            conversation_flow: {
              next_topic_suggestions: [],
              difficulty_adjustment: 'maintain',
              engagement_level: 0.7
            },
            practice_suggestions: {
              immediate: [],
              session_goals: [],
              homework: []
            }
          };
        }
      } else {
        // Fallback response when AI is not configured
        aiResponse = {
          text_response: generateFallbackResponse(messageText, safeLevel),
          conversation_flow: {
            next_topic_suggestions: [],
            difficulty_adjustment: 'maintain',
            engagement_level: 0.7
          },
          practice_suggestions: {
            immediate: [],
            session_goals: [],
            homework: []
          }
        };
      }

      // Add AI response message
      setTimeout(() => {
        const aiResponseMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResponse.text_response,
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          aiResponse
        };

        setMessages(prev => [...prev, aiResponseMessage]);
        setIsLoading(false);

        // Update conversation history
        const responseHistoryEntry = {
          role: 'assistant' as const,
          content: aiResponse.text_response,
          timestamp: new Date().toISOString()
        };

        setConversationHistory(prev => [...prev, newHistoryEntry, responseHistoryEntry]);
      }, aiReady ? 1500 : 800);

    } catch (error) {
      logger.error('Message processing failed:', error);
      setIsLoading(false);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble processing your message right now. Let's try again!",
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const generateFallbackResponse = (userMessage: string, userLevel: string): string => {
    const responses = {
      Beginner: [
        "That's great! I can hear you're working hard on your pronunciation. Let's practice some more basic patterns.",
        "Nice try! Your rhythm is improving. Can you tell me about your favorite food?",
        "Good effort! I noticed your word stress is getting better. What do you like to do on weekends?"
      ],
      Intermediate: [
        "Excellent work on your intonation! Your question patterns are much clearer now. Let's discuss something more complex.",
        "I can hear improvement in your connected speech. How do you feel about technology in education?",
        "Your pronunciation has really developed! Let's practice with some more challenging vocabulary."
      ],
      Advanced: [
        "Your prosody shows sophisticated control! Let's explore some nuanced expressions and idioms.",
        "Impressive fluency! Your stress patterns are very natural. What are your thoughts on current events?",
        "Your accent work is excellent! Let's discuss some abstract concepts to challenge your advanced skills."
      ]
    };

    const levelResponses = responses[userLevel as keyof typeof responses] || responses.Beginner;
    return levelResponses[Math.floor(Math.random() * levelResponses.length)];
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendTextFromInput();
  };

  const sendTextFromInput = async () => {
    if (sendingRef.current) return;
    if (isComposing) return;
    sendingRef.current = true;
    try {
      await handleSendMessage(textInput, false);
    } finally {
      sendingRef.current = false;
    }
  };

  const handleAnalysisView = (analysis: ProsodyAnalysis) => {
    setCurrentAnalysis(analysis);
    setShowAnalysisOverlay(true);
  };

  const handleRetryRecording = (messageId: string) => {
    // Find the message and trigger retry
    const message = messages.find(m => m.id === messageId);
    if (message) {
      // Remove the message and allow user to record again
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };




  const toggleInputMode = () => {
    setIsTextareaMode(!isTextareaMode);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Enhanced Chat Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <h2 className="font-medium">{currentTopic}</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {safeLevel} Level
              </Badge>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">AI Prosody Practice</span>
            </div>
          </div>
          <AIConnectionStatus size="sm" showLabel={false} />
        </div>

        {/* Focus Areas */}
        {focusAreas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 justify-center">
            <span className="text-xs text-muted-foreground mr-2">Focus areas:</span>
            {focusAreas.slice(0, 3).map((area, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {area}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            // mark the last message with a data attribute so the scroll effect can target it
            <div key={message.id} data-last-message={index === messages.length - 1 ? 'true' : undefined}>
              <MessageBubble
                message={message.text}
                isUser={message.isUser}
                isAudio={message.isAudio}
                audioBlob={message.audioBlob}
                prosodyFeedback={message.prosodyAnalysis ? {
                  score: message.prosodyAnalysis.overall_score,
                  highlights: message.prosodyAnalysis.detailed_feedback.specific_issues.map(issue => ({
                    text: issue.word,
                    type: issue.severity === 'high' ? 'error' as const : 'suggestion' as const,
                    feedback: issue.feedback
                  })),
                  suggestions: message.prosodyAnalysis.suggestions
                } : undefined}
                timestamp={message.timestamp}
                isProcessing={message.isProcessing}
                onAnalysisView={message.prosodyAnalysis ? () => handleAnalysisView(message.prosodyAnalysis!) : undefined}
                onRetry={() => handleRetryRecording(message.id)}
              />
              

            </div>
          ))}


          
          
          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[85%]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">
                      VibeTune AI is analyzing your speech and crafting a response...
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Clean Text Input */}
      <div className="bg-card border-t border-border p-4 space-y-3">

        {/* Text Input with Toggle */}
        <form onSubmit={handleTextSubmit} className="space-y-2">
          <div className="flex gap-2">
            {isTextareaMode ? (
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendTextFromInput();
                  }
                }}
                placeholder={waitingForTopic ? "Tell me what you'd like to discuss..." : "Continue the conversation..."}
                disabled={isLoading}
                className="flex-1 min-h-[80px] resize-y"
                maxLength={500}
              />
            ) : (
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendTextFromInput();
                  }
                }}
                placeholder={waitingForTopic ? "Tell me what you'd like to discuss..." : "Continue the conversation..."}
                disabled={isLoading}
                className="flex-1"
              />
            )}
            
            <div className="flex flex-col gap-1">
              <Button
                type="submit"
                disabled={!textInput.trim() || isLoading}
                size="icon"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Send className="w-4 h-4" />
              </Button>
              
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleInputMode}
                className="h-8 w-8"
                title={isTextareaMode ? "Switch to single line" : "Switch to multi-line"}
              >
                {isTextareaMode ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>
          
          {isTextareaMode && (
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Multi-line mode for longer messages</span>
              <span>{textInput.length}/500</span>
            </div>
          )}
        </form>
      </div>

      {/* Enhanced Recording Controls */}
      <RecordingControls
        onSendMessage={handleSendMessage}
        conversationContext={buildConversationContext()}
        disabled={isLoading}
        showAIFeedback={aiReady}
      />

      {/* Analysis Overlay */}
      <AnimatePresence>
        {showAnalysisOverlay && currentAnalysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAnalysisOverlay(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <ProsodyFeedback
                analysis={currentAnalysis}
                originalText="Your recorded message"
                onRetry={() => setShowAnalysisOverlay(false)}
                className="p-6"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
