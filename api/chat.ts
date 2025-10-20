import serverless from 'serverless-http';
import app from '../backend/src/index';

export default serverless(app);

