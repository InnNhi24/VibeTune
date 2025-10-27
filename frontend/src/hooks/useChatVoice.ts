import { useCallback } from 'react';

type VoiceOpts = { conversationId?: string; topic?: string; profileId?: string };

export function useChatVoice() {
  const sendVoice = useCallback(async (finalTranscript: string, opts?: VoiceOpts) => {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: finalTranscript, ...(opts || {}) }),
    });
    const data = await res.json();

    // If speakReply is true and browser supports SpeechSynthesis, speak the reply
    if (data?.speakReply && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(data.replyText || '');
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }

    return data;
  }, []);

  return { sendVoice };
}

export default useChatVoice;
