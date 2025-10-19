"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@deepgram/sdk");
const deepgram = (0, sdk_1.createClient)(process.env.DEEPGRAM_API_KEY || "");
exports.default = deepgram;
//# sourceMappingURL=deepgram.js.map