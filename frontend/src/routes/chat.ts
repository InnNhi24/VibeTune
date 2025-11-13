
import { Request, Response } from 'express';
import openai from '../clients/openai';
import deepgram from '../clients/deepgram';
import { supabaseServiceRole } from '../clients/supabase';
import { logger } from '../utils/logger';

const chatRoute = async (req: Request, res: Response) => {
  const { conversationId, profileId, text, audioUrl, deviceId, retryOfMessageId, version } = req.body;

  // 1. Validate request fields
  if (!conversationId || !profileId || (!text && !audioUrl)) {
    return res.status(400).json({ error: 'Bad Request', details: 'Missing required fields: conversationId, profileId, text or audioUrl' });
  } else if (retryOfMessageId && !version) {
    return res.status(400).json({ error: 'Bad Request', details: 'version is required when retryOfMessageId is provided' });
  }

  let userText = text;

  try {
    // 2. If audioUrl present => fetch audio => Deepgram STT => transcript => userText = transcript
    if (audioUrl) {
      // For simplicity, directly using the audioUrl as input for Deepgram. In a real scenario, you might need to fetch the audio stream.
      const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(audioUrl, {
        model: 'nova-2',
        smart_format: true,
        language: 'en',
      });

      if (error) {
        logger.error('Deepgram STT error:', error);
        return res.status(502).json({ error: 'Deepgram STT failed', details: error.message });
      }
      userText = result.results?.channels[0]?.alternatives[0]?.transcript || "";
    }

  // 3. Call OpenAI with VibeTune system prompt (topic discovery / main chat / wrap-up)
  const systemPrompt = `You are VibeTune, an AI English speaking teacher who talks like a friendly friend.

Follow the 3-phase flow: TOPIC_DISCOVERY -> MAIN_CHAT -> WRAP-UP. When you decide on a clear topic, include a control tag at the end of your reply exactly like: [[TOPIC_CONFIRMED: topic_name_here]]. When the user requests end (/end) or you are instructed to wrap up, return a short goodbye plus a structured summary with headings: VOCABULARY, GRAMMAR POINTS, OVERALL FEEDBACK.

Keep replies short (2–5 sentences) and friendly. Correct only a few important mistakes. Use simple, level-appropriate vocabulary in summaries.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or gpt-3.5-turbo
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      response_format: { type: 'json_object' },
    });

    const choice = completion.choices[0];
    const message = choice?.message;
    let aiResponse: any = {};

    if (message?.content) {
      try {
        aiResponse = JSON.parse(message.content);
      } catch (e) {
        logger.warn("Failed to parse OpenAI content as JSON.", e);
      }
    } else if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall?.type === 'function' && toolCall.function?.arguments) {
        try {
          aiResponse = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          logger.warn("Failed to parse OpenAI tool_calls arguments as JSON.", e);
        }
      }
    }

    // 4. Insert two rows into Supabase table `messages`
    // a) user message
    const { error: userMessageError } = await supabaseServiceRole
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender: 'user',
        type: audioUrl ? 'audio' : 'text',
        content: userText,
        audio_url: audioUrl || null,
        retry_of_message_id: retryOfMessageId || null,
        version: version || 1,
        device_id: deviceId || null,
      });

    if (userMessageError) {
      logger.error('Supabase user message insert error:', userMessageError);
      return res.status(500).json({ error: 'Database error', details: userMessageError.message });
    }

    // b) ai message
    const { replyText, turn_feedback, guidance, scores } = aiResponse;

    // Parse control tag for topic confirmation
    const topicTagMatch = (replyText || '').match(/\[\[TOPIC_CONFIRMED:\s*([^\]]+)\]\]/i);
    if (topicTagMatch) {
      const confirmedTopic = topicTagMatch[1].trim();
      try {
        await supabaseServiceRole
          .from('conversations')
          .update({ topic: confirmedTopic })
          .eq('id', conversationId);
      } catch (e) {
        logger.warn('Failed to persist confirmed topic:', e);
      }
    }

    const { error: aiMessageError } = await supabaseServiceRole
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender: 'ai',
        type: 'text',
        content: replyText,
        prosody_feedback: turn_feedback.prosody,
        vocab_suggestions: turn_feedback.vocab,
        guidance: guidance,
        scores: scores,
        device_id: deviceId || null,
      });

    if (aiMessageError) {
      logger.error('Supabase AI message insert error:', aiMessageError);
      return res.status(500).json({ error: 'Database error', details: aiMessageError.message });
    }

    // 5. Return Response
    res.status(200).json({
      replyText: aiResponse.replyText,
      feedback: aiResponse.turn_feedback,
      guidance: aiResponse.guidance,
      scores: scores,
      topic_confirmed: topicTagMatch ? topicTagMatch[1].trim() : null
    });

  } catch (error: any) {
    logger.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export default chatRoute;

