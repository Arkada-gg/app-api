import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { redisIntegration } from '@sentry/nestjs';
import { CacheService } from './redis/cache.service';

if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // Add our Profiling integration
      nodeProfilingIntegration(),
      redisIntegration({
        cachePrefixes: [CacheService.cachePrefix]
      })
    ],

    // Add Tracing by setting tracesSampleRate
    // We recommend adjusting this value in production
    tracesSampleRate: 0.05,

    // Set sampling rate for profiling
    // This is relative to tracesSampleRate
    profilesSampleRate: 0.1,
  });
}
