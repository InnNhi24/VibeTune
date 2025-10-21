import serverless from 'serverless-http';
import app from '../backend/src/index';

export const config = { runtime: 'nodejs20.x' };
export default serverless(app);

