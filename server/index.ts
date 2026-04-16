import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { initDB } from './db.js';
import { seed } from './seed.js';
import api from './api.js';

const app = new Hono();

// API routes
app.route('/api', api);

// Serve static files from dist/
app.use('/*', serveStatic({ root: './dist' }));
// SPA fallback
app.get('*', serveStatic({ root: './dist', path: 'index.html' }));

// Start
const port = Number(process.env.PORT) || 3000;

async function start() {
  await initDB();
  await seed();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

start();
