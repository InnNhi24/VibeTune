import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Auth } from '../../components/pages/Auth';

// Mock the auth service
vi.mock('../../services/authServiceSimple', () => ({
  SimpleAuthService: {
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithOAuth: vi.fn(),
  }
}));

describe('Auth Component', () => {
  const mockOnAuthComplete = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders signup form correctly', () => {
    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    expect(screen.getByText('Create Your VibeTune Account')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders signin form correctly', () => {
    render(
      <Auth 
        mode="signin" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    expect(screen.getByText('Welcome Back to VibeTune')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates form fields correctly', async () => {
    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    const submitButton = screen.getByRole('button', { name: /create account/i });
    
    // Try to submit without filling fields
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('validates password length', async () => {
    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it('shows Google OAuth button', () => {
    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('shows GitHub OAuth button', () => {
    render(
      <Auth 
        mode="signin" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
  });

  it('handles back button click', () => {
    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('disables form during submission', async () => {
    const { SimpleAuthService } = await import('../../services/authServiceSimple');
    const mockSignUp = vi.mocked(SimpleAuthService.signUp);
    
    // Mock a slow response
    mockSignUp.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    // Form should be disabled during submission
    expect(submitButton).toBeDisabled();
    expect(usernameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    // Should show loading state
    expect(screen.getByText(/creating account/i)).toBeInTheDocument();
  });

  it('handles successful signup', async () => {
    const { SimpleAuthService } = await import('../../services/authServiceSimple');
    const mockSignUp = vi.mocked(SimpleAuthService.signUp);
    
    const mockUserProfile = {
      id: 'user123',
      email: 'test@example.com',
      username: 'testuser',
      level: null,
      placement_test_completed: false,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      device_id: 'device123'
    };

    mockSignUp.mockResolvedValue({ data: mockUserProfile, error: null });

    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAuthComplete).toHaveBeenCalledWith(mockUserProfile);
    });
  });

  it('handles signup error', async () => {
    const { SimpleAuthService } = await import('../../services/authServiceSimple');
    const mockSignUp = vi.mocked(SimpleAuthService.signUp);
    
    mockSignUp.mockResolvedValue({ 
      data: null, 
      error: { message: 'Email already exists' } 
    });

    render(
      <Auth 
        mode="signup" 
        onAuthComplete={mockOnAuthComplete} 
        onBack={mockOnBack} 
      />
    );

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });

    expect(mockOnAuthComplete).not.toHaveBeenCalled();
  });
});