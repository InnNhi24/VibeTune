/**
 * Comprehensive Input Validation System for VibeTune
 * Provides validation for all user inputs with detailed error messages
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

export class Validator {
  private static rules: Record<string, ValidationRule> = {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address'
    },
    password: {
      required: true,
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      message: 'Password must be 8-128 characters with uppercase, lowercase, number, and special character'
    },
    username: {
      required: true,
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_-]+$/,
      message: 'Username must be 3-30 characters, letters, numbers, hyphens, and underscores only'
    },
    message: {
      required: true,
      minLength: 1,
      maxLength: 1000,
      message: 'Message must be 1-1000 characters'
    },
    audioFile: {
      required: true,
      custom: (file: File) => {
        if (!file) return 'Audio file is required';
        if (file.size > 10 * 1024 * 1024) return 'Audio file must be less than 10MB';
        if (!file.type.startsWith('audio/')) return 'File must be an audio file';
        return null;
      }
    },
    conversationTopic: {
      required: true,
      minLength: 3,
      maxLength: 100,
      message: 'Topic must be 3-100 characters'
    }
  };

  /**
   * Validate a single field
   */
  static validateField(fieldName: string, value: any): ValidationResult {
    const rule = this.rules[fieldName];
    if (!rule) {
      return { isValid: true, errors: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Required check
    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors.push(rule.message || `${fieldName} is required`);
      return { isValid: false, errors };
    }

    // Skip other validations if value is empty and not required
    if (!value || (typeof value === 'string' && !value.trim())) {
      return { isValid: true, errors: [] };
    }

    // Length validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(rule.message || `${fieldName} must be at least ${rule.minLength} characters`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(rule.message || `${fieldName} must be no more than ${rule.maxLength} characters`);
      }
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      errors.push(rule.message || `${fieldName} format is invalid`);
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) {
        errors.push(customError);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate multiple fields
   */
  static validateFields(fields: Record<string, any>): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let isValid = true;

    for (const [fieldName, value] of Object.entries(fields)) {
      const result = this.validateField(fieldName, value);
      if (!result.isValid) {
        isValid = false;
        allErrors.push(...result.errors);
      }
      if (result.warnings) {
        allWarnings.push(...result.warnings);
      }
    }

    return {
      isValid,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
  }

  /**
   * Validate form data
   */
  static validateForm(formData: Record<string, any>): ValidationResult {
    return this.validateFields(formData);
  }

  /**
   * Sanitize input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): ValidationResult {
    return this.validateField('email', email);
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): ValidationResult {
    const result = this.validateField('password', password);
    const warnings: string[] = [];

    if (password.length < 12) {
      warnings.push('Consider using a longer password for better security');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      warnings.push('Add lowercase letters for better security');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      warnings.push('Add uppercase letters for better security');
    }
    if (!/(?=.*\d)/.test(password)) {
      warnings.push('Add numbers for better security');
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      warnings.push('Add special characters for better security');
    }

    return {
      ...result,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate audio file
   */
  static validateAudioFile(file: File): ValidationResult {
    return this.validateField('audioFile', file);
  }

  /**
   * Validate conversation message
   */
  static validateMessage(message: string): ValidationResult {
    return this.validateField('message', message);
  }

  /**
   * Validate conversation topic
   */
  static validateTopic(topic: string): ValidationResult {
    return this.validateField('conversationTopic', topic);
  }

  /**
   * Check if input contains profanity (basic implementation)
   */
  static containsProfanity(text: string): boolean {
    const profanityWords = [
      // Add profanity words here - keeping this minimal for example
      'badword1', 'badword2'
    ];
    
    const lowerText = text.toLowerCase();
    return profanityWords.some(word => lowerText.includes(word));
  }

  /**
   * Validate and sanitize user input
   */
  static validateAndSanitize(input: string, fieldName: string): ValidationResult {
    const sanitized = this.sanitizeInput(input);
    const result = this.validateField(fieldName, sanitized);
    
    if (this.containsProfanity(sanitized)) {
      result.errors.push('Please use appropriate language');
      result.isValid = false;
    }

    return result;
  }
}

// React hook for form validation
export const useValidation = () => {
  const validateField = (fieldName: string, value: any) => 
    Validator.validateField(fieldName, value);
  
  const validateForm = (formData: Record<string, any>) => 
    Validator.validateForm(formData);
  
  const sanitizeInput = (input: string) => 
    Validator.sanitizeInput(input);
  
  const validateAndSanitize = (input: string, fieldName: string) => 
    Validator.validateAndSanitize(input, fieldName);

  return {
    validateField,
    validateForm,
    sanitizeInput,
    validateAndSanitize
  };
};

// Export commonly used validators
export const validateEmail = Validator.validateEmail;
export const validatePassword = Validator.validatePassword;
export const validateAudioFile = Validator.validateAudioFile;
export const validateMessage = Validator.validateMessage;
export const validateTopic = Validator.validateTopic;
