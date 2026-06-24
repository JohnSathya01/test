import { validateEmail, validatePassword, validatePasswordMatch } from '../validation';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    test('should return true for a valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });

    test('should return true for email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toBe(true);
    });

    test('should return true for email with numbers', () => {
      expect(validateEmail('user123@example123.com')).toBe(true);
    });

    test('should return false for email without @', () => {
      expect(validateEmail('invalidemail.com')).toBe(false);
    });

    test('should return false for email without domain', () => {
      expect(validateEmail('test@')).toBe(false);
    });

    test('should return false for email without TLD', () => {
      expect(validateEmail('test@example')).toBe(false);
    });

    test('should return false for email with spaces', () => {
      expect(validateEmail('test @example.com')).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(validateEmail('')).toBe(false);
    });

    test('should return false for email with multiple @ symbols', () => {
      expect(validateEmail('test@@example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('should return valid for a strong password', () => {
      const result = validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return error for password shorter than 8 characters', () => {
      const result = validatePassword('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should return error for password without uppercase letter', () => {
      const result = validatePassword('password123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('should return error for password without lowercase letter', () => {
      const result = validatePassword('PASSWORD123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('should return error for password without a number', () => {
      const result = validatePassword('Password!!!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    test('should return error for password without a special character', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    test('should return multiple errors for very weak password', () => {
      const result = validatePassword('a');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    test('should return errors for empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validatePasswordMatch', () => {
    test('should return true when passwords match', () => {
      expect(validatePasswordMatch('Password123!', 'Password123!')).toBe(true);
    });

    test('should return false when passwords do not match', () => {
      expect(validatePasswordMatch('Password123!', 'DifferentPass!')).toBe(false);
    });

    test('should return true when both are empty', () => {
      expect(validatePasswordMatch('', '')).toBe(true);
    });

    test('should return false when one is empty and the other is not', () => {
      expect(validatePasswordMatch('Password123!', '')).toBe(false);
      expect(validatePasswordMatch('', 'Password123!')).toBe(false);
    });
  });
});