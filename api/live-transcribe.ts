// Alias route: forward live chunk requests to the same OpenAI transcribe handler
// This ensures frontend raw Blob POSTs to /api/live-transcribe are handled by the
// proven OpenAI transcribe implementation in `api/transcribe.ts`.
export { config } from './transcribe';
export { default } from './transcribe';
import handler from './transcribe';

export default handler;
