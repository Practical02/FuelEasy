import { VercelRequest, VercelResponse } from '@vercel/node';

// Import and initialize the Express app
let app: any = null;
let initPromise: Promise<any> | null = null;

async function getApp() {
  if (app) return app;
  
  if (!initPromise) {
    initPromise = (async () => {
      // Set environment variable to indicate serverless mode
      process.env.VERCEL = '1';

      // Import the compiled server without triggering build-time deps
      // prettier-ignore
      // @ts-ignore - compiled file, no types
      const { app: expressApp } = await import('../dist/index.js');
      
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      app = expressApp;
      return app;
    })();
  }
  
  return initPromise;
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get the initialized Express app
    const expressApp = await getApp();
    
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Use the Express app
    return new Promise((resolve, reject) => {
      // Set up proper request/response handling
      expressApp(req, res, (err: any) => {
        if (err) {
          console.error('Express app error:', err);
          if (!res.headersSent) {
            res.status(500).json({ 
              message: 'Internal server error',
              error: err.message || 'Unknown error'
            });
          }
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });
  } catch (error) {
    console.error('Handler initialization error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Server initialization failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 