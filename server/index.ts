// Environment variables are provided by Replit platform
// No need to load from .env file

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieSession from "cookie-session";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import csrf from 'csurf';
import { setupVite, serveStatic, log } from "./vite";

export const app = express();

// Behind Vercel/Proxies ensure correct protocol detection for secure cookies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? undefined : false,
  referrerPolicy: { policy: 'no-referrer' },
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.CORS_ORIGIN;
    if (!allowed || allowed === '*' || !origin) return callback(null, true);
    if (origin === allowed) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Compression middleware
app.use(compression({
  filter: (req: any, res: any) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CSRF protection for non-API HTML forms (skipped for JSON APIs)
const csrfProtection = csrf({ cookie: false });
app.use((req, res, next) => {
  // Only apply CSRF on non-JSON form submissions (e.g., text/html)
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (req.path.startsWith('/api') || contentType.includes('application/json')) return next();
  return csrfProtection(req, res, next);
});

// Session configuration
const useCookieSession = process.env.VERCEL === '1' || process.env.USE_COOKIE_SESSION === '1';
if (useCookieSession) {
  app.use(
    cookieSession({
      name: 'ff_sess',
      keys: [process.env.SESSION_SECRET || 'dev-insecure-session-secret'],
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      // 30 days default; can be overridden per-request via req.sessionOptions.maxAge
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    })
  );
} else {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this-in-production',
      resave: false,
      saveUninitialized: false,
      rolling: true, // Extend session on activity
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for PWA persistence
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      },
    })
  );
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Initialize the app for serverless or regular mode
let serverPromise: Promise<any> | null = null;

async function initializeApp() {
  if (serverPromise) return serverPromise;
  
  serverPromise = (async () => {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    return server;
  })();

  return serverPromise;
}

// Initialize the app
initializeApp().catch(console.error);

// Only start the server if not in serverless environment
if (process.env.VERCEL !== '1') {
  (async () => {
    try {
      const server = await initializeApp();

      // ALWAYS serve the app on the port specified in the environment variable PORT
      // Other ports are firewalled. Default to 5000 if not specified.
      // this serves both the API and the client.
      // It is the only port that is not firewalled.
      const port = parseInt(process.env.PORT || '5000', 10);
      server.listen({
        port,
        host: "0.0.0.0",
        reusePort: true,
      }, () => {
        log(`serving on port ${port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  })();
}

// Export the app for serverless environments
export default app;
