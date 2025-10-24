// Thin server-side logger wrapper for Hono/Deno runtime
export default {
  debug: (...args: any[]) => {
    try { console.debug('[server][debug]', ...args); } catch { /* no-op */ }
  },
  info: (...args: any[]) => {
    try { console.log('[server][info]', ...args); } catch { /* no-op */ }
  },
  warn: (...args: any[]) => {
    try { console.warn('[server][warn]', ...args); } catch { /* no-op */ }
  },
  error: (...args: any[]) => {
    try { console.error('[server][error]', ...args); } catch { /* no-op */ }
  }
};
