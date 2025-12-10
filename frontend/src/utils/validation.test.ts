/**
 * Tests for Validation Utils
 */
import { Validator } from './validation';

describe('Validator', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];

      validEmails.forEach(email => {
        const result = Validator.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@'
      ];

      invalidEmails.forEach(email => {
        const result = Validator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!Password',
        'C0mplex@Password123'
      ];

      strongPasswords.forEach(password => {
        const result = Validator.validatePassword(password);
        if (!result.isValid) {
          console.log('Password failed:', password, 'Errors:', result.errors);
        }
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'weak',
        'password',
        '12345678',
        'NoNumbers!',
        'nonumbers123',
        'NOLOWERCASE123!'
      ];

      weakPasswords.forEach(password => {
        const result = Validator.validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should provide warnings for passwords that could be stronger', () => {
      const result = Validator.validatePassword('Short1!');
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('validateMessage', () => {
    it('should validate normal messages', () => {
      const validMessages = [
        'Hello, how are you?',
        'I want to practice English conversation.',
        'This is a test message.'
      ];

      validMessages.forEach(message => {
        const result = Validator.validateMessage(message);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject empty or too long messages', () => {
      const invalidMessages = [
        '',
        ' ',
        'a'.repeat(1001) // Too long
      ];

      invalidMessages.forEach(message => {
        const result = Validator.validateMessage(message);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should remove potentially dangerous content', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img onerror="alert(1)" src="x">',
        'onclick=alert(1)'
      ];

      dangerousInputs.forEach(input => {
        const sanitized = Validator.sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onclick=');
        expect(sanitized).not.toContain('onerror=');
      });
    });

    it('should preserve safe content', () => {
      const safeInputs = [
        'Hello world',
        'This is a normal message',
        'Numbers 123 and symbols !@#'
      ];

      safeInputs.forEach(input => {
        const sanitized = Validator.sanitizeInput(input);
        expect(sanitized).toBe(input.trim());
      });
    });
  });

  describe('validateFields', () => {
    it('should validate multiple fields correctly', () => {
      const validFields = {
        email: 'test@example.com',
        password: 'Strong!Pass123',
        username: 'testuser'
      };

      const result = Validator.validateFields(validFields);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors from multiple invalid fields', () => {
      const invalidFields = {
        email: 'invalid-email',
        password: 'weak',
        username: 'ab' // Too short
      };

      const result = Validator.validateFields(invalidFields);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });
});