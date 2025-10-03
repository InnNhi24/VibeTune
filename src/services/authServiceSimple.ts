import { supabase, Profile } from './supabaseClient';
import { withTimeout, tryWithTimeout } from '../utils/timeoutHelpers';

export interface SignUpData {
  email: string;
  password: string;
  username: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Simple auth service that doesn't rely on profiles table
export class SimpleAuthService {
  static async signUp({ email, password, username }: SignUpData) {
    try {
      console.log('Simple signup starting for:', email);
      
      // Try server-side signup first (auto-confirms email)
      try {
        const serverSignupResult = await this.serverSignUp({ email, password, username });
        if (serverSignupResult.success) {
          console.log('✅ Server signup successful, now signing in...');
          
          // After successful server signup, sign in the user
          const signInResult = await this.signIn({ email, password });
          if (signInResult.data?.profile) {
            return signInResult;
          }
        }
      } catch (serverError) {
        console.warn('Server signup failed, trying client signup:', serverError);
      }
      
      // Fallback to client-side signup with email confirmation handling
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: username
          },
          // Try to set confirmation URL to current origin
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) {
        console.error('Supabase auth signup error:', authError);
        throw authError;
      }

      console.log('Auth signup result:', { 
        hasUser: !!authData.user, 
        needsConfirmation: !authData.session,
        userEmail: authData.user?.email 
      });

      // Check if user needs email confirmation
      if (authData.user && !authData.session) {
        console.log('📧 User created but needs email confirmation');
        
        // Return special response indicating email confirmation needed
        return { 
          data: { 
            user: authData.user, 
            needsConfirmation: true,
            message: 'Please check your email and click the confirmation link, then try signing in.'
          }, 
          error: null 
        };
      }

      if (authData.user && authData.session) {
        console.log('✅ User created and signed in immediately');
        
        // Create a profile object from auth data
        const profile: Profile = {
          id: authData.user.id,
          email: authData.user.email || email,
          username: username,
          level: null, // Will be fetched from profiles table if exists
          placement_test_completed: false,
          created_at: authData.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        // Fetch profile from database to get actual level and placement_test_completed status
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile after signup:', profileError);
          // Fallback to basic profile if fetching fails
          return { data: { user: authData.user, profile }, error: null };
        }

        const finalProfile = profileData ? { ...profile, ...profileData } : profile;
        return { data: { user: authData.user, profile: finalProfile }, error: null };
      }

