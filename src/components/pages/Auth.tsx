import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { Mic, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { SimpleAuthService, testAuth } from "../../services/authServiceSimple";
import { Profile } from "../../services/supabaseClient";
import { motion } from "motion/react";
import { validateEmail, validatePassword } from "../../utils/helpers";

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
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    confirmPassword: ""
  });

  // Update isLogin when mode prop changes
  useEffect(() => {
    setIsLogin(mode === 'signin');
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      console.log('🔄 Starting authentication...', { isLogin, email: formData.email });
      
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

      console.log('🔄 Auth result:', { success: !!result.data, error: !!result.error });

      if (result.error) {
        console.error('❌ Auth error:', result.error);
        
        let errorMessage = result.error.message || 'An error occurred during authentication';
        
        // Handle specific errors
        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (errorMessage.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Try signing in instead.';
        } else if (errorMessage.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link before signing in.';
        } else if (errorMessage.includes('Too many requests')) {
          errorMessage = 'Too many attempts. Please wait a moment and try again.';
        }
        
        throw new Error(errorMessage);
      }

      if (result.data?.profile) {
        console.log('✅ Authentication successful with profile');
        setSuccess(isLogin ? 'Welcome back!' : 'Account created successfully!');
        
        // Small delay to show success message, then complete auth
        setTimeout(() => {
          onAuthComplete(result.data.profile);
        }, 500);
        
      } else if (result.data?.needsConfirmation) {
        console.log('📧 User needs email confirmation');
        const message = result.data.message || 
          'Please check your email and click the confirmation link, then try signing in.';
        
        setSuccess(message);
        
        // Switch to login mode if we're in signup
        if (!isLogin) {
          setTimeout(() => {
            setIsLogin(true);
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
          }, 3000);
        }
      } else {
        console.warn('⚠️ Unexpected result structure:', result);
        throw new Error('Authentication completed but no user data received');
      }

    } catch (err: any) {
      console.error('❌ Authentication error:', err);
      setError(err.message || 'An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
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

  const testConnection = async () => {
    try {
      setError('');
      setSuccess('');
      console.log('🔍 Testing authentication system...');
      
      const authResult = await testAuth();
      if (authResult) {
        setSuccess('✓ Authentication system is working! You can now sign up or sign in.');
      } else {
        setError('✗ Authentication system test failed. Check console for details.');
      }
      
    } catch (err: any) {
      console.error('❌ Connection test error:', err);
      setError(`Connection test failed: ${err.message}`);
    }
  };

  const createDemoUser = () => {
    console.log('🧪 Creating demo user...');
    setSuccess('Creating demo user...');
    
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
      console.log('✅ Demo profile created, completing auth...');
      onAuthComplete(demoProfile);
    }, 500);
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

              {/* Forgot Password */}
              {isLogin && (
                <div className="mt-4 text-center">
                  <Button
                    variant="link"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                    className="text-sm"
                  >
                    Forgot your password?
                  </Button>
                </div>
              )}

              {/* Toggle between signin/signup */}
              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">
                  {isLogin ? "Don\'t have an account? " : "Already have an account? "}
                </span>
                <Button
                  variant="link"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setSuccess('');
                    setFormData({ email: formData.email, password: '', username: '', confirmPassword: '' });
                  }}
                  disabled={isLoading}
                  className="p-0 h-auto font-semibold"
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
            onClick={async () => {
              setIsLoading(true);
              setError("");
              setSuccess("");
              try {
                const { error } = await SimpleAuthService.signInWithOAuth("google");
                if (error) throw error;
              } catch (err: any) {
                setError(err.message || "Failed to sign in with Google");
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
          >
            Sign in with Google
          </Button>
          <Button 
            variant="outline"
            className="w-full"
            onClick={async () => {
              setIsLoading(true);
              setError("");
              setSuccess("");
              try {
                const { error } = await SimpleAuthService.signInWithOAuth("github");
                if (error) throw error;
              } catch (err: any) {
                setError(err.message || "Failed to sign in with GitHub");
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
          >
            Sign in with GitHub
          </Button>
        </motion.div>

        {/* Demo User and Testing */}
        <div className="space-y-3">
          <Button 
            variant="default"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
            onClick={createDemoUser}
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
              {isLoading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
              Test Connection
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
              {isLoading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
              Check Auth
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>💡 Having trouble? Try the demo user button above</p>
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
