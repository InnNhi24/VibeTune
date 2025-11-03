import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const client = new OpenAI({ apiKey: OPENAI_KEY });

    // Create ephemeral realtime session token
    // Note: the exact SDK shape may vary; use sessions.create per OpenAI realtime docs
    const session = await (client as any).realtime.sessions.create({
      model: 'gpt-4o-realtime-preview',
      voice: 'verse'
    });

    // session.client_secret contains ephemeral token to return to client
    const client_secret = session?.client_secret?.value || session?.client_secret;
    return res.status(200).json({ client_secret });
  } catch (e: any) {
    console.error('realtime-token error', e?.message || e);
    return res.status(500).json({ error: 'Failed to create realtime token', detail: e?.message || String(e) });
  }
}
