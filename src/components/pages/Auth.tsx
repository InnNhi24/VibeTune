import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Alert, AlertDescription } from "../ui/alert";
import { Mic, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthService } from "../../services/authService";
import { SimpleAuthService, testAuth } from "../../services/authServiceSimple";
import { Profile, supabase } from "../../services/supabaseClient";
import { motion } from "motion/react";
import { validateEmail, validatePassword } from "../../utils/helpers";

interface AuthProps {
  onAuthComplete: (user: Profile) => void;
  onBack: () => void;
  mode?: 'signin' | 'signup';
}

export function Auth({ onAuthComplete, onBack, mode = 'signin' }: AuthProps) {
  const [isLogin, setIsLogin] = useState(mode === 'signin');
  
  // Update isLogin when mode prop changes
  useEffect(() => {
    setIsLogin(mode === 'signin');
  }, [mode]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    confirmPassword: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      console.log('Starting authentication process...', { isLogin, email: formData.email });
      
      // Validation
      if (!validateEmail(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      if (!formData.password) {
        throw new Error('Password is required');
      }

      if (!isLogin) {
        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.isValid) {
          throw new Error(passwordValidation.errors[0]);
        }

        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (!formData.username.trim()) {
          throw new Error('Username is required');
        }
      }

      console.log('Validation passed, calling AuthService...');

      let result;
      if (isLogin) {
        // Sign in
        result = await SimpleAuthService.signIn({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        });
      } else {
        // Sign up
        result = await SimpleAuthService.signUp({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          username: formData.username.trim()
        });
      }

      console.log('AuthService result:', { success: !!result.data, error: !!result.error });

      if (result.error) {
        console.error('Auth error:', result.error);
        
        // Enhanced error handling for database issues
        let errorMessage = result.error.message || 'An error occurred during authentication';
        
        // Handle specific authentication errors
        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (errorMessage.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Try signing in instead.';
        } else if (errorMessage.includes('Password should be at least')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else if (errorMessage.includes('Database error saving new user')) {
          errorMessage = 'There was a database issue creating your account. This is usually a temporary problem. Please try again, or use the demo user to test the app.';
        } else if (errorMessage.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link before signing in.';
        } else if (errorMessage.includes('Too many requests')) {
          errorMessage = 'Too many attempts. Please wait a moment and try again.';
        } else if (errorMessage.includes('signup failed') || errorMessage.includes('500')) {
          errorMessage = 'Server error during account creation. Please try again or use the demo user option below.';
        }
        
        // Log detailed error for debugging
        console.error('🔍 Auth error details:', {
          originalMessage: result.error.message,
          friendlyMessage: errorMessage,
          errorCode: result.error.code || 'unknown',
          errorStatus: result.error.status || 'unknown',
          errorDetails: result.error.details || 'none'
        });
        
        throw new Error(errorMessage);
      }

      if (result.data?.profile) {
        console.log('Authentication successful, profile created:', result.data.profile.id);
        setSuccess(isLogin ? 'Welcome back!' : 'Account created successfully!');
        
        // Call onAuthComplete immediately to prevent auth state conflicts
        onAuthComplete(result.data.profile);
      } else if (result.data?.needsConfirmation) {
        console.log('User needs email confirmation...');
        const message = result.data.message || (isLogin 
          ? 'Please check your email and click the confirmation link, then try signing in again.'
          : 'Account created! Please check your email and click the confirmation link, then try signing in.');
        
        setSuccess(message);
        
        // Switch to login mode if we're in signup
        if (!isLogin) {
          setTimeout(() => {
            setIsLogin(true);
            setFormData(prev => ({ ...prev, password: '' }));
          }, 3000);
        }
      } else if (result.data?.user && !isLogin) {
        console.log('User created, waiting for email confirmation...');
        setSuccess('Account created! Please check your email to verify your account, then try signing in.');
        
        // Switch to login mode after a delay
        setTimeout(() => {
          setIsLogin(true);
          setFormData(prev => ({ ...prev, password: '' }));
        }, 3000);
      } else if (result.data?.message) {
        // Handle custom message from auth service
        setSuccess(result.data.message);
        if (!isLogin) {
          setTimeout(() => {
            setIsLogin(true);
            setFormData(prev => ({ ...prev, password: '' }));
          }, 3000);
        }
      } else {
        console.warn('Unexpected result structure:', result);
        throw new Error('Authentication completed but no user data received');
      }

    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      console.log(`Starting OAuth login with ${provider}...`);
      const result = await SimpleAuthService.signInWithOAuth(provider);
      
      if (result.error) {
        console.error(`OAuth ${provider} error:`, result.error);
        throw result.error;
      }
      
      console.log(`OAuth ${provider} initiated successfully`);
      setSuccess(`Redirecting to ${provider}...`);
      // OAuth will redirect, so no need to handle success here
    } catch (err: any) {
      console.error(`OAuth ${provider} failed:`, err);
      
      // Handle specific OAuth errors
      if (err.message.includes('provider is not enabled')) {
        setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in hasn't been configured yet. Please use email/password authentication instead.`);
      } else {
        setError(err.message || `Failed to sign in with ${provider}. Please try email/password authentication.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Test Supabase connection and auth
  const testConnection = async () => {
    try {
      setError('');
      setSuccess('');
      console.log('Testing authentication system...');
      
      // Test basic auth connection
      const authResult = await testAuth();
      if (authResult) {
        setSuccess('✓ Authentication system is working! You can now sign up or sign in.');
      } else {
        setError('✗ Authentication system test failed. Check console for details.');
      }
      
    } catch (err: any) {
      console.error('Connection test error:', err);
      setError(`Connection test failed: ${err.message}`);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email address first');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { error } = await SimpleAuthService.resetPassword(formData.email);
      if (error) {
        throw error;
      }
      setSuccess('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center p-4">
      <div className="max-w-sm mx-auto w-full space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Mic className="w-8 h-8 text-accent" />
            <h1 className="text-2xl font-bold text-foreground">VibeTune</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Welcome back!" : "Join the prosody learning community"}
          </p>
        </motion.div>

        {/* Error/Success Alerts */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Alert className="border-success/20 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success-foreground">{success}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Auth Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>{isLogin ? "Sign In" : "Create Account"}</CardTitle>
              <CardDescription>
                {isLogin 
                  ? "Enter your credentials to access your learning progress" 
                  : "Start your English prosody learning journey"
                }
              </CardDescription>
              
              {/* Helpful tips */}
              {!isLogin && (
                <div className="text-xs text-muted-foreground bg-primary/10 p-2 rounded border-l-2 border-primary/20">
                  💡 <strong>Tip:</strong> Use a real email address - you'll need to confirm it before you can sign in.
                </div>
              )}
              
              {isLogin && (
                <div className="text-xs text-muted-foreground bg-accent/10 p-2 rounded border-l-2 border-accent/20">
                  🔐 <strong>Trouble signing in?</strong> Check your email for a confirmation link if you just signed up.
                </div>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Your display name"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      required
                      disabled={isLoading}
                    />
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="pl-10 pr-10"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        className="pl-10"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </motion.div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="my-4">
                <Separator />
              </div>

              {/* OAuth Options */}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthLogin('github')}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Continue with GitHub
                </Button>
                
                <p className="text-xs text-muted-foreground text-center mt-2">
                  ℹ️ If OAuth doesn't work, the providers may need configuration. Use email/password instead.
                </p>
              </div>

              <div className="mt-4 text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm"
                  disabled={isLoading}
                >
                  {isLogin 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Forgot Password */}
        {isLogin && (
          <div className="text-center">
            <Button 
              variant="link" 
              className="text-sm text-muted-foreground"
              onClick={handleForgotPassword}
              disabled={isLoading}
            >
              Forgot your password?
            </Button>
          </div>
        )}

        {/* Debug Section - Remove this in production */}
        <div className="text-center space-y-3 border-t-2 border-accent/20 pt-4 bg-accent/5 rounded-lg p-4 -mx-4">
          <p className="text-sm font-medium text-foreground">🔧 Debug & Quick Access</p>
          <p className="text-xs text-muted-foreground">Skip authentication for testing purposes</p>
          
          {/* Large Demo User Button */}
          <Button 
            variant="default"
            className="w-full bg-success hover:bg-success/90 text-success-foreground font-semibold"
            onClick={() => {
              console.log('🧪 Creating demo user for testing...');
              setSuccess('Creating demo user...');
              
              // Create a demo user for testing (no level = new user flow)
              const demoProfile: Profile = {
                id: 'demo-user-' + Date.now(),
                email: 'demo@vibetune.com',
                username: 'Demo User',
                level: null, // No level to test level selection flow
                placement_test_completed: false,
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString(),
                device_id: 'demo-device-' + Date.now()
              };
              
              setTimeout(() => {
                console.log('📝 Demo profile created:', demoProfile);
                console.log('🚀 Calling onAuthComplete with demo user...');
                onAuthComplete(demoProfile);
              }, 500);
            }}
            disabled={isLoading}
          >
            🎭 Continue with Demo User
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test Connection"}
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsLoading(true);
                try {
                  const result = await testAuth();
                  if (result) {
                    setSuccess('✓ Auth system working');
                  } else {
                    setError('✗ Auth system failed');
                  }
                } catch (err: any) {
                  setError('Auth test error: ' + err.message);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Check Auth"}
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p>💡 Having trouble? Try the demo user button above to skip authentication</p>
            <p>🔄 Or check your email for confirmation if you just signed up</p>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={onBack}
            disabled={isLoading}
          >
            Back to Welcome
          </Button>
        </div>
      </div>
    </div>
  );
}