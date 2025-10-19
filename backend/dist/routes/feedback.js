"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../clients/supabase");
const feedbackRoute = async (req, res) => {
    const { messageId, profileId, rating } = req.body;
    // 1. Validate request fields
    if (!messageId || !profileId || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Bad Request', details: 'Missing required fields: messageId, profileId, or invalid rating (must be 1-5)' });
    }
    try {
        // 2. Insert into feedback_rating
        const { error } = await supabase_1.supabaseServiceRole
            .from('feedback_rating')
            .insert({
            message_id: messageId,
            profile_id: profileId,
            rating: rating,
        });
        if (error) {
            console.error('Supabase feedback insert error:', error);
            return res.status(500).json({ error: 'Database error', details: error.message });
        }
        // 3. Response
        res.status(200).json({ ok: true, rating: rating });
    }
    catch (error) {
        console.error('Feedback endpoint error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
exports.default = feedbackRoute;
//# sourceMappingURL=feedback.js.map