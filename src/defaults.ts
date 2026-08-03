import { createErrors } from './app-error.js';

/** Built-in catalog for zero-config installs. */
export const Defaults = createErrors({
  UNEXPECTED: {
    status: 503,
    errorId: 'APP-503-1',
    title: 'Service Unavailable',
    message: 'An unexpected error occurred. Please try again later.',
  },
} as const);
