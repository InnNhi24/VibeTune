import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch('https://api.deepgram.com/v1/projects/me/keys', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY!}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        comment: 'vibetune-temp',
        scopes: ['usage:write', 'listen:ws'],
        time_to_live_in_seconds: 300
      })
    });
    const data = await r.json();
    res.status(200).json({ key: data?.key });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
