import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Mic, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { SimpleAuthService } from "../services/authServiceSimple";
import { useAppStore } from "../store/appStore";
import { logger } from "../utils/logger";
import { PasswordStrengthIndicator, validatePassword } from "./PasswordStrengthIndicator";

interface AuthScreenProps {
  onAuthComplete: () => void;
}

export function AuthScreen({ onAuthComplete }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    confirmPassword: ""
  });
  const [error, setError] = useState<string | null>(null);
  const setUser = useAppStore((state) => state.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength for sign up
    if (!isLogin) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        setError("Password does not meet requirements");
        return;
      }
    }

    try {
      if (isLogin) {
        const { user, profile } = await SimpleAuthService.signIn(formData.email, formData.password);
        if (user && profile) {
          setUser(profile);
          onAuthComplete();
        } else {
          setError("Invalid email or password");
        }
      } else {
        const { user, profile } = await SimpleAuthService.signUp(formData.email, formData.password, formData.username);
        if (user && profile) {
          setUser(profile);
          onAuthComplete();
        } else {
          setError("Sign up failed");
        }
      }
    } catch (err: any) {
      logger.error("Auth error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github' | 'apple') => {
    setError(null);
    try {
      await SimpleAuthService.signInWithOAuth(provider);
      // Supabase handles redirect, onAuthComplete will be called after redirect
    } catch (err: any) {
      logger.error("OAuth error:", err);
      setError(err.message || "An unexpected error occurred during OAuth.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 py-8 overflow-y-auto">
      <div className="max-w-sm mx-auto w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Mic className="w-8 h-8 text-accent" />
            <h1 className="text-2xl font-bold text-foreground">SpeakPro</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Welcome back!" : "Join the prosody learning community"}
          </p>
        </div>

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
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Your display name"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
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
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
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
                <div className="space-y-2">
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
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <Button 
                type="submit" 
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                disabled={isLoading || (!isLogin && !isPasswordValid)}
              >
                {isLoading ? "Loading..." : (isLogin ? "Sign In" : "Create Account")}
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
              >
                Continue with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthLogin('github')}
              >
                Continue with GitHub
              </Button>
              {/* Apple OAuth is not directly supported by SimpleAuthService in this context */}
              {/* <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthLogin('apple')}
              >
                Continue with Apple
              </Button> */}
            </div>

            <div className="mt-4 text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLogin && (
          <div className="text-center">
            <Button variant="link" className="text-sm text-muted-foreground">
              Forgot your password?
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

