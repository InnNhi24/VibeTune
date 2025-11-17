import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { Mic, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { SimpleAuthService } from "../../services/authServiceSimple";
import { Profile } from "../../services/supabaseClient";
import { motion } from "framer-motion";
import { validateEmail, validatePassword } from "../../utils/helpers";
import { logger } from "../../utils/logger";
import { PasswordStrengthIndicator } from "../PasswordStrengthIndicator";

interface AuthProps {
  onAuthComplete: (user: Profile) => void;
  onBack: () => void;
  mode?: 'signin' | 'signup';
}

export function Auth({ onAuthComplete, onBack, mode = 'signin' }: AuthProps) {
  const [isLogin, setIsLogin] = useState(mode === 'signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    confirmPassword: ""
  });

  useEffect(() => {
    setIsLogin(mode === 'signin');
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
  logger.debug('Auth: Starting authentication...', { isLogin, email: formData.email });
      
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

      let result;
      if (isLogin) {
        result = await SimpleAuthService.signIn({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        });
      } else {
        result = await SimpleAuthService.signUp({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          username: formData.username.trim()
        });
      }
      const resData: any = (result as any)?.data;

      logger.debug('Auth: Auth result:', { success: !!resData, error: !!result.error });

      if (result.error) {
        logger.error('Auth: Auth error:', result.error);

        let errorMessage = result.error.message || 'An error occurred during authentication';
        
        // Check error code first, then message
        const errorCode = result.error?.code || '';
        
        // Additional check: if login failed and no user data, likely user doesn't exist
        const isLoginAttempt = isLogin;
        const hasUserData = !!(result as any)?.data?.user;
        
        if (errorCode === 'email_not_confirmed') {
          errorMessage = 'Please confirm your email first';
        } else if (errorCode === 'too_many_requests') {
          errorMessage = 'Too many attempts. Try again later';
        } else if (errorCode === 'signup_disabled') {
          errorMessage = 'Sign up is currently disabled';
        } else if (errorCode === 'user_not_found') {
          errorMessage = 'Account not found. Please sign up first';
        } else if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('invalid_credentials')) {
          // For Supabase, we need to distinguish between wrong email vs wrong password
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const isValidEmailFormat = emailRegex.test(formData.email || '');
          
          if (!isValidEmailFormat) {
            errorMessage = 'Invalid email format';
          } else if (isLoginAttempt && !hasUserData) {
            // Login failed with no user data - likely account doesn't exist
            errorMessage = 'Account not found. Please sign up first';
          } else if (isLoginAttempt) {
            // Login failed but user exists - likely wrong password
            errorMessage = 'Invalid password';
          } else {
            // Sign up failed - likely duplicate email
            errorMessage = 'Account already exists. Try signing in instead';
          }
        } else if (errorMessage.includes('User not found') || errorMessage.includes('user_not_found') || errorMessage.includes('Email not found')) {
          errorMessage = 'Account not found. Please sign up first';
        } else if (errorMessage.includes('User already registered') || errorMessage.includes('already_registered')) {
          errorMessage = 'Account already exists. Try signing in instead';
        } else if (errorMessage.includes('Email not confirmed') || errorMessage.includes('email_not_confirmed')) {
          errorMessage = 'Please confirm your email first';
        } else if (errorMessage.includes('Too many requests') || errorMessage.includes('rate_limit')) {
          errorMessage = 'Too many attempts. Try again later';
        } else if (errorMessage.includes('Invalid email') || errorMessage.includes('invalid_email')) {
          errorMessage = 'Invalid email format';
        } else if (errorMessage.includes('Password') && errorMessage.includes('weak')) {
          errorMessage = 'Password too weak. Use at least 6 characters';
        } else if (errorMessage.includes('Network') || errorMessage.includes('network')) {
          errorMessage = 'Connection error. Check your internet';
        }
        
        throw new Error(errorMessage);
      }

      if (resData?.profile) {
        logger.info('Auth: Authentication successful with profile');
        setSuccess(isLogin ? 'Welcome back!' : 'Account created successfully!');

        setTimeout(() => {
          onAuthComplete(resData.profile);
        }, 500);

      } else if (resData?.needsConfirmation) {
        logger.info('Auth: User needs email confirmation');
        const message = resData.message ||
          'Please check your email and click the confirmation link, then try signing in.';

        setSuccess(message);

        if (!isLogin) {
          setTimeout(() => {
            setIsLogin(true);
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
          }, 3000);
        }
      } else {
        logger.warn('Auth: Unexpected result structure:', result);
        throw new Error('Authentication completed but no user data received');
      }

    } catch (err: any) {
  logger.error('Auth: Authentication error:', err);
      setError(err.message || 'An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    logger.debug('Auth: Initiating password reset for email:', formData.email);
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
  logger.info('Auth: Password reset email sent successfully.');
    } catch (err: any) {
  logger.error('Auth: Failed to send password reset email:', err);
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: 'google' | 'github') => {
    logger.debug(`Auth: Attempting social sign-in with ${provider}`);
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error } = await SimpleAuthService.signInWithOAuth(provider);
      if (error) {
        logger.error(`Auth: Social sign-in with ${provider} failed:`, error);
        throw error;
      }
      logger.info(`Auth: Social sign-in with ${provider} initiated. Redirecting...`);
      // Supabase OAuth usually handles redirection, so no further action here
    } catch (err: any) {
      logger.error(`Auth: Error during social sign-in with ${provider}:`, err);
      setError(err.message || `Failed to sign in with ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 py-8 overflow-y-auto">
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
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
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
                  
                  {/* Password Strength Indicator - only show for sign up */}
                  {!isLogin && (
                    <PasswordStrengthIndicator 
                      password={formData.password}
                      onValidityChange={setIsPasswordValid}
                    />
                  )}
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
                  disabled={isLoading || (!isLogin && !isPasswordValid)}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              {/* Forgot Password */}
              {isLogin && (
                <div className="mt-4 text-center">
                  <Button
                    variant="link"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                    className="text-sm text-foreground/80 hover:text-foreground"
                  >
                    Forgot your password?
                  </Button>
                </div>
              )}

              {/* Toggle between signin/signup */}
              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                </span>
                <Button
                  variant="link"
                  onClick={() => {
                      logger.debug('Auth: Toggling between signin/signup');
                      setIsLogin(!isLogin);
                      setError('');
                      setSuccess('');
                      setFormData({ email: formData.email, password: '', username: '', confirmPassword: '' });
                    }}
                  disabled={isLoading}
                  className="p-0 h-auto font-semibold text-foreground/80 hover:text-foreground"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Social Login Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => handleSocialSignIn("google")}
            disabled={isLoading}
          >
            Sign in with Google
          </Button>
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => handleSocialSignIn("github")}
            disabled={isLoading}
          >
            Sign in with GitHub
          </Button>
        </motion.div>

        <div className="mt-6 text-center">
          <Button variant="link" onClick={onBack} className="text-sm text-foreground/80 hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Onboarding
          </Button>
        </div>
      </div>
    </div>
  );
}


