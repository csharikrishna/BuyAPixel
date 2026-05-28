/**
 * Production-safe logger utility.
 * Silences all output in production builds.
 * Usage: import { logger } from '@/utils/logger';
 */

const IS_DEV = import.meta.env.DEV;

export const logger = {
   log: (...args: unknown[]) => {
      if (IS_DEV) console.log(...args);
   },
   warn: (...args: unknown[]) => {
      if (IS_DEV) console.warn(...args);
   },
   error: (...args: unknown[]) => {
      // Errors are always logged (useful for monitoring services)
      console.error(...args);
   },
   info: (...args: unknown[]) => {
      if (IS_DEV) console.info(...args);
   },
   debug: (...args: unknown[]) => {
      if (IS_DEV) console.debug(...args);
   },
};
