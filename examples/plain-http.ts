/**
 * Minimal Express-style example (no Express dependency).
 * Prefer throw + createApi({ preset: 'api' }) at the HTTP boundary.
 */
import { createApi, createErrors } from '../src/index.js';

const Users = createErrors({
  NOT_FOUND: {
    status: 404,
    errorId: 'USERS-404-1',
    title: 'User not found',
    message: 'No user exists for this id.',
  },
} as const);

type User = { id: string; name: string };

const db = new Map<string, User>([['1', { id: '1', name: 'Ada' }]]);

function getUser(id: string): User {
  const user = db.get(id);
  if (!user) throw Users.NOT_FOUND;
  return user;
}

const api = createApi({
  preset: 'api',
  unexpectedError: {
    statusCode: 503,
    errorId: 'APP-503-1',
    title: 'Service Unavailable',
    message: 'Service temporarily unavailable',
  },
});

function handle(path: string) {
  const id = path.split('/').pop() ?? '';
  try {
    const user = getUser(id);
    return {
      status: 200,
      body: api.success(user, { path, message: 'User fetched successfully' }),
    };
  } catch (error) {
    const body = api.failure(error, { path });
    return { status: body.statusCode, body };
  }
}

console.log('ok:', JSON.stringify(handle('/users/1'), null, 2));
console.log('err:', JSON.stringify(handle('/users/missing'), null, 2));
