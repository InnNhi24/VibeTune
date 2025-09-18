import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { MessageBubble } from "./MessageBubble";
import { RecordingControls } from "./RecordingControls";
import { Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  isAudio?: boolean;
  timestamp: string;
  prosodyFeedback?: {
    score: number;
    highlights: Array<{
      text: string;
      type: 'error' | 'good' | 'suggestion';
      feedback: string;
    }>;
    suggestions: string[];
    vocabulary?: Array<{
      word: string;
      definition: string;
      example: string;
    }>;
  };
}

interface ChatPanelProps {
  topic?: string;
  level: string;
  onTopicChange?: (topic: string) => void;
}

export function ChatPanel({ topic = "General Conversation", level }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      text: `Hi! I'm your AI conversation partner. Let's practice English prosody together! We'll focus on ${topic.toLowerCase()} at a ${level.toLowerCase()} level. Feel free to speak or type your responses.`,
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([welcomeMessage]);
  }, [topic, level]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const generateMockProsodyFeedback = (userMessage: string) => {
    // Mock prosody feedback based on message content
    const words = userMessage.toLowerCase().split(' ');
    const score = Math.floor(Math.random() * 30) + 70; // 70-100%
    
    const highlights = [];
    const suggestions = [];
    const vocabulary = [];

    // Add some mock highlights
    if (words.includes('really') || words.includes('very')) {
      highlights.push({
        text: 'really',
        type: 'suggestion' as const,
        feedback: 'Try emphasizing this word with rising intonation for more impact'
      });
      suggestions.push('Use stress on intensifiers like "really" and "very"');
    }

    if (words.includes('important') || words.includes('interesting')) {
      highlights.push({
        text: words.includes('important') ? 'important' : 'interesting',
        type: 'good' as const,
        feedback: 'Great word stress on this multisyllabic word!'
      });
    }

    // Add vocabulary help for advanced words
    if (words.includes('communication') || words.includes('pronunciation')) {
      vocabulary.push({
        word: 'communication',
        definition: 'The imparting or exchanging of information',
        example: 'Clear communication is essential in business.'
      });
    }

    if (score < 80) {
      suggestions.push('Try varying your pitch more throughout the sentence');
      suggestions.push('Pay attention to sentence-final intonation patterns');
    }

    return {
      score,
      highlights: highlights.slice(0, 2), // Limit to 2 highlights
      suggestions: suggestions.slice(0, 2), // Limit to 2 suggestions
      vocabulary: vocabulary.slice(0, 1) // Limit to 1 vocabulary item
    };
  };

  const generateAIResponse = (userMessage: string): string => {
    const responses = [
      "That's a great point! Your pronunciation of key words was excellent. Can you tell me more about that topic?",
      "I noticed good rhythm in your speech. Let's practice with a question: What do you think about the importance of clear communication?",
      "Your intonation on that last sentence was very natural. How do you usually practice speaking English?",
      "Excellent! I can hear improvement in your stress patterns. What's your favorite way to learn new vocabulary?",
      "That's interesting! Your pace was good there. Can you give me an example of what you mean?",
      "Nice job with the pronunciation! Let's try discussing something more complex. What are your thoughts on technology in education?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleSendMessage = async (messageText: string, isAudio: boolean = false) => {
    if (!messageText.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText.trim(),
      isUser: true,
      isAudio,
      timestamp,
      prosodyFeedback: isAudio ? generateMockProsodyFeedback(messageText) : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setTextInput("");
    setIsLoading(true);

    // Simulate AI processing delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(messageText),
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(textInput, false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="text-center">
          <h2 className="font-medium">{topic}</h2>
          <p className="text-sm text-muted-foreground">{level} Level • AI Prosody Practice</p>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message.text}
              isUser={message.isUser}
              isAudio={message.isAudio}
              prosodyFeedback={message.prosodyFeedback}
              timestamp={message.timestamp}
            />
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">AI is thinking...</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Text Input */}
      <div className="bg-card border-t border-border p-4">
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your message here..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!textInput.trim() || isLoading}
            size="icon"
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Recording Controls */}
      <RecordingControls
        onSendMessage={handleSendMessage}
        disabled={isLoading}
      />
    </div>
  );
}