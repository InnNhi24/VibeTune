import { useState, useEffect, useRef } from "react";
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
  user?: any; // Profile
}

export function ChatPanel({ topic = "New Conversation", level, onTopicChange, user }: ChatPanelProps) {
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
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const SCROLL_THRESHOLD = 100; // px from bottom to consider "near bottom" - increased for more aggressive auto-scroll
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Zustand store hooks
  const addMessageToStore = useAppStore(state => state.addMessage);
  const addConversation = useAppStore(state => (state as any).addConversation);
  const endConversation = useAppStore(state => (state as any).endConversation);
  // reference to avoid unused variable lint where store selector exists but value optional
  void endConversation;
  const activeConversationId = useAppStore(state => state.activeConversationId);
  const storeMessages = useAppStore(state => state.messages);

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
      text: "What would you like to talk about today? I'll help you practice English conversation on any topic that interests you. Just tell me what's on your mind!",
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([welcomeMessage, topicQuestion]);
    setConversationHistory([]);
    setFocusAreas(getFocusAreasForLevel(safeLevel));
    setWaitingForTopic(true);
    // Only reset topic if we don't have a confirmed topic yet
    if (!currentTopic || currentTopic === "New Conversation") {
      setCurrentTopic("New Conversation");
    }
  }, [safeLevel]);

  // Sync messages from global store when activeConversationId changes
  useEffect(() => {
    try {
      if (activeConversationId) {
        const msgs = storeMessages
          .filter(m => m.conversation_id === activeConversationId)
          .map(m => ({
            id: m.id,
            text: m.content,
            isUser: m.sender === 'user',
            isAudio: m.type === 'audio',
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          } as Message));

        if (msgs.length > 0) {
          setMessages(msgs);
          setWaitingForTopic(false);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [activeConversationId, storeMessages]);

  // Auto-scroll to bottom when new messages arrive.
  // Use the last-message element scrollIntoView first (more robust),
  // then fallback to the Radix viewport scrollTop behavior.
  const scrollToBottom = (smooth = true) => {
    const containerEl = scrollAreaRef.current as HTMLElement | null;
    if (!containerEl) return;
    try {
      containerEl.scrollTo({ top: containerEl.scrollHeight, behavior: smooth ? 'smooth' : undefined });
    } catch (_) {
      try { containerEl.scrollTop = containerEl.scrollHeight; } catch (_) { /* noop */ }
    }
  };

  const isNearBottom = (el: HTMLElement) => {
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    console.log('Scroll debug:', {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop, 
      clientHeight: el.clientHeight,
      distanceFromBottom,
      threshold: SCROLL_THRESHOLD,
      isNear: distanceFromBottom < SCROLL_THRESHOLD
    });
    return distanceFromBottom < SCROLL_THRESHOLD;
  };

  const handleScroll = () => {
    const containerEl = scrollAreaRef.current as HTMLElement | null;
    if (!containerEl) return;
    const shouldShow = !isNearBottom(containerEl);
    console.log('Scroll event - shouldShow button:', shouldShow, 'isNearBottom:', isNearBottom(containerEl));
    setShowNewMessageIndicator(shouldShow);
  };

  useEffect(() => {
    try {
      const containerEl = scrollAreaRef.current as HTMLElement | null;
      if (!containerEl) {
        console.warn('ChatPanel: scrollAreaRef.current is null');
        return;
      }

      if (isNearBottom(containerEl)) {
        // only auto-scroll when user is already near the bottom
        requestAnimationFrame(() => scrollToBottom(true));
        setShowNewMessageIndicator(false);
      } else {
        // user scrolled up; show indicator instead of forcing scroll
        setShowNewMessageIndicator(true);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ChatPanel auto-scroll error:', err);
    }
  }, [messages]);

  // Check initial state and when container size changes
  useEffect(() => {
    const checkScrollPosition = () => {
      const containerEl = scrollAreaRef.current as HTMLElement | null;
      if (!containerEl) return;
      
      // Always check if we should show the button
      const shouldShow = messages.length > 0 && !isNearBottom(containerEl);
      console.log('Initial scroll check - messages:', messages.length, 'isNearBottom:', isNearBottom(containerEl), 'shouldShow:', shouldShow);
      setShowNewMessageIndicator(shouldShow);
    };

    // Check after a short delay to ensure DOM is ready
    const timer = setTimeout(checkScrollPosition, 100);
    
    // Also check on resize in case container size changes
    window.addEventListener('resize', checkScrollPosition);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [messages.length]);

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
    
    // Ensure there is a conversation in the store
    let convId = conversationId || activeConversationId || null;
    if (!convId) {
      convId = `local_${Date.now()}`;
      setConversationId(convId);
    }
    
    // Always send message to AI for topic analysis (AI will decide when topic is confirmed)
    if (waitingForTopic) {
      try {
        const store = useAppStore.getState();
        const profile = store.user;
        const payload = {
          text: messageText.trim(),
          stage: 'topic_discovery', // Let AI analyze and decide topic
          profileId: profile?.id || null,
          level: safeLevel,
          conversationHistory: conversationHistory // Send conversation context
        } as any;

        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (resp.ok) {
          const data = await resp.json();
          console.log('Topic discovery response:', data); // Debug log
          if (data) {
            // Always show AI response, but clean control tags from display
            let aiResponseText = data.replyText || data.text_response || "I'm thinking...";
            console.log('AI response text:', aiResponseText); // Debug log
            
            // Remove control tags from display (but keep them for parsing)
            const cleanText = aiResponseText.replace(/\[\[TOPIC_CONFIRMED:[^\]]+\]\]/gi, '').trim();
            console.log('Clean text:', cleanText); // Debug log
            console.log('Topic confirmed:', data.topic_confirmed); // Debug log
            
            // Add AI response message
            setTimeout(() => {
              const aiResponseMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: cleanText, // Show clean text without control tags
                isUser: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
              setMessages(prev => [...prev, aiResponseMessage]);
              
              // Force scroll to bottom for new AI messages
              setTimeout(() => scrollToBottom(true), 100);
              
              // Persist AI message to global store
              try {
                addMessageToStore({
                  id: aiResponseMessage.id,
                  conversation_id: convId || '',
                  sender: 'ai',
                  type: 'text',
                  content: cleanText,
                  created_at: new Date().toISOString(),
                  timestamp: aiResponseMessage.timestamp
                });
              } catch (e) {
                // ignore
              }
            }, 800);

            // AI will return topic_confirmed when it's confident about the topic
            if (data.topic_confirmed) {
              console.log('Topic confirmed! Setting topic to:', data.topic_confirmed);
              // AI has confirmed the topic - update UI and create conversation
              setCurrentTopic(data.topic_confirmed);
              setWaitingForTopic(false);

              if (onTopicChange) {
                onTopicChange(data.topic_confirmed);
              }

              // Ensure we have a conversation to attach messages to
              let finalConvId = data.conversationId || convId;
              if (!finalConvId) {
                finalConvId = `topic_${Date.now()}`;
                setConversationId(finalConvId);
              }

              // Set active conversation and update with confirmed topic
              store.setActiveConversation(finalConvId);
              
              // Update or create conversation with confirmed topic
              try {
                console.log('Attempting to update conversation:', finalConvId, 'with topic:', data.topic_confirmed);
                // First try to update existing conversation
                store.endConversation(finalConvId, { 
                  topic: data.topic_confirmed, 
                  title: data.topic_confirmed 
                });
                console.log('Successfully updated conversation');
              } catch (e) {
                console.log('Update failed, creating new conversation:', e);
                // If update fails, create new conversation
                try {
                  const newConv = {
                    id: finalConvId,
                    profile_id: (user as any)?.id || '',
                    topic: data.topic_confirmed,
                    title: data.topic_confirmed,
                    is_placement_test: false,
                    started_at: new Date().toISOString(),
                    message_count: messages.length + 1, // +1 for current user message
                    avg_prosody_score: 0
                  };
                  console.log('Creating conversation:', newConv);
                  store.addConversation(newConv);
                  console.log('Successfully created conversation');
                } catch (e2) {
                  console.warn('Failed to create conversation:', e2);
                }
              }
              
              // Trigger a sync to refresh conversations list
              try { 
                await store.syncData(); 
                console.log('Sync completed after topic confirmation');
              } catch (e) { 
                console.warn('Sync failed:', e);
              }
            }
            // If no topic_confirmed, AI is still asking questions to clarify topic
            // Continue in waitingForTopic state until AI confirms
          }
        }
      } catch (err) {
        logger.warn('Failed to send message for topic discovery', err);
        setIsLoading(false);
      } finally {
        // Set loading to false after AI response is processed
        setTimeout(() => setIsLoading(false), 1000);
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

    // Persist user message to global store so it survives reload
    try {
      addMessageToStore({
        id: messageId,
        conversation_id: convId,
        sender: 'user',
        type: isAudio ? 'audio' : 'text',
        content: messageText.trim(),
        created_at: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (e) {
      // ignore
    }
    setTextInput("");
    setIsLoading(true);

    // Update conversation history
    const newHistoryEntry = {
      role: 'user' as const,
      content: messageText.trim(),
      timestamp: new Date().toISOString()
    };

    // Only generate normal AI response if NOT in topic discovery mode
    if (!waitingForTopic) {
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
          (newHistoryEntry as any).audio_analysis = prosodyAnalysis;
          
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
        // Persist AI message to global store
        try {
          addMessageToStore({
            id: aiResponseMessage.id,
            conversation_id: convId || activeConversationId || '',
            sender: 'ai',
            type: 'text',
            content: aiResponseMessage.text,
            created_at: new Date().toISOString(),
            timestamp: aiResponseMessage.timestamp
          });
        } catch (e) {
          // ignore
        }
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
    } // End of !waitingForTopic block
  };

  const generateFallbackResponse = (_userMessage: string, userLevel: string): string => {
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
  // ChatGPT-style layout: Use absolute positioning for reliable layout
  <div className="absolute inset-0 bg-background rounded-lg border border-border flex flex-col">
      {/* Enhanced Chat Header - Fixed at top */}
        <div className="flex-shrink-0 bg-card border-b border-border p-4">
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

      {/* Messages Area (scrollable) - Flex-1 takes remaining space */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-background min-h-0 relative"
        onScroll={handleScroll}
      >
        <div className="p-4 space-y-4">
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


        {/* Scroll to bottom button - elegant design like in image */}
        {console.log('Rendering scroll button:', showNewMessageIndicator)}
        {showNewMessageIndicator && (
          <div 
            style={{
              position: 'absolute',
              bottom: '16px',  // Bottom of messages area
              right: '16px',   // Right edge of messages area
              zIndex: 1000
            }}
          >
            <button
              onClick={() => {
                scrollToBottom(true);
                setShowNewMessageIndicator(false);
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'white',
                color: '#374151',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                transform: 'translateY(0px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
              aria-label="Jump to latest messages"
            >
              <ChevronDown size={20} />
            </button>
          </div>
        )}
        

      </div>

      {/* Input / Recording controls - Fixed at bottom */}
  <div ref={inputAreaRef} className="flex-shrink-0 bg-card border-t border-border p-4 space-y-3">

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
                // Limit textarea growth so it doesn't push the chat area; allow internal scroll when large
                className="flex-1 min-h-[80px] max-h-40 resize-y overflow-auto"
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

        {/* Enhanced Recording Controls */}
        <div className="border-t border-border pt-3">
          <RecordingControls
            onSendMessage={handleSendMessage}
            conversationContext={buildConversationContext()}
            disabled={isLoading}
            showAIFeedback={aiReady}
          />
        </div>
      </div>

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
