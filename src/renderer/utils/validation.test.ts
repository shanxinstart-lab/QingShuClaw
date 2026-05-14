import { expect, test } from 'vitest';

import { isValidEmail } from './validation';

test('isValidEmail accepts basic email addresses', () => {
  expect(isValidEmail('user@example.com')).toBe(true);
  expect(isValidEmail('first.last+tag@example.co')).toBe(true);
});

test('isValidEmail rejects malformed email addresses', () => {
  expect(isValidEmail('')).toBe(false);
  expect(isValidEmail('user')).toBe(false);
  expect(isValidEmail('user@example')).toBe(false);
  expect(isValidEmail('user @example.com')).toBe(false);
  expect(isValidEmail('user@example. com')).toBe(false);
});
