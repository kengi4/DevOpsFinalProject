import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ChecksStore } from './checksStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create and configure the CloudPulse Express application.
 */
export function createApp(options = {}) {
  const store = options.store ?? new ChecksStore();
  const config = {
    appName: options.appName ?? 'CloudPulse',
    version: options.version ?? process.env.APP_VERSION ?? '1.0.0',
    environment: options.environment ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
    cloudProvider: options.cloudProvider ?? process.env.CLOUD_PROVIDER ?? 'Local Docker',
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: config.appName.toLowerCase(),
      version: config.version,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    res.status(200).json({
      ready: true,
      checksCount: store.list().length,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/info', (_req, res) => {
    const mem = process.memoryUsage();
    res.status(200).json({
      appName: config.appName,
      version: config.version,
      environment: config.environment,
      cloudProvider: config.cloudProvider,
      hostname: os.hostname(),
      nodeVersion: process.version,
      platform: `${os.platform()}/${os.arch()}`,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMB: Number((mem.rss / 1024 / 1024).toFixed(1)),
        heapUsedMB: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/checks', (req, res, next) => {
    try {
      const items = store.list(req.query.status);
      res.status(200).json({ items, total: items.length });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/checks', (req, res, next) => {
    try {
      const created = store.create(req.body ?? {});
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/checks/:id/toggle', (req, res) => {
    const updated = store.toggle(req.params.id);
    if (!updated) {
      res.status(404).json({ error: `Check "${req.params.id}" not found.` });
      return;
    }
    res.status(200).json(updated);
  });

  app.delete('/api/checks/:id', (req, res) => {
    const deleted = store.remove(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: `Check "${req.params.id}" not found.` });
      return;
    }
    res.status(204).send();
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Malformed JSON request body.' });
      return;
    }
    const statusCode = err.statusCode ?? 500;
    res.status(statusCode).json({ error: err.message || 'Internal server error.' });
  });

  return app;
}
