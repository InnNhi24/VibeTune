import { Request, Response } from 'express';
import openai from '../clients/openai';

// SSE chat stream using OpenAI streaming API
const chatStreamRoute = async (req: Request, res: Response) => {
  // Validate input early
  const { conversationId, profileId, text } = req.body || {};
  if (!conversationId || !profileId || !text) {
    return res.status(400).json({ error: 'Missing required fields: conversationId, profileId, text' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Allow proxies to keep the connection open
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let aborted = false;
  req.on('close', () => {
    aborted = true;
  });

  try {
    const systemPrompt = `You are VibeTune, a friendly AI prosody coach. Respond in 2–4 short sentences.`;

    // Start streaming completion from OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 800,
      stream: true,
    }) as any;

    // The OpenAI client returns an async iterable for streaming responses
    for await (const part of stream) {
      if (aborted) break;

      try {
        // Different SDKs expose delta content differently; guard defensively
        const chunk = part?.choices?.[0]?.delta?.content || part?.choices?.[0]?.message?.content || part?.delta?.content || null;
        if (chunk) {
          // Send chunk to client
          res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
        }

        // If the event signals completion, break
        const done = part?.choices?.[0]?.finish_reason === 'stop' || part?.type === 'response.completed';
        if (done) break;
      } catch (err) {
        // Ignore streaming parse errors and continue
        console.warn('Stream parse warning', err);
      }
    }

    // Finalize stream
    if (!aborted) {
      res.write('event: done\n');
      res.write('data: [DONE]\n\n');
    }
    res.end();

  } catch (error: any) {
    console.error('Chat stream error:', error);
    try {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Chat stream failed', details: error?.message });
      } else {
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({ error: error?.message || 'Unknown' })}\n\n`);
        res.end();
      }
    } catch (sendErr) {
      // best effort
      console.error('Failed to send error over SSE', sendErr);
    }
  }
};

export default chatStreamRoute;
