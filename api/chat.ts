import serverless from 'serverless-http';
import app from '../backend/dist/index';

export default serverless(app);

