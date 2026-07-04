import { describe, expect, it } from 'vitest';
import {
  validateGithubUrl,
  validateLoginForm,
  validatePassword,
  validateRegisterForm,
  validateUsername,
} from '@/utils/validators';

describe('validators', () => {
  it('validateUsername rejects short names', () => {
    expect(validateUsername('ab').valid).toBe(false);
  });

  it('validateUsername accepts valid names', () => {
    expect(validateUsername('zhang.jie').valid).toBe(true);
  });

  it('validatePassword requires letter and digit', () => {
    expect(validatePassword('abcdefgh').valid).toBe(false);
    expect(validatePassword('demo1234').valid).toBe(true);
  });

  it('validateLoginForm passes for mock credentials shape', () => {
    expect(validateLoginForm('zhang.jie', 'demo1234').valid).toBe(true);
  });

  it('validateRegisterForm checks password match', () => {
    expect(validateRegisterForm('user1', 'pass1234', 'pass1234').valid).toBe(true);
    expect(validateRegisterForm('user1', 'pass1234', 'other123').valid).toBe(false);
  });

  it('validateGithubUrl accepts github repo urls', () => {
    expect(
      validateGithubUrl('https://github.com/facebook/react').valid
    ).toBe(true);
    expect(validateGithubUrl('not-a-url').valid).toBe(false);
  });
});
