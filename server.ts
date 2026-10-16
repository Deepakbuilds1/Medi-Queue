import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleCors } from './src/server/corsHelper';
import healthHandler from './api/health.ts';
import superAdminAuthHandler from './api/super-admin/auth.ts';
import superAdminLoginHandler from './api/super-admin/login.ts';
import superAdminSessionHandler from './api/super-admin/session.ts';
import superAdminVerifySessionHandler from './api/super-admin/verify-session.ts';
import superAdminLogoutHandler from './api/super-admin/logout.ts';
import superAdminVerifyPinHandler from './api/super-admin/verify-pin.ts';
import imagekitConfigHandler from './api/imagekit/config.ts';
import imagekitAuthHandler from './api/imagekit/auth.ts';
import imagekitUploadHandler from './api/imagekit/upload.ts';
import imagekitDeleteHandler from './api/imagekit/delete.ts';

// Load environment configuration
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON requests with 10mb limit for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Standard production security headers
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Apply CORS middleware to API routes
app.use('/api', (req: Request, res: Response, next) => {
  if (handleCors(req, res)) return;
  next();
});

// ----------------------------------------------------------------------------
// API ENDPOINTS (Single-Source-of-Truth mounted from /api)
// ----------------------------------------------------------------------------

// 1. Health check (accessible on both /api/health and /health)
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// 2. Super Admin Authentication & Login Endpoints
app.post('/api/super-admin/auth', superAdminAuthHandler);
app.post('/api/super-admin/login', superAdminLoginHandler);
app.post('/api/super-admin/verify-pin', superAdminVerifyPinHandler);

// 3. Super Admin Session Inspection & Verification Endpoints
app.get('/api/super-admin/session', superAdminSessionHandler);
app.post('/api/super-admin/session', superAdminSessionHandler);
app.get('/api/super-admin/verify-session', superAdminVerifySessionHandler);
app.post('/api/super-admin/verify-session', superAdminVerifySessionHandler);

// 4. Super Admin Logout Endpoint
app.post('/api/super-admin/logout', superAdminLogoutHandler);

// 5. ImageKit Configuration & Media Endpoints
app.get('/api/imagekit/config', imagekitConfigHandler);
app.get('/api/imagekit/auth', imagekitAuthHandler);
app.post('/api/imagekit/upload', imagekitUploadHandler);
app.post('/api/imagekit/delete', imagekitDeleteHandler);

export { app };

// ----------------------------------------------------------------------------
// VITE MIDDLEWARE & SPA SERVING
// ----------------------------------------------------------------------------

const VALID_FRONTEND_PATTERNS = [
  /^\/$/,
  /^\/patient\/?$/,
  /^\/display\/?$/,
  /^\/admin(\/.*)?$/,
  /^\/super-admin(\/.*)?$/,
  /^\/maintenance\/?$/,
  /^\/forbidden\/?$/,
  /^\/403\/?$/,
  /^\/404\/?$/,
];

function isKnownFrontendRoute(pathname: string): boolean {
  return VALID_FRONTEND_PATTERNS.some(pattern => pattern.test(pathname));
}

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });

    // Catch non-existent routes in development mode to return true HTTP 404
    app.use(async (req, res, next) => {
      const isHtmlNav = (req.headers.accept || '').includes('text/html');
      const isViteInternal = req.path.startsWith('/@') || req.path.startsWith('/src') || req.path.startsWith('/node_modules') || req.path.includes('.');
      
      if (req.method === 'GET' && isHtmlNav && !isViteInternal) {
        if (!isKnownFrontendRoute(req.path)) {
          try {
            const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
            const html = await vite.transformIndexHtml(req.url, template);
            return res.status(404).set({ 'Content-Type': 'text/html' }).end(html);
          } catch {
            const fallback404 = path.resolve(process.cwd(), 'public/404.html');
            if (fs.existsSync(fallback404)) {
              return res.status(404).sendFile(fallback404);
            }
          }
        }
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (isKnownFrontendRoute(req.path)) {
        res.status(200).sendFile(path.join(distPath, 'index.html'));
      } else {
        const custom404 = path.join(distPath, '404.html');
        if (fs.existsSync(custom404)) {
          res.status(404).sendFile(custom404);
        } else {
          res.status(404).sendFile(path.join(distPath, 'index.html'));
        }
      }
    });
  }

  const server = httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MediQueue server running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown handling for container and cloud orchestration (Cloud Run, Kubernetes, Docker)
  const gracefulShutdown = (signal: string) => {
    console.log(`[Lifecycle] Received ${signal}. Draining in-flight requests and shutting down gracefully...`);
    server.close(() => {
      console.log('[Lifecycle] HTTP server connections closed cleanly.');
      process.exit(0);
    });

    // Enforce shutdown after 10-second timeout if keep-alive connections do not drain
    setTimeout(() => {
      console.error('[Lifecycle] Forced shutdown after connection drain timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Only start the standalone server when executed directly (not under test runner)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST && !process.env.TEST) {
  startServer();
}
