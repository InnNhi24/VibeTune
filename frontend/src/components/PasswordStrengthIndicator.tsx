import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  onValidityChange?: (isValid: boolean) => void;
}

export function PasswordStrengthIndicator({ password, onValidityChange }: PasswordStrengthIndicatorProps) {
  const requirements: PasswordRequirement[] = [
    {
      label: 'Lowercase letter',
      test: (pwd) => /[a-z]/.test(pwd),
      met: /[a-z]/.test(password)
    },
    {
      label: 'Uppercase letter', 
      test: (pwd) => /[A-Z]/.test(pwd),
      met: /[A-Z]/.test(password)
    },
    {
      label: 'Number',
      test: (pwd) => /[0-9]/.test(pwd),
      met: /[0-9]/.test(password)
    },
    {
      label: 'Special symbol',
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    },
    {
      label: 'At least 8 characters',
      test: (pwd) => pwd.length >= 8,
      met: password.length >= 8
    }
  ];

  const allRequirementsMet = requirements.every(req => req.met);
  
  // Notify parent component about validity
  React.useEffect(() => {
    if (onValidityChange) {
      onValidityChange(allRequirementsMet && password.length > 0);
    }
  }, [allRequirementsMet, password.length, onValidityChange]);

  if (!password) {
    return null; // Don't show indicator when password is empty
  }

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
      <h4 className="text-sm font-medium mb-2 text-muted-foreground">
        Password Requirements
      </h4>
      
      <div className="space-y-2">
        {requirements.map((requirement, index) => (
          <div 
            key={index}
            className={`flex items-center gap-2 text-sm transition-colors duration-200 ${
              requirement.met 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-muted-foreground'
            }`}
          >
            <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-200 ${
              requirement.met 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-muted'
            }`}>
              {requirement.met ? (
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <X className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
            
            <span className={requirement.met ? 'font-medium' : ''}>
              {requirement.label}
            </span>
          </div>
        ))}
      </div>
      
      {/* Overall strength indicator */}
      <div className="mt-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password Strength:</span>
          <span className={`font-medium ${
            allRequirementsMet 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-orange-500 dark:text-orange-400'
          }`}>
            {allRequirementsMet ? 'Strong' : 'Weak'}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="mt-1 w-full bg-muted rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all duration-300 ${
              allRequirementsMet 
                ? 'bg-green-500 w-full' 
                : 'bg-orange-400 w-3/5'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

// Utility function to validate password
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};