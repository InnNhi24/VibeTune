"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const chat_1 = __importDefault(require("./routes/chat"));
const placementScore_1 = __importDefault(require("./routes/placementScore"));
const eventsIngest_1 = __importDefault(require("./routes/eventsIngest"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const liveTranscribe_1 = __importDefault(require("./routes/liveTranscribe"));
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
// API routes with rate limiting
app.post('/api/chat', security_1.rateLimits.ai, chat_1.default);
app.post('/api/placement-score', security_1.rateLimits.general, placementScore_1.default);
app.post('/api/events-ingest', security_1.rateLimits.general, eventsIngest_1.default);
app.post('/api/feedback', security_1.rateLimits.general, feedback_1.default);
app.post('/api/live-transcribe', security_1.rateLimits.audio, liveTranscribe_1.default);
const frontendPath = path_1.default.join(__dirname, '../../frontend/build');
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
app.use('*', (req, res) => {
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