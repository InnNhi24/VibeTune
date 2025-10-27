import { useCallback } from 'react';

type SendTextOpts = { conversationId?: string; topic?: string; profileId?: string; level?: string };

export function useChatText() {
  const sendText = useCallback(async (text: string, opts?: SendTextOpts) => {
    const body = { text, ...opts };
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  return { sendText };
}

export default useChatText;
