import pino from 'pino';

/** Structured JSON logs to stdout. Never log bodies, tokens, keys, endpoints or links. */
export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { app: 'focus-log' },
  redact: { paths: ['*.password', '*.token', '*.key', '*.endpoint', '*.p256dh', '*.auth_secret'], remove: true },
});
