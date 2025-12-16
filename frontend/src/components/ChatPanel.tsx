import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";



import { MessageBubble } from "./MessageBubble";
import { RecordingControls } from "./RecordingControls";

import { ProsodyScoreCard } from "./ProsodyScoreCard";
import { AIConnectionStatus } from "./AIConnectionStatus";
import { Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
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
  const [textInput, setTextInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const sendingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationContext['conversation_history']>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>(['basic pronunciation', 'sentence stress']);
  const [lastMistakes, setLastMistakes] = useState<string[]>([]); // Track pronunciation mistakes for AI context
  const [selectedProsodyMessage, setSelectedProsodyMessage] = useState<Message | null>(null); // For prosody popup
  const [aiReady, setAiReady] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // Track if processing audio message
  const currentRequestIdRef = useRef<string | null>(null); // Track current request to prevent race conditions
  const [sessionEnded, setSessionEnded] = useState(false); // Track if session has ended
  const [sessionExtended, setSessionExtended] = useState(false); // Track if user extended session
  const [awaitingUserDecision, setAwaitingUserDecision] = useState(false); // Track if waiting for user to decide
  const INITIAL_TURN_LIMIT = 15; // Initial limit: 15-20 user messages
  const EXTENSION_TURNS = 5; // Extension: 5-8 more turns

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
  const activeConversationId = useAppStore(state => state.activeConversationId);
  const storeMessages = useAppStore(state => state.messages);

  // Helper function for fallback responses
  const generateFallbackResponse = (_userMessage: string, userLevel: string): string => {
    const responses = {
      Beginner: [
        "You're doing wonderful! 🌟 I can really hear how hard you're working on your pronunciation. Let's keep building those skills together!",
        "Nice job! Your rhythm is getting better and better! 🎵 What would you like to explore next?",
        "I love your effort! 💪 Your word stress is improving so much. What topic sounds fun to you today?"
      ],
      Intermediate: [
        "Wow, excellent work! 🎯 Your intonation is getting so much clearer. Ready to dive into something more interesting?",
        "I'm impressed! Your connected speech is really flowing nicely now. 🌊 What would you like to chat about?",
        "Your pronunciation is really blossoming! 🌸 Let's challenge ourselves with some exciting new vocabulary!"
      ],
      Advanced: [
        "Outstanding! 🌟 Your prosody control is so sophisticated. Let's explore some fascinating expressions together!",
        "Incredible fluency! Your stress patterns sound so natural and authentic. 🎭 What shall we discuss today?",
        "Your accent work is truly impressive! 🎪 Ready to tackle some thought-provoking abstract concepts?"
      ]
    };

    const levelResponses = responses[userLevel as keyof typeof responses] || responses.Beginner;
    return levelResponses[Math.floor(Math.random() * levelResponses.length)];
  };

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
    // Only show welcome message for truly new conversations (no active conversation, no existing messages, no welcome messages already)
    const hasWelcomeMessages = messages.some(m => m.id.startsWith('welcome_'));
    
    if (!activeConversationId && !hasWelcomeMessages && topic === "New Conversation") {
      console.log('🎉 Initializing welcome messages for new conversation');
      
      const baseTimestamp = Date.now();
      const welcomeMessage: Message = {
        id: `welcome_${baseTimestamp}_1`,
        text: `Hey there! 👋 I'm so excited to be your VibeTune conversation partner! Let's have some fun practicing English together at a ${safeLevel.toLowerCase()} level. I'll give you helpful pronunciation tips along the way! 🎯`,
        isUser: false,
        timestamp: new Date(baseTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const topicPrompt: Message = {
        id: `welcome_${baseTimestamp}_2`, 
        text: "So, what sounds interesting to you today? 😊 We could chat about music, travel, food, hobbies... anything you'd like! Just tell me what's on your mind and we'll dive right in! 🌟",
        isUser: false,
        timestamp: new Date(baseTimestamp + 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([welcomeMessage, topicPrompt]);
      setConversationHistory([]);
      setFocusAreas(getFocusAreasForLevel(safeLevel));
      setWaitingForTopic(true);
    }
  }, [activeConversationId, topic, safeLevel, messages]); // Add messages dependency to check for welcome messages

  // Track previous conversation ID to detect switches
  const prevConversationIdRef = useRef<string | null>(null);
  
  // Fetch messages DIRECTLY from Supabase when conversation changes
  // This is the ONLY source of truth for messages - no local store sync needed
  useEffect(() => {
    const targetConversationId = activeConversationId;
    
    // Detect conversation switch
    const isConversationSwitch = prevConversationIdRef.current !== null && 
                                  prevConversationIdRef.current !== targetConversationId;
    
    if (isConversationSwitch || !targetConversationId) {
      console.log('🔄 Conversation switched:', prevConversationIdRef.current, '->', targetConversationId);
      // Clear messages immediately when switching
      setMessages([]);
      setConversationHistory([]);
    }
    
    prevConversationIdRef.current = targetConversationId;
    
    if (!targetConversationId) return;
    
    const fetchMessagesFromSupabase = async () => {
      try {
        console.log('🔄 Fetching messages from Supabase for:', targetConversationId);
        const response = await fetch(`/api/data?action=get-conversation-messages&conversation_id=${targetConversationId}`);
        
        // Check if user switched to another conversation while fetching
        if (prevConversationIdRef.current !== targetConversationId) {
          console.log('⚠️ Conversation changed during fetch, ignoring results');
          return;
        }
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.messages && data.messages.length > 0) {
            console.log(`✅ Loaded ${data.messages.length} messages from Supabase`);
            
            // Convert database messages to UI format and set DIRECTLY to local state
            const uiMessages: Message[] = data.messages.map((m: any) => {
              let prosodyAnalysis = undefined;
              
              if (m.prosody_feedback) {
                const dbFeedback = m.prosody_feedback.detailed_feedback || {};
                prosodyAnalysis = {
                  overall_score: m.prosody_feedback.overall_score || 0,
                  pronunciation_score: m.prosody_feedback.pronunciation_score || 0,
                  rhythm_score: m.prosody_feedback.rhythm_score || 0,
                  intonation_score: m.prosody_feedback.intonation_score || 0,
                  fluency_score: m.prosody_feedback.fluency_score || 0,
                  detailed_feedback: {
                    strengths: Array.isArray(dbFeedback.strengths) ? dbFeedback.strengths : [],
                    improvements: Array.isArray(dbFeedback.improvements) ? dbFeedback.improvements : [],
                    specific_issues: Array.isArray(dbFeedback.specific_issues) ? dbFeedback.specific_issues : []
                  },
                  suggestions: Array.isArray(m.prosody_feedback.suggestions) ? m.prosody_feedback.suggestions : [],
                  next_focus_areas: [],
                  word_level_analysis: []
                };
              }
              
              return {
                id: m.id,
                text: m.content,
                isUser: m.sender === 'user',
                isAudio: m.type === 'audio',
                timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                prosodyAnalysis,
                isProcessing: false
              } as Message;
            });
            
            // Set messages DIRECTLY - no store sync needed
            setMessages(uiMessages);
            
            // Update conversation history for AI context
            const historyEntries = uiMessages.map(msg => ({
              role: (msg.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
              content: msg.text,
              timestamp: new Date().toISOString()
            }));
            setConversationHistory(historyEntries);
            
            // Update topic from conversation
            const conversations = useAppStore.getState().conversations;
            const currentConv = conversations.find(c => c.id === targetConversationId);
            if (currentConv?.topic) {
              setCurrentTopic(currentConv.topic);
              setWaitingForTopic(false);
              setTopicLocked(true);
            }
          } else {
            console.log('📭 No messages found for conversation');
            setMessages([]);
          }
        } else {
          console.warn('⚠️ Failed to fetch messages:', response.status);
        }
      } catch (error) {
        console.error('❌ Error fetching messages from Supabase:', error);
      }
    };
    
    fetchMessagesFromSupabase();
  }, [activeConversationId]);

  // NOTE: Store sync removed - messages are now fetched directly from Supabase
  // This prevents race conditions and ensures correct conversation messages are shown

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

  const generatePersonalizedTips = (
    analyses: ProsodyAnalysis[], 
    avgPronunciation: number, 
    avgRhythm: number, 
    avgIntonation: number, 
    avgFluency: number,
    mistakes: string[]
  ): string => {
    const tips: string[] = [];
    
    // Collect all improvement suggestions from AI feedback
    const allImprovements = analyses.flatMap(a => 
      a.detailed_feedback.improvements || []
    );
    const uniqueImprovements = [...new Set(allImprovements)].slice(0, 3);
    
    // Add AI-generated improvements as tips
    if (uniqueImprovements.length > 0) {
      uniqueImprovements.forEach(improvement => {
        tips.push(`• ${improvement} 💡`);
      });
    }
    
    // Add specific practice tips based on weakest area
    const scores = [
      { name: 'pronunciation', score: avgPronunciation, emoji: '🗣️' },
      { name: 'rhythm', score: avgRhythm, emoji: '🎵' },
      { name: 'intonation', score: avgIntonation, emoji: '🎭' },
      { name: 'fluency', score: avgFluency, emoji: '🌊' }
    ];
    const weakestArea = scores.reduce((min, curr) => curr.score < min.score ? curr : min);
    
    if (weakestArea.score < 75) {
      const areaTips: Record<string, string> = {
        pronunciation: `Practice these words slowly: ${mistakes.slice(0, 3).join(', ')}. Say each syllable clearly! ${weakestArea.emoji}`,
        rhythm: `Try clapping along as you speak to feel the natural rhythm of English sentences ${weakestArea.emoji}`,
        intonation: `Record yourself asking questions - your voice should go UP at the end! ${weakestArea.emoji}`,
        fluency: `Don't worry about perfection - focus on speaking smoothly without long pauses ${weakestArea.emoji}`
      };
      tips.push(`• ${areaTips[weakestArea.name]}`);
    }
    
    // Add mistake-specific practice tip
    if (mistakes.length > 0) {
      tips.push(`• Practice these challenging words daily: ${mistakes.slice(0, 3).join(', ')} - say them 5 times slowly, then 5 times at normal speed! 🎯`);
    }
    
    // Add recording tip
    tips.push(`• Record yourself reading a short paragraph, then listen back - you'll spot patterns I mentioned! 🎤`);
    
    // Add encouragement based on overall performance
    if (avgPronunciation + avgRhythm + avgIntonation + avgFluency >= 320) {
      tips.push(`• You're doing amazing! Keep challenging yourself with longer, more complex sentences! 🚀`);
    } else if (avgPronunciation + avgRhythm + avgIntonation + avgFluency >= 280) {
      tips.push(`• Great progress! Try reading English articles out loud to build confidence! 📚`);
    } else {
      tips.push(`• You're on the right track! Practice a little bit every day - consistency is key! 💪`);
    }
    
    return tips.join('\n');
  };

  const generateSessionSummary = async () => {
    // Collect all prosody analyses from the session
    const analyses = messages
      .filter(m => m.isUser && m.prosodyAnalysis)
      .map(m => m.prosodyAnalysis!);
    
    if (analyses.length === 0) {
      const noDataMessage: Message = {
        id: crypto.randomUUID(),
        text: "Thanks so much for spending time with me today! 💙 Whenever you're ready, start a new conversation and we'll continue this amazing journey together! 🚀✨",
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, noDataMessage]);
      return;
    }
    
    // Calculate average scores
    const avgOverall = analyses.reduce((sum, a) => sum + a.overall_score, 0) / analyses.length;
    const avgPronunciation = analyses.reduce((sum, a) => sum + a.pronunciation_score, 0) / analyses.length;
    const avgRhythm = analyses.reduce((sum, a) => sum + a.rhythm_score, 0) / analyses.length;
    const avgIntonation = analyses.reduce((sum, a) => sum + a.intonation_score, 0) / analyses.length;
    const avgFluency = analyses.reduce((sum, a) => sum + a.fluency_score, 0) / analyses.length;
    
    // Collect all mistakes
    const allMistakes = analyses.flatMap(a => 
      a.detailed_feedback.specific_issues?.map(i => i.word) || []
    );
    const uniqueMistakes = [...new Set(allMistakes)].slice(0, 5);
    
    // Collect all vocabulary from conversation
    const allWords = messages
      .filter(m => m.isUser)
      .flatMap(m => m.text.split(/\s+/))
      .filter(w => w.length > 5);
    const uniqueVocab = [...new Set(allWords)].slice(0, 8);
    
    // Generate summary message
    const summaryText = `🎉 **Amazing Work! You Did It!**

Wow! You practiced ${analyses.length} voice message${analyses.length > 1 ? 's' : ''} with me today - that's fantastic! 🌟

**📊 Here's How You Did:**
• Overall: ${Math.round(avgOverall)}% ${avgOverall >= 80 ? '🌟 You absolutely crushed it!' : avgOverall >= 70 ? '👍 Really solid work!' : '💪 You\'re making great progress!'}
• Pronunciation: ${Math.round(avgPronunciation)}% ${avgPronunciation >= 75 ? '✨' : ''}
• Rhythm: ${Math.round(avgRhythm)}% ${avgRhythm >= 75 ? '🎵' : ''}
• Intonation: ${Math.round(avgIntonation)}% ${avgIntonation >= 75 ? '🎭' : ''}
• Fluency: ${Math.round(avgFluency)}% ${avgFluency >= 75 ? '🌊' : ''}

**📝 Cool Words You Used:**
${uniqueVocab.slice(0, 5).map(w => `• ${w} ✨`).join('\n')}

**🎯 Let's Work On These Together:**
${uniqueMistakes.length > 0 ? uniqueMistakes.map(w => `• ${w} - We'll get this one!`).join('\n') : '• Wow! You nailed everything! 🎉'}

**💡 My Personalized Tips For You:**
${generatePersonalizedTips(analyses, avgPronunciation, avgRhythm, avgIntonation, avgFluency, uniqueMistakes)}

**Want to keep going?** I'm always here when you're ready for another chat! Just start a new conversation and let's do this! 💪✨`;

    const summaryMessage: Message = {
      id: crypto.randomUUID(),
      text: summaryText,
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, summaryMessage]);
    setIsLoading(false);
  };

  const handleSendMessage = async (messageText: string, isAudio: boolean = false, audioBlob?: Blob) => {
    if (!messageText.trim()) return;
    
    // Prevent duplicate sends
    if (sendingRef.current) {
      console.log('🚫 Preventing duplicate message send');
      return;
    }
    sendingRef.current = true;
    
    // Handle user decision to continue or end session
    if (awaitingUserDecision) {
      const userInput = messageText.trim().toLowerCase();
      
      if (userInput.includes('continue') || userInput.includes('tiếp') || userInput.includes('yes')) {
        // User wants to continue
        setAwaitingUserDecision(false);
        setSessionExtended(true);
        
        const continueMessage: Message = {
          id: crypto.randomUUID(),
          text: "Yay! 🎉 I love your enthusiasm! Let's keep this momentum going - we've got 5-8 more fun questions ahead. You're doing amazing, and I can't wait to see your progress! 💪✨",
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        setMessages(prev => [...prev, continueMessage]);
        sendingRef.current = false;
        return; // Don't process as normal message
      } else if (userInput.includes('end') || userInput.includes('kết thúc') || userInput.includes('done') || userInput.includes('finish')) {
        // User wants to end session
        setAwaitingUserDecision(false);
        setSessionEnded(true);
        
        const endingMessage: Message = {
          id: crypto.randomUUID(),
          text: "Wonderful! 🎉 You did such a great job today! Let me put together a special summary just for you...\n\nI'm looking at:\n• How much your pronunciation has improved 📈\n• All the cool vocabulary you used 📝\n• Some friendly tips to help you grow 💡\n• Your personalized next steps 🎯\n\nGive me just a moment... ⏳",
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        setMessages(prev => [...prev, endingMessage]);
        
        // Generate summary after 2 seconds
        setTimeout(() => generateSessionSummary(), 2000);
        sendingRef.current = false;
        return; // Don't process as normal message
      }
      // If user says something else, treat as normal message and ask again
    }

    try {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const messageId = crypto.randomUUID(); // Use UUID instead of timestamp
      const userMessageCreatedAt = new Date().toISOString(); // Save timestamp for ordering
    
    // Get or create conversation ID - needed for saving messages
    let convId = conversationId || activeConversationId;
    if (!convId) {
      // Create conversation ID immediately
      convId = crypto.randomUUID();
      setConversationId(convId);
      
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
          if (!response.ok) {
            logger.error('Failed to create conversation in database', await response.text());
          }
        }).catch(error => {
          logger.error('Error creating conversation', error);
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

    // Add user message to UI - check for duplicate first
    setMessages(prev => {
      // Prevent duplicate messages
      if (prev.some(m => m.id === userMessage.id)) {
        console.log('⚠️ Duplicate user message prevented in UI:', userMessage.id);
        return prev;
      }
      return [...prev, userMessage];
    });
    
    // Safety timeout to clear processing state if analysis gets stuck
    if (isAudio) {
      const processingTimeoutId = setTimeout(() => {
        console.log('⏰ Clearing stuck processing state for message:', messageId);
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, isProcessing: false }
            : msg
        ));
      }, 45000); // 45 seconds max processing time
      
      // Clear timeout if analysis completes normally
      const originalSetMessages = setMessages;
      const clearTimeoutOnUpdate = (updateFn: any) => {
        clearTimeout(processingTimeoutId);
        originalSetMessages(updateFn);
      };
    }
    
    // Track if processing audio for better loading message
    setIsProcessingAudio(isAudio);
    
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
      lastMistakes: lastMistakes, // Track pronunciation mistakes for AI context
      turnCount: userMessageCount // Track conversation progress for session management
    } as any;
    
    // Generate unique request ID to prevent race conditions
    const requestId = crypto.randomUUID();
    currentRequestIdRef.current = requestId;
    
    // Only allow topic discovery when waiting for topic
    if (waitingForTopic) {
      // Save user message to store and database FIRST (before AI response)
      const storeUser = useAppStore.getState().user || user;
      const userMessageData = {
        id: messageId,
        conversation_id: convId || '',
        profile_id: storeUser?.id || null,
        sender: 'user' as 'user',
        type: (isAudio ? 'audio' : 'text') as 'audio' | 'text',
        content: messageText.trim(),
        created_at: userMessageCreatedAt,
        timestamp
      };
      
      // Save to local store
      addMessageToStore(userMessageData);
      
      // Save to database
      fetch('/api/data?action=save-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessageData)
      }).catch(error => {
        logger.warn('Error saving user message in topic discovery', error);
      });
      
      try {
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        // Check if this is still the current request (not outdated)
        if (currentRequestIdRef.current !== requestId) {
          logger.warn('Ignoring outdated API response');
          return; // Ignore this response, user has moved on
        }
        
        if (resp.ok) {
          const data = await resp.json();
          if (data) {
            // Get AI response text - no control tags expected
            let aiResponseText = data.replyText || data.text_response || "I'm thinking...";
            
            // Clean text (remove any unexpected control tags)
            const cleanText = aiResponseText.replace(/\[\[.*?\]\]/gi, '').trim();
            
            // Add AI response message
            setTimeout(() => {
              // Double-check request is still current before adding message
              if (currentRequestIdRef.current !== requestId) {
                return; // User has moved on, don't add this message
              }
              
              // Ensure AI message timestamp is AFTER user message (add 10ms buffer)
              const aiMessageCreatedAt = new Date(new Date(userMessageCreatedAt).getTime() + 10).toISOString();
              
              const aiResponseMessage: Message = {
                id: crypto.randomUUID(),
                text: cleanText, // Show clean text without control tags
                isUser: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
              
              // Add AI message to UI - check for duplicate first
              setMessages(prev => {
                if (prev.some(m => m.id === aiResponseMessage.id)) {
                  console.log('⚠️ Duplicate AI message prevented in UI:', aiResponseMessage.id);
                  return prev;
                }
                return [...prev, aiResponseMessage];
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
                
                // Save to database (conversation already exists)
                fetch('/api/data?action=save-message', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(aiMessageData)
                }).then(async response => {
                  const result = await response.json();
                  if (response.ok && result.supabase_error) {
                    logger.error('AI message saved locally but database sync failed', result.supabase_error);
                  } else if (!response.ok) {
                    logger.warn('Failed to save AI message to database', result);
                  }
                }).catch(error => {
                  logger.warn('Error saving AI message', error);
                });
                
              } catch (e) {
                logger.error('Failed to persist AI message', e);
              }
            }, 800);

            // AI will return topic_confirmed when it's confident about the topic
            if (data.topic_confirmed) {
              if (topicLocked) {
                return;
              }

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
                    if (!response.ok) {
                      logger.warn('Failed to update conversation in database', response.status);
                    }
                  }).catch(error => {
                    logger.warn('Error updating conversation', error);
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
                    } catch (e) {
                      logger.error('Failed to update localStorage', e);
                    }
                  }, 100);
                }
                
                // Update current topic in UI
                setCurrentTopic(data.topic_confirmed);
                if (onTopicChange) {
                  onTopicChange(data.topic_confirmed);
                }
                
              } catch (e) {
                logger.error('Failed to update conversation', e);
              }
            }
            // If no topic_confirmed, AI is still asking questions to clarify topic
            // Continue in waitingForTopic state until AI confirms
          }
        }
      } catch (err) {
        logger.warn('Failed to send message for topic discovery', err);
        setIsLoading(false);
        sendingRef.current = false; // Reset to allow future sends
      } finally {
        // Set loading to false after AI response is processed
        setTimeout(() => setIsLoading(false), 1000);
        // Always reset sendingRef in topic discovery mode
        sendingRef.current = false;
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
      if (response.ok && result.supabase_error) {
        logger.error('User message saved locally but database sync failed', result.supabase_error);
      } else if (!response.ok) {
        logger.warn('Failed to save user message to database', result);
      }
    }).catch(error => {
      logger.warn('Error saving user message', error);
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
        let prosodyAnalysis: ProsodyAnalysis | undefined;
        let aiResponse: AIResponse;

        // If it's audio and AI is ready, analyze it
        if (isAudio && audioBlob && aiReady) {
        const context = buildConversationContext();
        
          try {
          console.log('🎯 Starting prosody analysis with 30s timeout...');
          
          // Add additional timeout wrapper for extra safety
          const analysisPromise = aiProsodyService.analyzeAudio(
            audioBlob,
            messageText.trim(),
            context
          );
          
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Prosody analysis timeout after 35 seconds'));
            }, 35000); // 35 seconds - slightly longer than service timeout
          });
          
          prosodyAnalysis = await Promise.race([analysisPromise, timeoutPromise]);

          // Update the message with analysis AND transcription
          setMessages(prev => prev.map(msg => 
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
          ));
          
          // Track pronunciation mistakes for AI context
          if (prosodyAnalysis?.detailed_feedback?.specific_issues) {
            const mistakes = prosodyAnalysis.detailed_feedback.specific_issues
              .filter(issue => issue.severity === 'high' || issue.severity === 'medium')
              .map(issue => issue.word);
            setLastMistakes(prev => [...new Set([...prev, ...mistakes])].slice(-10)); // Keep last 10 mistakes
          }

          // Update conversation history with analysis
          (newHistoryEntry as any).audio_analysis = prosodyAnalysis;

          // Save prosody analysis to database
          if (prosodyAnalysis) {
            try {
              const prosodyFeedback = {
                overall_score: prosodyAnalysis.overall_score,
                pronunciation_score: prosodyAnalysis.pronunciation_score,
                rhythm_score: prosodyAnalysis.rhythm_score,
                intonation_score: prosodyAnalysis.intonation_score,
                fluency_score: prosodyAnalysis.fluency_score,
                detailed_feedback: prosodyAnalysis.detailed_feedback,
                suggestions: prosodyAnalysis.suggestions,
                speaking_rate: (prosodyAnalysis as any).speaking_rate,
                word_count: (prosodyAnalysis as any).word_count,
                duration: (prosodyAnalysis as any).duration
              };

              fetch('/api/data?action=update-message-prosody', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messageId,
                  prosodyFeedback,
                  transcript: (prosodyAnalysis as any)?.transcription
                })
              }).then(response => {
                if (!response.ok) {
                  logger.error('Failed to save prosody analysis to database');
                }
              }).catch(error => {
                logger.error('Error saving prosody analysis', error);
              });
            } catch (error) {
              console.error('❌ Error preparing prosody data for database:', error);
            }
          }
          
        } catch (error) {
          console.error('❌ [ChatPanel] Audio analysis failed:', error);
          logger.error('Audio analysis failed:', error);
          
          // Determine error type for user-friendly message
          const isTimeout = error instanceof Error && (
            error.name === 'AbortError' || 
            error.message.includes('timeout') ||
            error.message.includes('timed out')
          );
          
          const errorMessage = isTimeout 
            ? 'Analysis took too long - continuing without detailed feedback'
            : 'Analysis temporarily unavailable - continuing conversation';
          
          // Clear processing state and show error message
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  isProcessing: false, 
                  prosodyAnalysis: undefined,
                  // Add a small error indicator
                  text: msg.text + (isTimeout ? ' ⏰' : ' ⚠️')
                }
              : msg
          ));
          
          // Add a subtle error message for user
          setTimeout(() => {
            const errorNotice: Message = {
              id: crypto.randomUUID(),
              text: `💭 ${errorMessage}. Your message was received perfectly! Let's keep chatting! 😊`,
              isUser: false,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorNotice]);
          }, 1000);
        }
      }

      // Check if request is still current before generating AI response
      if (currentRequestIdRef.current !== requestId) {
        logger.warn('Skipping AI response - request outdated');
        setIsLoading(false);
        return;
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
          
          // Check again after async operation
          if (currentRequestIdRef.current !== requestId) {
            logger.warn('Ignoring AI response - request outdated');
            setIsLoading(false);
            return;
          }

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
        // Final check before adding message
        if (currentRequestIdRef.current !== requestId) {
          logger.warn('Not adding AI message - request outdated');
          return;
        }
        
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
          // Check for duplicate AI message
          if (prev.some(m => m.id === aiResponseMessage.id)) {
            console.log('⚠️ Duplicate AI message prevented in UI:', aiResponseMessage.id);
            return prev;
          }
          
          const newMessages = [...prev, aiResponseMessage];
          
          // Check if session should ask user to continue or end
          const userMessageCount = newMessages.filter(m => m.isUser).length;
          const currentLimit = sessionExtended ? INITIAL_TURN_LIMIT + EXTENSION_TURNS : INITIAL_TURN_LIMIT;
          
          // Ask user if they want to continue (at 15 messages, or 20 if extended)
          if (userMessageCount >= currentLimit && !sessionEnded && !awaitingUserDecision) {
            setTimeout(() => {
              setAwaitingUserDecision(true);
              const askContinueMessage: Message = {
                id: crypto.randomUUID(),
                text: sessionExtended 
                  ? "Wow, you're on fire today! 🔥 You've practiced so much already - I'm really impressed!\n\nWhat would you like to do?\n\n• **Continue** - Let's keep the fun going with 5-8 more questions! 🚀\n• **End Session** - Time to celebrate with your awesome summary! 🎉\n\nJust type 'continue' or 'end' and let me know! 😊"
                  : "Hey, you're doing fantastic! 🌟 You've already completed 15 practice questions - that's amazing!\n\nWhat sounds good to you?\n\n• **Continue** - I'm having fun, let's do 5-8 more! 💪\n• **End Session** - Show me my awesome results! 📊\n\nJust type 'continue' or 'end' - whatever feels right! 😊",
                isUser: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
              setMessages(prev => [...prev, askContinueMessage]);
            }, 1000);
          }
          
          return newMessages;
        });
        
        // Persist AI message to global store AND database
        try {
          // Use store user to ensure consistency with conversation profile_id
          const storeUser = useAppStore.getState().user || user;
          const aiMessageData = {
            id: aiResponseMessage.id,
            conversation_id: convId || activeConversationId || '',
            profile_id: storeUser?.id || null,
            sender: 'ai' as const,
            type: 'text' as const,
            content: aiResponseMessage.text,
            created_at: aiMessageCreatedAt, // Use timestamp AFTER user message
            timestamp: aiResponseMessage.timestamp
          };
          
          // Save to local store immediately
          addMessageToStore(aiMessageData);
          
          // Save to database (prevents data loss on reload)
          fetch('/api/data?action=save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiMessageData)
          }).then(async response => {
            if (!response.ok) {
              const result = await response.json();
              logger.warn('Failed to save AI message to database', result);
            }
          }).catch(error => {
            logger.warn('Error saving AI message to database', error);
          });
        } catch (e) {
          logger.error('Failed to persist AI response message', e);
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

      
      // Always reset sendingRef to allow future sends
      sendingRef.current = false;
    } // End of !waitingForTopic block
    } catch (error) {
      logger.error('Message processing failed:', error);
      setIsLoading(false);
      
      // Always reset sendingRef to allow future sends
      sendingRef.current = false;
    }
  };



  const sendTextFromInput = async () => {
    if (isComposing) return;
    if (sessionEnded) return; // Prevent sending after session ends
    
    // handleSendMessage now handles sendingRef internally
    await handleSendMessage(textInput, false);
  };





  return (
  // Use absolute positioning for reliable layout
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
                prosodyFeedback={message.prosodyAnalysis ? (() => {
                  const feedback = {
                    score: message.prosodyAnalysis.overall_score,
                    highlights: (message.prosodyAnalysis.detailed_feedback?.specific_issues || []).map(issue => ({
                      text: issue.word,
                      type: issue.severity === 'high' ? 'error' as const : 'suggestion' as const,
                      feedback: issue.feedback
                    })),
                    suggestions: message.prosodyAnalysis.suggestions || []
                  };
                  console.log('🎯 Passing prosodyFeedback to MessageBubble:', {
                    messageId: message.id,
                    hasAnalysis: !!message.prosodyAnalysis,
                    score: feedback.score,
                    highlightsCount: feedback.highlights.length
                  });
                  return feedback;
                })() : undefined}
                timestamp={message.timestamp}
                isProcessing={message.isProcessing}
                onAnalysisView={message.prosodyAnalysis ? () => setSelectedProsodyMessage(message) : undefined}
              />
            </div>
            );
          })}

          {/* Enhanced Loading indicator with progress */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[85%]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-accent to-primary rounded-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-1">
                        <motion.div
                          className="w-2 h-2 bg-accent rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-accent rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-accent rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        AI is thinking...
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isProcessingAudio ? 'Analyzing your pronunciation and crafting feedback' : 'Preparing a thoughtful response'}
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
