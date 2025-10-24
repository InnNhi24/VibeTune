const isDev = typeof import.meta !== 'undefined' ? ((import.meta as any).env?.MODE === 'development') : (typeof process !== 'undefined' && (process.env.NODE_ENV === 'development'));

export const logger = {
  debug: (...args: any[]) => { if (isDev) console.debug('[debug]', ...args); },
  info: (...args: any[]) => { if (isDev) console.info('[info]', ...args); },
  warn: (...args: any[]) => { console.warn('[warn]', ...args); },
  error: (...args: any[]) => { console.error('[error]', ...args); }
};

export default logger;
