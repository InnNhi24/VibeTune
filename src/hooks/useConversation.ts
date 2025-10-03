import { useState, useEffect, useCallback } from 'react';
import { supabase, Conversation, Message, Profile } from '../services/supabaseClient';
import { AudioAnalysisService } from '../services/apiAnalyzeAudio';
import { useOfflineSync } from './useOfflineSync';

interface UseConversationProps {
  user: Profile | null;
  topic?: string;
  isPlacementTest?: boolean;
}

interface ConversationState {
  conversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isRecording: boolean;
  recordingTime: number;
  transcriptionText: string;
  isProcessingAudio: boolean;
}

export function useConversation({ user, topic = 'General Conversation', isPlacementTest = false }: UseConversationProps) {
  const [state, setState] = useState<ConversationState>({
    conversation: null,
    messages: [],
    isLoading: false,
    error: null,
    isRecording: false,
    recordingTime: 0,
    transcriptionText: '',
    isProcessingAudio: false
  });

  const { saveMessageOffline, syncOfflineMessages } = useOfflineSync();

  // Initialize conversation
  const initializeConversation = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Create new conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          profile_id: user.id,
          topic,
          is_placement_test: isPlacementTest,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        conversation,
        isLoading: false
      }));

      // Add welcome message
      await addAIMessage(
        `Hi ${user.username}! I'm your AI conversation partner. Let's practice English prosody together! We'll focus on ${topic.toLowerCase()} at a ${user.level.toLowerCase()} level. Feel free to speak or type your responses.`,
        conversation.id
      );

    } catch (error) {
      console.error('Error initializing conversation:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to start conversation',
        isLoading: false
      }));
    }
  }, [user, topic, isPlacementTest]);

  // Load existing conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('profile_id', user.id)
        .single();

      if (convError) throw convError;

      // Get messages
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      setState(prev => ({
        ...prev,
        conversation,
        messages: messages || [],
        isLoading: false
      }));

    } catch (error) {
      console.error('Error loading conversation:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load conversation',
        isLoading: false
      }));
    }
  }, [user]);

  // Add user message
  const addUserMessage = useCallback(async (content: string, isAudio: boolean = false, audioUrl?: string) => {
    if (!state.conversation || !user) return;

    const messageData: Partial<Message> = {
      conversation_id: state.conversation.id,
      sender: 'user',
      type: isAudio ? 'audio' : 'text',
      content,
      audio_url: audioUrl,
      created_at: new Date().toISOString(),
      version: 1,
      device_id: localStorage.getItem('device_id') || undefined
    };

    try {
      // Try to save to database
      const { data: message, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Analyze audio for prosody feedback if it's an audio message
      if (isAudio && message) {
        setState(prev => ({ ...prev, isProcessingAudio: true }));
        
        const { data: analysis } = await AudioAnalysisService.analyzeAudio({
          text: content,
          level: user.level,
          context: state.conversation?.topic
        });

        if (analysis) {
          // Update message with prosody feedback
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              prosody_feedback: {
                score: analysis.overallScore,
                highlights: analysis.prosodyErrors.map(error => ({
                  text: error.location || '',
                  type: error.type === 'intonation' ? 'suggestion' : 'error',
                  feedback: error.suggestion || ''
                })),
                suggestions: [analysis.guidance],
                vocabulary: analysis.vocabSuggestions.map(word => ({
                  word,
                  definition: `Definition for ${word}`,
                  example: `Example sentence with ${word}`
                }))
              },
              vocab_suggestions: analysis.vocabSuggestions,
              guidance: analysis.guidance
            })
            .eq('id', message.id);

          if (!updateError) {
            // Refresh messages to show updated feedback
            const { data: updatedMessage } = await supabase
              .from('messages')
              .select('*')
              .eq('id', message.id)
              .single();

            if (updatedMessage) {
              setState(prev => ({
                ...prev,
                messages: prev.messages.map(msg => 
                  msg.id === message.id ? updatedMessage : msg
                ),
                isProcessingAudio: false
              }));
            }
          }
        }
        
        setState(prev => ({ ...prev, isProcessingAudio: false }));
      } else {
        // Add message to state for text messages
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, message]
        }));
      }

      // Generate AI response
      generateAIResponse(content);

    } catch (error) {
      console.error('Error adding user message:', error);
      
      // Save offline if database fails
      await saveMessageOffline({
        ...messageData,
        id: `offline_${Date.now()}`,
        timestamp: new Date().toISOString()
      });
      
      setState(prev => ({
        ...prev,
        error: 'Message saved offline. Will sync when connection is restored.'
      }));
    }
  }, [state.conversation, user, saveMessageOffline]);

  // Add AI message
  const addAIMessage = useCallback(async (content: string, conversationId?: string) => {
    const targetConversationId = conversationId || state.conversation?.id;
    if (!targetConversationId) return;

    const messageData: Partial<Message> = {
      conversation_id: targetConversationId,
      sender: 'ai',
      type: 'text',
      content,
      created_at: new Date().toISOString(),
      version: 1,
      device_id: localStorage.getItem('device_id') || undefined
    };

    try {
      const { data: message, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message]
      }));

    } catch (error) {
      console.error('Error adding AI message:', error);
      await saveMessageOffline({
        ...messageData,
        id: `offline_ai_${Date.now()}`,
        timestamp: new Date().toISOString()
      });
    }
  }, [state.conversation, saveMessageOffline]);

  // Generate AI response
  const generateAIResponse = useCallback(async (userMessage: string) => {
    if (!user || !state.conversation) return;

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const responses = [
      "That's a great point! Your pronunciation of key words was excellent. Can you tell me more about that topic?",
      "I noticed good rhythm in your speech. Let's practice with a question: What do you think about the importance of clear communication?",
      "Your intonation on that last sentence was very natural. How do you usually practice speaking English?",
      "Excellent! I can hear improvement in your stress patterns. What's your favorite way to learn new vocabulary?",
      "That's interesting! Your pace was good there. Can you give me an example of what you mean?",
      `Nice job! For ${user.level.toLowerCase()} level, you're doing well. Let's try discussing something more complex about ${state.conversation.topic.toLowerCase()}.`
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];
    await addAIMessage(response);
  }, [user, state.conversation, addAIMessage]);

  // Retry message with new analysis
  const retryMessage = useCallback(async (messageId: string, newContent: string, isAudio: boolean = false) => {
    if (!user || !state.conversation) return;

    try {
      // Create new message as retry
      await addUserMessage(newContent, isAudio);
      
      // Mark original message as retried (optional - could keep for learning)
      
    } catch (error) {
      console.error('Error retrying message:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to retry message'
      }));
    }
  }, [user, state.conversation, addUserMessage]);

  // Sync offline messages when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      if (navigator.onLine) {
        syncOfflineMessages();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncOfflineMessages]);

  // Initialize conversation on mount
  useEffect(() => {
    if (user && !state.conversation) {
      initializeConversation();
    }
  }, [user, initializeConversation, state.conversation]);

  return {
    ...state,
    initializeConversation,
    loadConversation,
    addUserMessage,
    retryMessage,
    clearError: () => setState(prev => ({ ...prev, error: null }))
  };
}