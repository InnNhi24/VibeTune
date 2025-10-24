"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../clients/supabase");
// Simple in-memory rate limiting map: { profileId: { eventType: lastEventTimestamp } }
const lastEventTimestamps = {};
const eventsIngestRoute = async (req, res) => {
    const { profileId, event_type, metadata } = req.body;
    // 1. Validate request fields
    if (!profileId || !event_type) {
        return res.status(400).json({ error: 'Bad Request', details: 'Missing required fields: profileId, event_type' });
    }
    try {
        const now = Date.now();
        const oneSecond = 1000; // 1 second in milliseconds
        let skipped = false;
        // Soft rate-limit (skip if same {profileId,event_type} within 1s)
        if (lastEventTimestamps[profileId] && lastEventTimestamps[profileId][event_type]) {
            const lastTimestamp = lastEventTimestamps[profileId][event_type];
            if (now - lastTimestamp < oneSecond) {
                skipped = true;
            }
        }
        if (!skipped) {
            // Update last event timestamp
            if (!lastEventTimestamps[profileId]) {
                lastEventTimestamps[profileId] = {};
            }
            lastEventTimestamps[profileId][event_type] = now;
            // Insert into `analytics_events`
            const supabaseServiceRole = (0, supabase_1.createServiceRoleClient)();
            const { error } = await supabaseServiceRole
                .from('analytics_events')
                .insert({
                profile_id: profileId,
                event_type: event_type,
                metadata: metadata || {},
            });
            if (error) {
                console.error('Supabase analytics_events insert error:', error);
                return res.status(500).json({ error: 'Database error', details: error.message });
            }
        }
        res.status(200).json({ ok: true, skipped: skipped });
    }
    catch (error) {
        console.error('Events ingest endpoint error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
exports.default = eventsIngestRoute;
//# sourceMappingURL=eventsIngest.js.map