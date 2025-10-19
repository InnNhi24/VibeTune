"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("../clients/openai"));
const deepgram_1 = __importDefault(require("../clients/deepgram"));
const supabase_1 = require("../clients/supabase");
const chatRoute = async (req, res) => {
    const { conversationId, profileId, text, audioUrl, deviceId, retryOfMessageId, version } = req.body;
    // 1. Validate request fields
    if (!conversationId || !profileId || (!text && !audioUrl)) {
        return res.status(400).json({ error: 'Bad Request', details: 'Missing required fields: conversationId, profileId, text or audioUrl' });
    }
    else if (retryOfMessageId && !version) {
        return res.status(400).json({ error: 'Bad Request', details: 'version is required when retryOfMessageId is provided' });
    }
    let userText = text;
    try {
        // 2. If audioUrl present => fetch audio => Deepgram STT => transcript => userText = transcript
        if (audioUrl) {
            const { result, error } = await deepgram_1.default.listen.prerecorded.transcribeUrl(audioUrl, {
                model: 'nova-2',
                smart_format: true,
                language: 'en',
            });
            if (error) {
                console.error('Deepgram STT error:', error);
                return res.status(502).json({ error: 'Deepgram STT failed', details: error.message });
            }
            userText = result.results?.channels[0]?.alternatives[0]?.transcript || "";
        }
        // 3. Call OpenAI with system prompt and JSON response format
        const systemPrompt = `You are VibeTune, a friendly AI prosody coach.\nRespond casually in 2–4 short sentences.\nThen provide “AI Analysis” with word stress marks, intonation arrows (↗︎/↘︎),\nrhythm pacing comments, and a short actionable tip.\nReturn structured JSON:\n{\n  "replyText": "...",\n  "turn_feedback": {\n    "grammar": [{"error": "...", "suggest": "..."}],\n    "vocab": [{"word": "...", "explain": "...", "CEFR": "B1"}],\n    "prosody": {"rate": 0.7, "pitch": 0.8, "energy": 0.6, "notes": "..."}\n  },\n  "guidance": "Short motivational tip"\n}`;
        const completion = await openai_1.default.chat.completions.create({
            model: 'gpt-4o-mini', // or gpt-3.5-turbo
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText },
            ],
            response_format: { type: 'json_object' },
        });
        const choice = completion.choices[0];
        const message = choice?.message;
        let aiResponse = {};
        if (message?.content) {
            try {
                aiResponse = JSON.parse(message.content);
            }
            catch (e) {
                console.warn("Failed to parse OpenAI content as JSON.", e);
            }
        }
        else if (message?.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            if (toolCall?.type === 'function' && toolCall.function?.arguments) {
                try {
                    aiResponse = JSON.parse(toolCall.function.arguments);
                }
                catch (e) {
                    console.warn("Failed to parse OpenAI tool_calls arguments as JSON.", e);
                }
            }
        }
        // 4. Insert two rows into Supabase table `messages`
        // a) user message
        const { error: userMessageError } = await supabase_1.supabaseServiceRole
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
            console.error('Supabase user message insert error:', userMessageError);
            return res.status(500).json({ error: 'Database error', details: userMessageError.message });
        }
        // b) ai message
        const { replyText, turn_feedback, guidance, scores } = aiResponse;
        const { error: aiMessageError } = await supabase_1.supabaseServiceRole
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
            console.error('Supabase AI message insert error:', aiMessageError);
            return res.status(500).json({ error: 'Database error', details: aiMessageError.message });
        }
        // 5. Return Response
        res.status(200).json({
            replyText: aiResponse.replyText,
            feedback: aiResponse.turn_feedback,
            guidance: aiResponse.guidance,
            scores: scores,
        });
    }
    catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
exports.default = chatRoute;
//# sourceMappingURL=chat.js.map