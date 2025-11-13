// Minimal conversation service helpers used by frontend hooks
import { useAppStore } from '../store/appStore';

// If localId is provided, we will attempt to reconcile it with the server's canonical id
export async function ensureConversation({ topic, profileId, localId }: { topic: string; profileId?: string; localId?: string }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'topic', topic, profileId }),
  });
  const data = await res.json();
  try {
    if (data?.conversationId && localId) {
      // Best-effort reconciliation of local -> server id
      try { useAppStore.getState().reconcileConversationId(localId, data.conversationId); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    // ignore
  }
  return data;
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
