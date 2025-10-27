// Minimal conversation service helpers used by frontend hooks
export async function ensureConversation({ topic, profileId }: { topic: string; profileId?: string }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'topic', topic, profileId }),
  });
  return res.json();
}

export async function saveTurn({ conversationId, role, text }: { conversationId?: string; role: 'user' | 'assistant' | string; text: string }) {
  // Best-effort: POST a message turn to the server (api/chat handles inserts when service key present)
  return fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, text, role }),
  }).then((r) => r.json());
}

export async function fetchHistory() {
  const res = await fetch('/api/get-history');
  if (!res.ok) return null;
  return res.json();
}

export async function completeConversation(conversationId?: string) {
  if (!conversationId) return null;
  return fetch('/api/complete-conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  }).then((r) => r.json());
}
