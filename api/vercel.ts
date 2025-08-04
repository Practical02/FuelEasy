import { createServer } from 'http';
import { parse } from 'url';
import { app } from '../server/index';

// Vercel serverless function handler
export default function handler(req: any, res: any) {
  const parsedUrl = parse(req.url, true);
  req.query = parsedUrl.query;
  
  // Create a mock server to handle the request
  const server = createServer(app);
  
  // Handle the request
  server.emit('request', req, res);
  
  // Clean up
  server.close();
} 