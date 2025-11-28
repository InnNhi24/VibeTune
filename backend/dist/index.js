"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables before importing modules that initialize
// clients using env vars (OpenAI, Supabase, etc.). This prevents
// "Missing credentials" errors when those modules initialize at import time.
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const chat_1 = __importDefault(require("./routes/chat"));
const placementScore_1 = __importDefault(require("./routes/placementScore"));
const eventsIngest_1 = __importDefault(require("./routes/eventsIngest"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const liveTranscribe_1 = __importDefault(require("./routes/liveTranscribe"));
const synthesize_1 = __importDefault(require("./routes/synthesize"));
const analyzeProsody_1 = __importStar(require("./routes/analyzeProsody"));
const chatStream_1 = __importDefault(require("./routes/chatStream"));
const dataProxy_1 = __importDefault(require("./routes/dataProxy"));
const security_1 = require("./middleware/security");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Security middleware (order matters!)
app.use(security_1.securityHeaders);
app.use(security_1.requestLogger);
app.use(security_1.sanitizeInput);
app.use((0, security_1.requestSizeLimit)('10mb'));
// CORS configuration
app.use((0, cors_1.default)(security_1.corsConfig));
// Body parsing
app.use(body_parser_1.default.json({ limit: '10mb' }));
app.use(body_parser_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint
app.get('/health', security_1.healthCheck);
// Aliases to match frontend API expectations
app.get('/api/health', security_1.healthCheck);
// Speech API compatibility routes expected by frontend (/api/speech/*)
// Map /api/speech/transcribe -> existing liveTranscribeRoute
app.post('/api/speech/transcribe', security_1.rateLimits.audio, liveTranscribe_1.default);
// Analyze prosody and synthesize endpoints are planned; return 501 until implemented.
// Implemented TTS endpoint
app.post('/api/speech/synthesize', security_1.rateLimits.ai, synthesize_1.default);
// Prosody analysis accepts multipart/form-data (audio file) or JSON { audioData: base64 }
app.post('/api/speech/analyze-prosody', security_1.rateLimits.ai, ...(Array.isArray(analyzeProsody_1.analyzeProsodyMiddleware) ? analyzeProsody_1.analyzeProsodyMiddleware : [analyzeProsody_1.analyzeProsodyMiddleware]), analyzeProsody_1.default);
// Chat streaming endpoint (SSE)
app.post('/api/chat-stream', security_1.rateLimits.ai, chatStream_1.default);
// API routes with rate limiting
app.post('/api/chat', security_1.rateLimits.ai, chat_1.default);
// Proxy legacy /api/data Vercel function to local Express route
app.all('/api/data', dataProxy_1.default);
app.post('/api/placement-score', security_1.rateLimits.general, placementScore_1.default);
app.post('/api/events-ingest', security_1.rateLimits.general, eventsIngest_1.default);
app.post('/api/feedback', security_1.rateLimits.general, feedback_1.default);
app.post('/api/live-transcribe', security_1.rateLimits.audio, liveTranscribe_1.default);
const frontendPath = path_1.default.join(__dirname, '../../frontend/dist');
app.use(express_1.default.static(frontendPath));
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path_1.default.join(frontendPath, 'index.html'));
    }
    else {
        next();
    }
});
// Error handling middleware (must be last)
app.use(security_1.errorHandler);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
    });
});
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 VibeTune server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map