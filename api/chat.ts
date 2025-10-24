import serverless from 'serverless-http';
import app from '../backend/src/index';

// Vercel only accepts 'nodejs' | 'edge' | 'experimental-edge'
export const config = { runtime: 'nodejs' };
export default serverless(app);

