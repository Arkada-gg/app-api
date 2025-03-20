import * as Sentry from "@sentry/nestjs"
import { nodeProfilingIntegration, } from "@sentry/profiling-node";
import { Integrations } from '@sentry/tracing';

const span = Sentry.getActiveSpan();
if (span) {
  // Add individual metrics
  span.setAttribute("database.rows_affected", 42);
  span.setAttribute("cache.hit_rate", 0.85);
  // Add multiple metrics at once
  span.setAttributes({
    "memory.heap_used": 1024000,
    "queue.length": 15,
    "processing.duration_ms": 127,
  });
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // Add our Profiling integration
    nodeProfilingIntegration(),
  ],

  // Add Tracing by setting tracesSampleRate
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  // Set sampling rate for profiling
  // This is relative to tracesSampleRate
  profilesSampleRate: 1.0,
  debug: true,
});
