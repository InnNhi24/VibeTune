"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../clients/supabase");
const placementScoreRoute = async (req, res) => {
    const { profileId, conversationId } = req.body;
    // 1. Validate request fields
    if (!profileId || !conversationId) {
        return res.status(400).json({ error: 'Bad Request', details: 'Missing required fields: profileId, conversationId' });
    }
    try {
        const supabaseServiceRole = (0, supabase_1.createServiceRoleClient)();
        // 2. Read all `messages.scores` for the conversation
        const { data: messages, error: messagesError } = await supabaseServiceRole
            .from('messages')
            .select('scores')
            .eq('conversation_id', conversationId)
            .not("scores", "is", null);
        if (messagesError) {
            console.error('Supabase messages fetch error:', messagesError);
            return res.status(500).json({ error: 'Database error', details: messagesError.message });
        }
        let totalScore = 0;
        let scoreCount = 0;
        messages.forEach((message) => {
            if (message.scores) {
                const { pronunciation, rhythm, intonation } = message.scores;
                if (pronunciation !== null && rhythm !== null && intonation !== null) {
                    totalScore += (pronunciation + rhythm + intonation) / 3;
                    scoreCount++;
                }
            }
        });
        let avgScore = 0;
        if (scoreCount > 0) {
            avgScore = totalScore / scoreCount;
        }
        // 3. Map to level
        let level;
        if (avgScore < 0.45) {
            level = 'Beginner';
        }
        else if (avgScore <= 0.75) {
            level = 'Intermediate';
        }
        else {
            level = 'Advanced';
        }
        // 4. Update Supabase `profiles`
        const { error: profileUpdateError } = await supabaseServiceRole
            .from('profiles')
            .update({
            level: level,
            placement_test_completed: true,
            placement_test_score: avgScore,
        })
            .eq('id', profileId);
        if (profileUpdateError) {
            console.error('Supabase profile update error:', profileUpdateError);
            return res.status(500).json({ error: 'Database error', details: profileUpdateError.message });
        }
        // 5. Response
        res.status(200).json({ level: level, score: parseFloat(avgScore.toFixed(2)) });
    }
    catch (error) {
        console.error('Placement score endpoint error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
exports.default = placementScoreRoute;
//# sourceMappingURL=placementScore.js.map