      return { data: authData, error: null };
    } catch (error: any) {
      console.error('Simple signup error:', error);
      return { data: null, error };
    }
  }

  static async signIn({ email, password }: SignInData) {
    try {
      console.log('Simple signin starting for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Supabase auth signin error:', error);
        
        // Provide user-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          error.message = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          error.message = 'Please check your email and click the confirmation link before signing in.';
        } else if (error.message.includes('Too many requests')) {
          error.message = 'Too many login attempts. Please wait a moment and try again.';
        }
        
        throw error;
      }

      console.log('Auth signin result:', { 
        hasUser: !!data.user, 
        hasSession: !!data.session,
        emailVerified: data.user?.email_confirmed_at ? true : false
      });

      if (data.user && data.session) {
        // Create profile from auth user data
        const profile: Profile = {
          id: data.user.id,
          email: data.user.email || email,
          username: data.user.user_metadata?.username || 
                   data.user.user_metadata?.display_name ||
                   data.user.user_metadata?.name || 
                   email.split('@')[0] || 'User',
          level: null, // Will be fetched from profiles table if exists
          placement_test_completed: false,
          created_at: data.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        // Fetch profile from database to get actual level and placement_test_completed status
        const { data: profileData, error: profileError } = await supabase
          .from(\'profiles\')
          .select(\'*\')
          .eq(\'id\', data.user.id)
          .single();

        if (profileError && profileError.code !== \'PGRST116\') {
          console.error(\'Error fetching profile after signin:\', profileError);
          // Fallback to basic profile if fetching fails
          return { data: { user: data.user, profile }, error: null };
        }

        const finalProfile = profileData ? { ...profile, ...profileData } : profile;
        return { data: { user: data.user, profile: finalProfile }, error: null };
      } else if (data.user && !data.session) {
        // User exists but no session - likely unconfirmed email
        return { 
          data: { 
            user: data.user, 
            needsConfirmation: true,
            message: 'Please check your email and click the confirmation link, then try signing in again.'
          }, 
          error: null 
        };
      }

      return { data, error: null };
    } catch (error: any) {
      console.error('Simple signin error:', error);
      return { data: null, error };
    }
  }

  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
    }
  }

  static async serverSignUp({ email, password, username }: SignUpData) {
    try {
      console.log('🔄 Attempting server-side signup for:', email);
      
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-b2083953/signup`;
      
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          email,
          password,
          name: username
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server signup error:', response.status, errorText);
        throw new Error(`Server signup failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Server signup successful');
      return { success: true, data: result };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Server signup timeout');
        return { success: false, error: new Error('Server signup timed out') };
      }
      console.error('Server signup error:', error);
      return { success: false, error };
    }
  }

  static async signInWithOAuth(provider: 'google' | 'github') {
    try {
      console.log(`Starting OAuth with ${provider}...`);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        console.error(`OAuth ${provider} error:`, error);
        
        // Provide user-friendly OAuth error messages
        let friendlyMessage = `Failed to sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}.`;
        
        if (error.message.includes('provider is not enabled')) {
          friendlyMessage = `${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not enabled. Please use email/password or contact support.`;
        } else if (error.message.includes('redirect')) {
          friendlyMessage = 'OAuth redirect configuration error. Please try email/password sign-in.';
        }
        
        return { data: null, error: { ...error, message: friendlyMessage } };
      }

      return { data, error };
    } catch (error) {
      console.error(`OAuth ${provider} error:`, error);
      return { data: null, error };
    }
  }

  static async resetPassword(email: string) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  static async updateProfile(userId: string, updates: Partial<Profile>, existingProfile?: Profile) {
    try {
      console.log('🔄 SimpleAuthService.updateProfile called:', { userId, updates, hasExistingProfile: !!existingProfile });
      
      // Check if we have a Supabase session (real user)
      const { data: session } = await supabase.auth.getSession();
      
      if (session?.session?.user) {
        console.log('✅ Real user with session - creating profile from session data');
        // Real user with session - merge updates with session data
        const profile: Profile = {
          id: userId,
          email: session.session.user.email || '',
          username: session.session.user.user_metadata?.username || 
                   session.session.user.user_metadata?.display_name ||
                   session.session.user.user_metadata?.name || 
                   session.session.user.email?.split('@')[0] || 'User',
          // Properly handle level updates - use provided value or keep existing
          level: updates.level !== undefined ? updates.level : null,
          // Properly handle placement test status - use provided value or keep existing
          placement_test_completed: updates.placement_test_completed !== undefined ? updates.placement_test_completed : false,
          placement_test_score: updates.placement_test_score,
          created_at: session.session.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        console.log('✅ Profile created from session data:', profile);
        return { data: profile, error: null };
      } 
      
      // No session - this is likely a demo user, use existing profile data
      if (existingProfile) {
        console.log('✅ Demo user - merging updates with existing profile');
        const profile: Profile = {
          ...existingProfile,
          // Apply updates, preserving existing values unless explicitly updated
          level: updates.level !== undefined ? updates.level : existingProfile.level,
          placement_test_completed: updates.placement_test_completed !== undefined ? updates.placement_test_completed : existingProfile.placement_test_completed,
          placement_test_score: updates.placement_test_score !== undefined ? updates.placement_test_score : existingProfile.placement_test_score,
          last_login: new Date().toISOString(),
        };

        console.log('✅ Profile created from existing profile:', profile);
        return { data: profile, error: null };
      }
      
      // Fallback - create a basic profile with just the updates
      console.warn('⚠️ No session or existing profile - creating basic profile');
      const profile: Profile = {
        id: userId,
        email: `demo@vibetune.com`,
        username: 'Demo User',
        level: updates.level || null,
        placement_test_completed: updates.placement_test_completed || false,
        placement_test_score: updates.placement_test_score,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        device_id: this.getDeviceId()
      };

      console.log('✅ Basic profile created:', profile);
      return { data: profile, error: null };
      
    } catch (error) {
      console.error('❌ Error in updateProfile:', error);
      return { data: null, error };
    }
  }

  static getDeviceId(): string {
    try {
      if (typeof window === 'undefined' || !localStorage) {
        return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.warn('Failed to access localStorage for device ID:', error);
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  static async getCurrentSession() {
    try {
      console.log('🔍 Checking session...');
      
      // Use timeout helper for cleaner code - very aggressive 800ms timeout
      const sessionResult = await tryWithTimeout(
        () => supabase.auth.getSession(),
        800,
        null
      );
      
      if (!sessionResult) {
        console.log('⚠️ Session check timed out');
        return null;
      }
      
      const { data: { session } } = sessionResult;
      console.log('✅ Session found:', !!session?.user);
      return session;
    } catch (error) {
      console.log('⚠️ Session check failed:', error?.message || error);
      return null;
    }
  }

  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

// Test function to verify auth is working
export const testAuth = async () => {
  console.log('Testing authentication system...');
  
  try {
    // Test connection
    const { data, error } = await supabase.auth.getSession();
    console.log('Session test result:', { hasSession: !!data.session, error: !!error });
    
    if (error) {
      console.error('Session error:', error);
      return false;
    }
    
    console.log('Authentication system is working!');
    return true;
  } catch (error) {
    console.error('Auth test failed:', error);
    return false;
  }
};