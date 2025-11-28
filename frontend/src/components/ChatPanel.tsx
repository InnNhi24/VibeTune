import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";



import { MessageBubble } from "./MessageBubble";
import { RecordingControls } from "./RecordingControls";
import { ProsodyFeedback } from "./ProsodyFeedback";
import { ProsodyScoreCard } from "./ProsodyScoreCard";
import { AIConnectionStatus } from "./AIConnectionStatus";
import { Send, Loader2, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { aiProsodyService, ConversationContext, ProsodyAnalysis, AIResponse } from "../services/aiProsodyService";
import { useAppStore } from "../store/appStore";
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
  
  // Debug: Track all messages state changes
  useEffect(() => {
    console.log('🔍 MESSAGES STATE CHANGED:', {
      count: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        text: m.text.substring(0, 30) + '...',
        isUser: m.isUser,
        timestamp: m.timestamp
      }))
    });
  }, [messages]);
  const [textInput, setTextInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const sendingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationContext['conversation_history']>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>(['basic pronunciation', 'sentence stress']);
  const [currentAnalysis, setCurrentAnalysis] = useState<ProsodyAnalysis | null>(null);
  const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(false);
  const [selectedMessageForAnalysis, setSelectedMessageForAnalysis] = useState<Message | null>(null);
  const [selectedProsodyMessage, setSelectedProsodyMessage] = useState<Message | null>(null); // For prosody popup
  const [aiReady, setAiReady] = useState(false);
  const [isTextareaMode, setIsTextareaMode] = useState(false);
  const [waitingForTopic, setWaitingForTopic] = useState(true);
  const [currentTopic, setCurrentTopic] = useState(topic);
  const [topicLocked, setTopicLocked] = useState(false); // Prevent topic changes after confirmation
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Handle topic prop changes (when user selects conversation from sidebar)
  useEffect(() => {
    if (topic && topic !== "New Conversation" && topic !== currentTopic) {
      setCurrentTopic(topic);
      // If topic is already established, don't wait for topic confirmation
      setWaitingForTopic(false);
      // Only lock if topic is NOT "New Conversation" (real topic exists)
      setTopicLocked(true);
    } else if (topic === "New Conversation" && currentTopic !== "New Conversation") {
      // New session started - reset everything
      setCurrentTopic("New Conversation");
      setWaitingForTopic(true);
      setTopicLocked(false); // New conversation - topic can be set
      setMessages([]);
      setConversationHistory([]);
      setConversationId(null);
    } else if (topic === "New Conversation" && currentTopic === "New Conversation") {
      // Ensure topicLocked is false for new conversations
      setTopicLocked(false);
    }
  }, [topic, currentTopic]);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  // Removed scroll button - not needed
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Zustand store hooks
  const addMessageToStore = useAppStore(state => state.addMessage);
  const setActiveConversation = useAppStore(state => state.setActiveConversation);
  const addConversation = useAppStore(state => state.addConversation);
  const syncData = useAppStore(state => state.syncData);
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

  // Initialize with welcome message when starting new conversation
  useEffect(() => {
    // Show welcome message when no active conversation and no messages
    if (!activeConversationId && messages.length === 0 && topic === "New Conversation") {
      console.log('🎉 [ChatPanel] Showing welcome message for new conversation');
      
      const welcomeMessage: Message = {
        id: `welcome_${Date.now()}_1`,
        text: `Hi! I'm your VibeTune AI conversation partner. Let's practice English at a ${safeLevel.toLowerCase()} level with AI-powered pronunciation feedback!`,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const topicPrompt: Message = {
        id: `welcome_${Date.now()}_2`, 
        text: "What would you like to talk about today? You can say something like 'I want to talk about music' or 'Let's discuss travel'.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([welcomeMessage, topicPrompt]);
      setConversationHistory([]);
      setFocusAreas(getFocusAreasForLevel(safeLevel));
      setWaitingForTopic(true);
    }
  }, [activeConversationId, topic, messages.length, safeLevel]); // Re-run when these change

  // Sync messages from global store when activeConversationId changes
  useEffect(() => {
    try {
      if (activeConversationId) {
        console.log('🔍 [ChatPanel] Loading conversation:', activeConversationId);
        console.log('🔍 [ChatPanel] Store has', storeMessages.length, 'total messages');
        
        // Debug: Log all conversation IDs in store
        const allConvIds = [...new Set(storeMessages.map(m => m.conversation_id))];
        console.log('🔍 [ChatPanel] All conversation IDs in store:', allConvIds);
        console.log('🔍 [ChatPanel] Looking for conversation ID:', activeConversationId);
        
        const msgs = storeMessages
          .filter(m => {
            const matches = m.conversation_id === activeConversationId;
            if (!matches && storeMessages.length < 20) {
              console.log('🔍 [ChatPanel] Message', m.id, 'has conversation_id:', m.conversation_id);
            }
            return matches;
          })
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Sort by creation time
          .map(m => {
            // Preserve prosodyAnalysis from existing messages if available
            const existingMsg = messages.find(msg => msg.id === m.id);
            return {
              id: m.id,
              text: m.content,
              isUser: m.sender === 'user',
              isAudio: m.type === 'audio',
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              prosodyAnalysis: existingMsg?.prosodyAnalysis, // Preserve prosody data
              audioBlob: existingMsg?.audioBlob // Preserve audio blob for playback
            } as Message;
          });

        console.log('🔍 [ChatPanel] Found', msgs.length, 'messages for this conversation');
        
        // Only update messages if they're different (to preserve prosodyAnalysis)
        // Compare by checking if all message IDs match
        const currentIds = messages.map(m => m.id).sort().join(',');
        const newIds = msgs.map(m => m.id).sort().join(',');
        
        if (currentIds !== newIds) {
          console.log('🔄 [ChatPanel] Loading messages from store (conversation changed)');
          setMessages(msgs);
        } else {
          console.log('✅ [ChatPanel] Messages already loaded, skipping to preserve prosodyAnalysis');
        }
        
        if (msgs.length > 0) {
          setWaitingForTopic(false);
          // Update conversation history for AI context
          const historyEntries = msgs.map(msg => ({
            role: (msg.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
            content: msg.text,
            timestamp: new Date().toISOString() // Use current time since msg.timestamp is just time format
          }));
          setConversationHistory(historyEntries);
          
          // Update current topic from the conversation
          const conversations = useAppStore.getState().conversations;
          const currentConv = conversations.find(c => c.id === activeConversationId);
          if (currentConv && currentConv.topic) {
            setCurrentTopic(currentConv.topic);
            // Topic is already established for existing conversations
            setWaitingForTopic(false);
          }
        } else {
          // No messages found - clear conversation history
          console.log('🔍 [ChatPanel] No messages found, clearing conversation history');
          setConversationHistory([]);
        }
      } else {
        // No active conversation - clear messages if they exist
        if (messages.length > 0) {
          console.log('🔍 [ChatPanel] No active conversation, clearing messages');
          setMessages([]);
          setConversationHistory([]);
        }
        
        // Check if we have a current topic but no active conversation - create one
        if (currentTopic && currentTopic !== "New Conversation" && currentTopic !== "General Conversation") {
          const store = useAppStore.getState();
          const existingConv = store.conversations.find(c => c.topic === currentTopic);
          
          if (!existingConv && store.user) {
            console.log('🔧 Creating missing conversation for topic:', currentTopic);
            const newConvId = crypto.randomUUID(); // Use UUID for database compatibility
            const newConv = {
              id: newConvId,
              profile_id: store.user.id,
              topic: currentTopic,
              title: currentTopic,
              is_placement_test: false,
              started_at: new Date().toISOString()
            };
            
            addConversation(newConv);
            setActiveConversation(newConvId);
            setWaitingForTopic(false);
            
            // Start with empty messages - user speaks first
            setMessages([]);
            
            return; // Exit early since we created the conversation
          }
        }
        
        // No active conversation - welcome messages will be shown by the other useEffect
        // Don't clear or set messages here to avoid conflicts
      }
    } catch (e) {
      console.warn('Failed to sync messages from store:', e);
    }
  }, [activeConversationId, storeMessages, safeLevel, currentTopic, addConversation, setActiveConversation, addMessageToStore]);

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

  // Simplified scroll logic - just auto scroll to bottom

  useEffect(() => {
    try {
      const containerEl = scrollAreaRef.current as HTMLElement | null;
      if (!containerEl) {
        console.warn('ChatPanel: scrollAreaRef.current is null');
        return;
      }

      // Always auto-scroll to bottom for new messages
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ChatPanel auto-scroll error:', err);
    }
  }, [messages]);

  // Removed scroll position checking - not needed without button

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
    const messageId = crypto.randomUUID(); // Use UUID instead of timestamp
    const userMessageCreatedAt = new Date().toISOString(); // Save timestamp for ordering
    
    // Get or create conversation ID - needed for saving messages
    let convId = conversationId || activeConversationId;
    if (!convId) {
      // Create conversation ID immediately
      convId = crypto.randomUUID();
      setConversationId(convId);
      console.log('🆔 Created new conversation ID:', convId);
      
      // CREATE CONVERSATION IMMEDIATELY with placeholder name
      // This allows messages to be saved to database right away
      // Topic name will be updated later when confirmed
      const store = useAppStore.getState();
      if (store.user) {
        const placeholderTopic = waitingForTopic ? 'New Conversation' : currentTopic;
        const newConv = {
          id: convId,
          profile_id: store.user.id,
          topic: placeholderTopic,
          title: placeholderTopic,
          is_placement_test: false,
          started_at: new Date().toISOString()
        };
        
        console.log('✅ Creating conversation with placeholder name:', placeholderTopic);
        
        // Add to local store
        addConversation(newConv);
        
        // Set as active conversation immediately
        setActiveConversation(convId);
        
        // Save to database (await to ensure it's created before messages)
        await fetch('/api/data?action=save-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConv)
        }).then(async response => {
          if (response.ok) {
            console.log('✅ Conversation created in database:', convId);
          } else {
            console.error('❌ Failed to create conversation in database:', await response.text());
          }
        }).catch(error => {
          console.error('❌ Error creating conversation:', error);
        });
      }
    }
    
    // Add user message to UI IMMEDIATELY (before AI processing)
    const userMessage: Message = {
      id: messageId,
      text: messageText.trim(),
      isUser: true,
      isAudio,
      audioBlob,
      timestamp,
      isProcessing: isAudio,
      prosodyAnalysis: undefined // Will be filled after analysis
    };

    console.log('🔍 Adding user message:', userMessage);
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      console.log('🔍 Messages after adding user message:', newMessages.length);
      return newMessages;
    });
    
    // Prepare payload - always include topic if it's fixed
    const store = useAppStore.getState();
    const profile = store.user;
    
    // Calculate turn count (number of user messages in this conversation)
    const userMessageCount = messages.filter(m => m.isUser).length + 1; // +1 for current message
    
    const payload = {
      text: messageText.trim(),
      stage: waitingForTopic ? 'topic_discovery' : 'practice',
      topic: waitingForTopic ? undefined : currentTopic, // Always send fixed topic in practice mode
      // Use the locally-created convId to ensure the API receives the conversation id
      // even though React state updates are async.
      conversationId: convId,
      profileId: profile?.id || null,
      level: safeLevel,
      conversationHistory: conversationHistory,
      lastMistakes: [], // TODO: Track pronunciation mistakes
      turnCount: userMessageCount // Track conversation progress for session management
    } as any;
    
    // Only allow topic discovery when waiting for topic
    if (waitingForTopic) {
      try {

        console.log('📤 Sending to API:', { 
          text: messageText.substring(0, 50) + '...', 
          stage: payload.stage,
          topic: payload.topic,
          conversationId: payload.conversationId
        });
        
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log('🔍 API Response status:', resp.status);
        
        if (resp.ok) {
          const data = await resp.json();
          console.log('🔍 API Response data:', data);
          console.log('🔍 Topic from API:', data.topic_confirmed);
          console.log('🔍 Will create conversation?', !!data.topic_confirmed);
          if (data) {
            // Get AI response text - no control tags expected
            let aiResponseText = data.replyText || data.text_response || "I'm thinking...";
            console.log('✅ AI response received:', aiResponseText.substring(0, 100) + '...');
            
            // Clean text (remove any unexpected control tags)
            const cleanText = aiResponseText.replace(/\[\[.*?\]\]/gi, '').trim();
            console.log('📝 Topic confirmed from API:', data.topic_confirmed);
            
            // Add AI response message
            console.log('🔍 Setting setTimeout for AI response...');
            setTimeout(() => {
              console.log('🔍 setTimeout executed - adding AI response message');
              
              // Ensure AI message timestamp is AFTER user message (add 10ms buffer)
              const aiMessageCreatedAt = new Date(new Date(userMessageCreatedAt).getTime() + 10).toISOString();
              
              const aiResponseMessage: Message = {
                id: crypto.randomUUID(),
                text: cleanText, // Show clean text without control tags
                isUser: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
              
              console.log('🔍 AI response message created:', aiResponseMessage);
              setMessages(prev => {
                const newMessages = [...prev, aiResponseMessage];
                console.log('🔍 Messages after adding AI response:', newMessages.length);
                return newMessages;
              });
              
              // Force scroll to bottom for new AI messages
              setTimeout(() => scrollToBottom(true), 100);
              
              // Persist AI message to global store AND database
              try {
                // Use store user to ensure consistency with conversation profile_id
                const storeUser = useAppStore.getState().user || user;
                const aiMessageData = {
                  id: aiResponseMessage.id,
                  conversation_id: convId || '',
                  profile_id: storeUser?.id || null,
                  sender: 'ai' as 'ai',
                  type: 'text' as 'text',
                  content: cleanText,
                  created_at: aiMessageCreatedAt, // Use timestamp AFTER user message
                  timestamp: aiResponseMessage.timestamp
                };
                
                // Save to local store immediately
                addMessageToStore(aiMessageData);
                console.log('✅ AI message saved to local store:', aiResponseMessage.id);
                
                // Save to database (conversation already exists)
                fetch('/api/data?action=save-message', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(aiMessageData)
                }).then(async response => {
                  const result = await response.json();
                  if (response.ok) {
                    if (result.supabase_error) {
                      console.error('❌ AI message saved locally but database sync failed:', result.supabase_error);
                    } else {
                      console.log('✅ AI message saved to database:', aiResponseMessage.id, result);
                    }
                  } else {
                    console.warn('⚠️ Failed to save AI message to database:', response.status, result);
                  }
                }).catch(error => {
                  console.warn('⚠️ Error saving AI message:', error.message);
                });
                
              } catch (e) {
                console.error('❌ Failed to persist AI message:', e);
              }
            }, 800);

            // AI will return topic_confirmed when it's confident about the topic
            if (data.topic_confirmed) {
              if (topicLocked) {
                console.log('⚠️ Topic already locked - ignoring topic update request');
                return;
              }
              
              console.log('✅ Topic confirmed! Updating conversation name to:', data.topic_confirmed);

              // Topic is now locked for this session - prevent further updates
              setWaitingForTopic(false);
              setTopicLocked(true);

              // Use existing conversation ID (already created with placeholder name)
              const finalConvId = convId;

              // UPDATE existing conversation with confirmed topic name (ONE TIME ONLY)
              try {
                const storeUser = useAppStore.getState().user;
                if (!storeUser?.id) {
                  console.error('❌ No valid user ID found');
                  return;
                }
                
                // Update conversation in local store
                const conversations = useAppStore.getState().conversations;
                const existingConv = conversations.find(c => c.id === finalConvId);
                
                if (existingConv) {
                  // Update existing conversation with new topic
                  const updatedConv = {
                    ...existingConv,
                    topic: data.topic_confirmed,
                    title: data.topic_confirmed
                  };
                  
                  console.log('✅ Updating conversation topic in store:', data.topic_confirmed);
                  
                  // Update in store (replace old conversation)
                  const updatedConversations = conversations.map(c => 
                    c.id === finalConvId ? updatedConv : c
                  );
                  useAppStore.setState({ conversations: updatedConversations });
                  
                  // Update in database
                  fetch('/api/data?action=update-conversation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: finalConvId,
                      topic: data.topic_confirmed,
                      title: data.topic_confirmed
                    })
                  }).then(async response => {
                    if (response.ok) {
                      console.log('✅ Conversation topic updated in database');
                    } else {
                      console.warn('⚠️ Failed to update conversation in database:', response.status);
                    }
                  }).catch(error => {
                    console.warn('⚠️ Error updating conversation:', error.message);
                  });
                  
                  // Update localStorage
                  setTimeout(() => {
                    try {
                      const currentState = useAppStore.getState();
                      const storeData = {
                        user: currentState.user,
                        conversations: currentState.conversations,
                        messages: currentState.messages,
                        activeConversationId: finalConvId,
                        placementTestProgress: currentState.placementTestProgress,
                        retryQueue: currentState.retryQueue,
                        currentTopic: data.topic_confirmed,
                        sync: {
                          ...currentState.sync,
                          hasOfflineChanges: true
                        }
                      };
                      localStorage.setItem('vibetune-app-store', JSON.stringify({ state: storeData, version: 0 }));
                      console.log('✅ Conversation updated in localStorage');
                    } catch (e) {
                      console.error('❌ Failed to update localStorage:', e);
                    }
                  }, 100);
                }
                
                // Update current topic in UI
                setCurrentTopic(data.topic_confirmed);
                if (onTopicChange) {
                  onTopicChange(data.topic_confirmed);
                }
                
                console.log('✅ Conversation topic updated:', finalConvId, 'Topic:', data.topic_confirmed);
                
              } catch (e) {
                console.error('❌ Failed to update conversation:', e);
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
      
      // IMPORTANT: Return here to prevent practice mode from running during topic discovery
      return;
    }
    
    // Persist user message to BOTH local store AND database simultaneously
    // Use store user to ensure consistency with conversation profile_id
    const storeUser = useAppStore.getState().user || user;
    
    // Debug: Check for profile_id mismatch
    if (storeUser?.id !== user?.id) {
      console.warn('⚠️ Profile ID mismatch!', {
        storeUserId: storeUser?.id,
        propUserId: user?.id,
        using: storeUser?.id
      });
    }
    
    const messageData = {
      id: messageId,
      conversation_id: convId || '',
      profile_id: storeUser?.id || null,
      sender: 'user' as 'user',
      type: (isAudio ? 'audio' : 'text') as 'audio' | 'text',
      content: messageText.trim(),
      audio_url: isAudio ? audioBlob : null,
      created_at: userMessageCreatedAt, // Use saved timestamp for consistent ordering
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    // Save to local store immediately
    addMessageToStore(messageData);
    console.log('✅ User message saved to local store:', messageId);
    
    // Save to database (conversation already exists with placeholder name)
    fetch('/api/data?action=save-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...messageData,
        audio_url: null // Don't send Blob to API, will be handled separately
      })
    }).then(async response => {
      const result = await response.json();
      if (response.ok) {
        if (result.supabase_error) {
          console.error('❌ User message saved locally but database sync failed:', result.supabase_error);
        } else {
          console.log('✅ User message saved to database:', messageId, result);
        }
      } else {
        console.warn('⚠️ Failed to save user message to database:', response.status, result);
      }
    }).catch(error => {
      console.warn('⚠️ Error saving user message:', error.message);
    });
    setTextInput("");
    setIsLoading(true);

    // Update conversation history
    const newHistoryEntry = {
      role: 'user' as 'user',
      content: messageText.trim(),
      timestamp: new Date().toISOString()
    };

    // Only generate normal AI response if NOT in topic discovery mode
    if (!waitingForTopic) {
      try {
        let prosodyAnalysis: ProsodyAnalysis | undefined;
        let aiResponse: AIResponse;

        // If it's audio and AI is ready, analyze it
        console.log('🔍 [ChatPanel] Checking prosody analysis conditions:', {
          isAudio,
          hasAudioBlob: !!audioBlob,
          audioBlobSize: audioBlob?.size,
          aiReady,
          willAnalyze: isAudio && audioBlob && aiReady
        });
        
        if (isAudio && audioBlob && aiReady) {
        const context = buildConversationContext();
        console.log('✅ [ChatPanel] Starting prosody analysis...');
        
          try {
          prosodyAnalysis = await aiProsodyService.analyzeAudio(
            audioBlob,
            messageText.trim(),
            context
          );

          // Update the message with analysis AND transcription
          console.log('✅ [ChatPanel] Prosody analysis complete, updating message:', {
            messageId,
            hasAnalysis: !!prosodyAnalysis,
            overallScore: prosodyAnalysis?.overall_score,
            transcription: (prosodyAnalysis as any)?.transcription?.substring(0, 50)
          });
          
          setMessages(prev => {
            const updated = prev.map(msg => 
              msg.id === messageId 
                ? { 
                    ...msg, 
                    // Update text with actual transcription from prosody analysis
                    text: (prosodyAnalysis as any)?.transcription || msg.text,
                    prosodyAnalysis, 
                    isProcessing: false,
                    // IMPORTANT: Preserve audioBlob for playback!
                    audioBlob: msg.audioBlob,
                    isAudio: msg.isAudio,
                    // Also update prosodyFeedback for MessageBubble display
                    prosodyFeedback: prosodyAnalysis ? {
                      overall_score: prosodyAnalysis.overall_score,
                      pronunciation_score: prosodyAnalysis.pronunciation_score,
                      rhythm_score: prosodyAnalysis.rhythm_score,
                      intonation_score: prosodyAnalysis.intonation_score,
                      fluency_score: prosodyAnalysis.fluency_score,
                      feedback: prosodyAnalysis.detailed_feedback,
                      suggestions: prosodyAnalysis.suggestions
                    } : undefined
                  }
                : msg
            );
            console.log('✅ [ChatPanel] Updated message with prosodyAnalysis:', {
              messageId,
              hasProsodyAnalysis: !!updated.find(m => m.id === messageId)?.prosodyAnalysis,
              overallScore: updated.find(m => m.id === messageId)?.prosodyAnalysis?.overall_score
            });
            return updated;
          });

          // Update conversation history with analysis
          (newHistoryEntry as any).audio_analysis = prosodyAnalysis;
          
        } catch (error) {
          console.error('❌ [ChatPanel] Audio analysis failed:', error);
          logger.error('Audio analysis failed:', error);
          // Continue without analysis - clear processing state
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, isProcessing: false, prosodyAnalysis: undefined }
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
        // Ensure AI message timestamp is AFTER user message (add 10ms buffer)
        const aiMessageCreatedAt = new Date(new Date(userMessageCreatedAt).getTime() + 10).toISOString();
        
        const aiResponseMessage: Message = {
          id: crypto.randomUUID(),
          text: aiResponse.text_response,
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          aiResponse
        };
        setMessages(prev => {
          console.log('🤖 [ChatPanel] Adding AI response, checking user message prosody:', {
            userMessageId: messageId,
            userMessageHasProsody: !!prev.find(m => m.id === messageId)?.prosodyAnalysis
          });
          return [...prev, aiResponseMessage];
        });
        // Persist AI message to global store
        try {
          // Use store user to ensure consistency with conversation profile_id
          const storeUser = useAppStore.getState().user || user;
          addMessageToStore({
            id: aiResponseMessage.id,
            conversation_id: convId || activeConversationId || '',
            profile_id: storeUser?.id || null,
            sender: 'ai',
            type: 'text',
            content: aiResponseMessage.text,
            created_at: aiMessageCreatedAt, // Use timestamp AFTER user message
            timestamp: aiResponseMessage.timestamp
          });
          console.log('✅ AI response message persisted to store:', aiResponseMessage.id);
        } catch (e) {
          console.error('❌ Failed to persist AI response message:', e);
        }
        setIsLoading(false);

        // Update conversation history
        const responseHistoryEntry = {
          role: 'assistant' as 'assistant',
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
          id: crypto.randomUUID(),
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
        "Nice try! Your rhythm is improving. What would you like to practice next?",
        "Good effort! I noticed your word stress is getting better. What interests you today?"
      ],
      Intermediate: [
        "Excellent work on your intonation! Your question patterns are much clearer now. Let's discuss something more complex.",
        "I can hear improvement in your connected speech. What would you like to explore today?",
        "Your pronunciation has really developed! Let's practice with some more challenging vocabulary."
      ],
      Advanced: [
        "Your prosody shows sophisticated control! Let's explore some nuanced expressions and idioms.",
        "Impressive fluency! Your stress patterns are very natural. What would you like to discuss?",
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
      >
        <div className="p-4 space-y-4">
          {messages.map((message, index) => {
            return (
            // mark the last message with a data attribute so the scroll effect can target it
            <div key={message.id} data-last-message={index === messages.length - 1 ? 'true' : undefined} className="space-y-3">
              <MessageBubble
                message={message.text}
                isUser={message.isUser}
                isAudio={message.isAudio}
                audioBlob={message.audioBlob}
                prosodyFeedback={message.prosodyAnalysis ? {
                  score: message.prosodyAnalysis.overall_score,
                  highlights: message.prosodyAnalysis.detailed_feedback.specific_issues.map(issue => ({
                    text: issue.word,
                    type: issue.severity === 'high' ? 'error' : 'suggestion',
                    feedback: issue.feedback
                  })),
                  suggestions: message.prosodyAnalysis.suggestions
                } : undefined}
                timestamp={message.timestamp}
                isProcessing={message.isProcessing}
                onAnalysisView={message.prosodyAnalysis ? () => setSelectedProsodyMessage(message) : undefined}
                onRetry={() => handleRetryRecording(message.id)}
              />
            </div>
            );
          })}

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


        {/* Scroll button removed - auto scroll handles everything */}
        

      </div>

      {/* Minimal Input Area */}
      <div ref={inputAreaRef} className="flex-shrink-0 bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Text Input - Hidden when recording */}
          {!isLoading && (
            <div className="relative flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
              <Textarea
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendTextFromInput();
                  }
                }}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-2"
                rows={1}
              />
              
              {textInput.trim() && (
                <Button
                  onClick={() => void sendTextFromInput()}
                  disabled={isLoading}
                  size="icon"
                  className="h-10 w-10 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground flex-shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}
          
          {/* Voice Recording - Centered */}
          <div className="flex justify-center">
            <RecordingControls
              onSendMessage={handleSendMessage}
              conversationContext={buildConversationContext()}
              disabled={isLoading}
              showAIFeedback={aiReady}
            />
          </div>
        </div>
      </div>

      {/* Prosody Analysis Popup - Click on voice message to view */}
      <AnimatePresence>
        {selectedMessageForAnalysis && selectedMessageForAnalysis.prosodyAnalysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMessageForAnalysis(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Pronunciation Analysis</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMessageForAnalysis(null)}
                  >
                    ✕
                  </Button>
                </div>
                <ProsodyFeedback
                  analysis={selectedMessageForAnalysis.prosodyAnalysis}
                  originalText={selectedMessageForAnalysis.text}
                  onRetry={() => setSelectedMessageForAnalysis(null)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prosody Feedback Popup Modal */}
      {selectedProsodyMessage && selectedProsodyMessage.prosodyAnalysis && (
        <ProsodyScoreCard
          overall={selectedProsodyMessage.prosodyAnalysis.overall_score}
          pronunciation={selectedProsodyMessage.prosodyAnalysis.pronunciation_score}
          rhythm={selectedProsodyMessage.prosodyAnalysis.rhythm_score}
          intonation={selectedProsodyMessage.prosodyAnalysis.intonation_score}
          fluency={selectedProsodyMessage.prosodyAnalysis.fluency_score}
          messageId={selectedProsodyMessage.id}
          showModalOnly={true}
          isModalOpen={true}
          onModalClose={() => setSelectedProsodyMessage(null)}
          detailedFeedback={selectedProsodyMessage.prosodyAnalysis.detailed_feedback}
          suggestions={selectedProsodyMessage.prosodyAnalysis.suggestions}
        />
      )}
    </div>
  );
}
