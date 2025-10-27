// Minimal /api/voice endpoint (voice flow placeholder)
// Accepts POST with body: { text, conversationId, topic, stage, profileId, audioUrl }
// This is intentionally small: it proxies high-level voice requests and returns a structured reply.
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end('Method Not Allowed');
    }

    // Read body (works in Vercel / Node and local dev via req.body)
    let body: any = req.body;
    if (!body) {
      try {
        body = await new Promise((resolve) => {
          let data = '';
          req.on('data', (chunk: any) => (data += chunk));
          req.on('end', () => resolve(JSON.parse(data || '{}')));
        });
      } catch (err) {
        body = {};
      }
    }

    const { text, conversationId, topic, stage } = body || {};

    // Simple placeholder assistant reply for the initial implementation.
    // The frontend expects JSON { ok, replyText, speakReply?, conversationId?, topic?, stage?, nextStage? }
    const replyText = text
      ? `(Voice flow) Thanks — received ${String(text).slice(0, 120)}${String(text).length > 120 ? '…' : ''}`
      : 'No text provided.';

    // Example response: speakReply true indicates the frontend may TTS the response
    const response = {
      ok: true,
      replyText,
      speakReply: true,
      conversationId: conversationId || null,
      topic: topic || null,
      stage: stage || 'practice',
      nextStage: 'wrapup',
    };

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify(response));
  } catch (err: any) {
    console.error('api/voice error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
}
