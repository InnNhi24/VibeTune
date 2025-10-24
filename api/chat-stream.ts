import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { text } = req.body as { text: string };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a friendly English tutor for VibeTune.' },
        { role: 'user', content: text ?? 'Hello' }
      ]
    });

    res.status(200).json({ replyText: completion.choices[0]?.message?.content ?? '' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
