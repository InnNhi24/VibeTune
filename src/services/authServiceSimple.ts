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
            // Ensure profile is created with initial level and placement test status
            await supabase
              .from('profiles')
              .upsert({
                id: signInResult.data.user.id,
                email: signInResult.data.user.email || email,
                username: username, // Ensure username is saved
                level: null, // New users start with no level
                placement_test_completed: false,
                created_at: signInResult.data.user.created_at || new Date().toISOString(),
                last_login: new Date().toISOString(),
                device_id: this.getDeviceId()
              }, { onConflict: 'id' });
            
            const { data: updatedProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', signInResult.data.user.id)
              .single();

            return { data: { user: signInResult.data.user, profile: updatedProfile }, error: null };
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
        
        // Create a profile object from auth data with initial null level and false placement_test_completed
        const profile: Profile = {
          id: authData.user.id,
          email: authData.user.email || email,
          username: username, // Ensure username is saved
          level: null, // New users start with no level, will be set after selection/placement test
          placement_test_completed: false,
          created_at: authData.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        // Upsert profile into database with initial null level and false placement_test_completed
        await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: authData.user.email || email,
            username: username, // Ensure username is saved
            level: null, // Ensure level is null on initial signup
            placement_test_completed: false,
            created_at: profile.created_at,
            last_login: profile.last_login,
            device_id: profile.device_id
          }, { onConflict: 'id' });

        return { data: { user: authData.user, profile }, error: null };
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
        // Fetch profile from database to get actual level and placement_test_completed status
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error fetching profile after signin:', profileError);
          // If profile not found or error, create a basic one with null level
          const profile: Profile = {
            id: data.user.id,
            email: data.user.email || email,
            username: data.user.user_metadata?.username || 
                     data.user.user_metadata?.display_name ||
                     data.user.user_metadata?.name || 
                     email.split('@')[0] || 'User',
            level: null, // Default to null if profile fetch fails or not found
            placement_test_completed: false,
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: new Date().toISOString(),
            device_id: this.getDeviceId()
          };
          // Attempt to upsert this basic profile to ensure it exists
          await supabase
            .from('profiles')
            .upsert(profile, { onConflict: 'id' });

          return { data: { user: data.user, profile }, error: null };
        }

        // If profile exists, use its data, ensuring username is prioritized from profileData
        const profile: Profile = {
          id: data.user.id,
          email: data.user.email || email,
          username: profileData?.username || 
                    data.user.user_metadata?.username || 
                    data.user.user_metadata?.display_name ||
                    data.user.user_metadata?.name || 
                    email.split('@')[0] || 'User',
          level: profileData?.level || null, // Use fetched level or null
          placement_test_completed: profileData?.placement_test_completed || false, // Use fetched status or false
          created_at: data.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(), // Update last_login here
          device_id: this.getDeviceId()
        };

        // Update last login immediately (not in background)
        try {
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: profile.email,
              username: profile.username,
              level: profile.level,
              placement_test_completed: profile.placement_test_completed,
              placement_test_score: profile.placement_test_score,
              created_at: profile.created_at,
              last_login: new Date().toISOString(),
              device_id: profile.device_id
            }, { onConflict: 'id' });
          console.log('✅ Last login updated successfully');
        } catch (error) {
          console.warn('⚠️ Profile last_login update failed:', error);
        }

        return { data: { user: data.user, profile }, error: null };
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
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session?.user) {
        console.log('✅ Real user with session - updating profile in DB');
        
        // First, get the current profile to merge with updates
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        // Prepare the update data, ensuring we don't lose existing data
        const updateData = {
          id: userId,
          email: currentProfile?.email || sessionData.session.user.email || updates.email,
          username: updates.username || currentProfile?.username || sessionData.session.user.user_metadata?.username || 'User',
          level: updates.level !== undefined ? updates.level : currentProfile?.level,
          placement_test_completed: updates.placement_test_completed !== undefined ? updates.placement_test_completed : currentProfile?.placement_test_completed || false,
          placement_test_score: updates.placement_test_score !== undefined ? updates.placement_test_score : currentProfile?.placement_test_score,
          created_at: currentProfile?.created_at || sessionData.session.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(), // Always update last_login
          device_id: currentProfile?.device_id || this.getDeviceId()
        };
        
        console.log('📝 Upserting profile data:', updateData);
        
        // Real user with session - upsert updates to DB
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .upsert(updateData, { onConflict: 'id' })
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating profile in DB:', updateError);
          return { data: null, error: updateError };
        }
        
        console.log('✅ Profile updated successfully in DB:', updatedProfile);
        return { data: updatedProfile, error: null };
      } 
      
      // No session - this is likely a demo user, use existing profile data
      if (existingProfile) {
        console.log('✅ Demo user - merging updates with existing profile');
        const profile: Profile = {
          ...existingProfile,
          // Apply updates, preserving existing values unless explicitly updated
          email: updates.email || existingProfile.email,
          username: updates.username || existingProfile.username,
          level: updates.level !== undefined ? updates.level : existingProfile.level,
          placement_test_completed: updates.placement_test_completed !== undefined ? updates.placement_test_completed : existingProfile.placement_test_completed,
          placement_test_score: updates.placement_test_score !== undefined ? updates.placement_test_score : existingProfile.placement_test_score,
          last_login: new Date().toISOString(),
        };

        console.log('✅ Demo profile updated:', profile);
        return { data: profile, error: null };
      }
      
      // Fallback - create a basic profile with just the updates
      console.warn('⚠️ No session or existing profile - creating basic profile');
      const profile: Profile = {
        id: userId,
        email: updates.email || `demo@vibetune.com`,
        username: updates.username || 'Demo User',
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
        console.log('⚠️ No session found or timeout occurred.');
        return { data: { session: null, user: null }, error: null };
      }

      const { data: { session, user }, error } = sessionResult;

      if (error) {
        console.error('Error getting session:', error);
        return { data: null, error };
      }

      if (user) {
        // Fetch profile from database to get actual level and placement_test_completed status
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error fetching profile during session check:', profileError);
          // If profile not found or error, create a basic one with null level
          const profile: Profile = {
            id: user.id,
            email: user.email || '',
            username: user.user_metadata?.username || 
                      user.user_metadata?.display_name ||
                      user.user_metadata?.name || 
                      user.email?.split('@')[0] || 'User',
            level: null,
            placement_test_completed: false,
            created_at: user.created_at || new Date().toISOString(),
            last_login: new Date().toISOString(),
            device_id: this.getDeviceId()
          };
          await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
          return { data: { session, user, profile }, error: null };
        }

        // If profile exists, use its data, ensuring username is prioritized from profileData
        const profile: Profile = {
          id: user.id,
          email: user.email || '',
          username: profileData?.username || 
                    user.user_metadata?.username || 
                    user.user_metadata?.display_name ||
                    user.user_metadata?.name || 
                    user.email?.split('@')[0] || 'User',
          level: profileData?.level || null,
          placement_test_completed: profileData?.placement_test_completed || false,
          created_at: user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        // Update last login in background
        setTimeout(async () => {
          try {
            await supabase
              .from('profiles')
              .upsert({
                id: user.id,
                last_login: new Date().toISOString()
              }, { onConflict: 'id' });
          } catch (error) {
            console.warn('Profile last_login update failed (non-blocking):', error);
          }
        }, 0);

        return { data: { session, user, profile }, error: null };
      }

      return { data: { session, user }, error: null };
    } catch (error: any) {
      console.error('Error in getCurrentSession:', error);
      return { data: null, error };
    }
  }
}



// Test function for authentication system
export async function testAuth(): Promise<boolean> {
  try {
    console.log('🔍 Testing authentication system...');
    
    // Test Supabase connection
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Auth test failed:', error);
      return false;
    }
    
    console.log('✅ Auth system test passed');
    return true;
  } catch (error) {
    console.error('❌ Auth test error:', error);
    return false;
  }
}
