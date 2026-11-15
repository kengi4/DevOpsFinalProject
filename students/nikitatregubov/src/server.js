import { createApp } from './app.js';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = createApp();
const server = app.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'CloudPulse server started',
      host: HOST,
      port: PORT,
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
      version: process.env.APP_VERSION ?? '1.0.0',
    })
  );
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: `Received ${signal}, shutting down gracefully` }));
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
