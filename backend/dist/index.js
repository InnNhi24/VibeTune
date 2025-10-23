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
dotenv_1.default.config();
const app = (0, express_1.default)();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin))
            cb(null, true);
        else
            cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(body_parser_1.default.json());
app.post('/api/chat', chat_1.default);
app.post('/api/placement-score', placementScore_1.default);
app.post('/api/events-ingest', eventsIngest_1.default);
app.post('/api/feedback', feedback_1.default);
const frontendPath = path_1.default.join(__dirname, '../../frontend/build');
app.use(express_1.default.static(frontendPath));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path_1.default.join(frontendPath, 'index.html'));
    }
});
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
exports.default = app;
//# sourceMappingURL=index.js.map