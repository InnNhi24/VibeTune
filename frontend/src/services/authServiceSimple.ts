import { supabase, Profile } from './supabaseClient';
import { logger } from '../utils/logger';

export interface SignUpData {
  email: string;
  password: string;
  username: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Simplified auth service focused on reliability and preventing bouncebacks
export class SimpleAuthService {
  static async signUp({ email, password, username }: SignUpData) {
    try {
  logger.info('🔄 Starting signup for:', email);
      
      // Use Supabase auth signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: username
          }
        }
      });

      if (authError) {
        logger.error('❌ Signup error:', authError);
        throw authError;
      }

      logger.info('✅ Signup successful:', { 
        hasUser: !!authData.user, 
        hasSession: !!authData.session,
        needsConfirmation: !authData.session 
      });

      // If user needs email confirmation
      if (authData.user && !authData.session) {
        return { 
          data: { 
            user: authData.user, 
            needsConfirmation: true,
            message: 'Please check your email and click the confirmation link, then try signing in.'
          }, 
          error: null 
        };
      }

      // If user is immediately signed in (auto-confirm enabled)
      if (authData.user && authData.session) {
        // Create profile
        const profile: Profile = {
          id: authData.user.id,
          email: authData.user.email || email,
          username: username,
          level: null, // New users start with no level
          placement_test_completed: false,
          created_at: authData.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        // Save profile to database
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profile, { onConflict: 'id' });

        if (profileError) {
          logger.warn('⚠️ Profile creation failed:', profileError);
          // Continue anyway - profile can be created later
        }

        return { data: { user: authData.user, profile }, error: null };
      }

      return { data: authData, error: null };
    } catch (error: any) {
  logger.error('❌ Signup failed:', error);
      return { data: null, error };
    }
  }

  static async signIn({ email, password }: SignInData) {
    try {
  logger.info('🔄 Starting signin for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logger.error('❌ Signin error:', error);
        throw error;
      }

      logger.info('✅ Signin successful:', { 
        hasUser: !!data.user, 
        hasSession: !!data.session 
      });

      if (data.user && data.session) {
        // Fetch or create profile
        let { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // If profile doesn't exist, create it
        if (profileError && profileError.code === 'PGRST116') {
          const newProfile: Profile = {
            id: data.user.id,
            email: data.user.email || email,
            username: data.user.user_metadata?.username || 
                     data.user.user_metadata?.display_name ||
                     data.user.email?.split('@')[0] || 'User',
            level: null,
            placement_test_completed: false,
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: new Date().toISOString(),
            device_id: this.getDeviceId()
          };

          const { error: createError } = await supabase
            .from('profiles')
            .insert(newProfile);

          if (createError) {
            logger.warn('⚠️ Profile creation failed:', createError);
          }

          profileData = newProfile;
        } else if (profileError) {
            logger.error('❌ Profile fetch error:', profileError);
          // Create a basic profile from auth data
          profileData = {
            id: data.user.id,
            email: data.user.email || email,
            username: data.user.user_metadata?.username || 
                     data.user.email?.split('@')[0] || 'User',
            level: null,
            placement_test_completed: false,
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: new Date().toISOString(),
            device_id: this.getDeviceId()
          };
          } else {
          // Update last login
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.user.id);

          if (updateError) {
            logger.warn('⚠️ Last login update failed:', updateError);
          }
        }

        return { data: { user: data.user, profile: profileData }, error: null };
      }

      return { data, error: null };
    } catch (error: any) {
  logger.error('❌ Signin failed:', error);
      return { data: null, error };
    }
  }

  static async signOut() {
    try {
  logger.info('🔄 Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('❌ Signout error:', error);
      } else {
        logger.info('✅ Signout successful');
      }
      return { error };
    } catch (error) {
        logger.error('❌ Signout failed:', error);
      return { error };
    }
  }

  static async signInWithOAuth(provider: 'google' | 'github') {
    try {
  logger.info(`🔄 Starting OAuth with ${provider}...`);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        logger.error(`❌ OAuth ${provider} error:`, error);
        throw error;
      }

      return { data, error };
    } catch (error) {
        logger.error(`❌ OAuth ${provider} failed:`, error);
      return { data: null, error };
    }
  }

  static async resetPassword(email: string) {
    try {
  logger.info('🔄 Sending password reset for:', email);
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        logger.error('❌ Password reset error:', error);
        throw error;
      }

  logger.info('✅ Password reset email sent');
      return { data, error };
    } catch (error) {
        logger.error('❌ Password reset failed:', error);
      return { data: null, error };
    }
  }

  static async updateProfile(userId: string, updates: Partial<Profile>, existingProfile?: Profile) {
    try {
  logger.info('🔄 Updating profile:', { userId, updates });
      
      // Check if we have a valid session
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session?.user) {
        // Real user with session - update in database
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        const updateData = {
          id: userId,
          email: currentProfile?.email || sessionData.session.user.email || updates.email,
          username: updates.username || currentProfile?.username || 'User',
          level: updates.level !== undefined ? updates.level : currentProfile?.level,
          placement_test_completed: updates.placement_test_completed !== undefined ? 
            updates.placement_test_completed : currentProfile?.placement_test_completed || false,
          placement_test_score: updates.placement_test_score !== undefined ? 
            updates.placement_test_score : currentProfile?.placement_test_score,
          created_at: currentProfile?.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: currentProfile?.device_id || this.getDeviceId()
        };
        
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .upsert(updateData, { onConflict: 'id' })
          .select()
          .single();

        if (updateError) {
          logger.error('❌ Profile update error:', updateError);
          return { data: null, error: updateError };
        }
        
  logger.info('✅ Profile updated successfully');
        return { data: updatedProfile, error: null };
      } 
      
      // Demo user - merge with existing profile
      if (existingProfile) {
        const profile: Profile = {
          ...existingProfile,
          username: updates.username || existingProfile.username,
          level: updates.level !== undefined ? updates.level : existingProfile.level,
          placement_test_completed: updates.placement_test_completed !== undefined ? 
            updates.placement_test_completed : existingProfile.placement_test_completed,
          placement_test_score: updates.placement_test_score !== undefined ? 
            updates.placement_test_score : existingProfile.placement_test_score,
          last_login: new Date().toISOString(),
        };

  logger.info('✅ Demo profile updated');
        return { data: profile, error: null };
      }

  logger.warn('⚠️ No session or existing profile for update');
      return { data: null, error: new Error('No valid session or profile') };
    } catch (error: any) {
  logger.error('❌ Profile update failed:', error);
      return { data: null, error };
    }
  }

  static async getCurrentSession() {
    try {
  logger.info('🔄 Checking current session...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.error('❌ Session check error:', error);
        return { data: null, error };
      }

      if (!session?.user) {
        logger.info('❌ No active session');
        return { data: null, error: null };
      }

  logger.info('✅ Active session found');
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        logger.error('❌ Profile fetch error:', profileError);
      }

      // Create profile object
      const profile: Profile = profileData || {
        id: session.user.id,
        email: session.user.email || '',
        username: session.user.user_metadata?.username || 
                 session.user.email?.split('@')[0] || 'User',
        level: null,
        placement_test_completed: false,
        created_at: session.user.created_at || new Date().toISOString(),
        last_login: new Date().toISOString(),
        device_id: this.getDeviceId()
      };

      // Update last_login in the profiles table to reflect current access.
      // This ensures 'Last Login' shown in Settings is current even when the
      // session was persisted (user didn't explicitly sign in during this run).
      try {
        await supabase
          .from('profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('id', session.user.id);
      } catch (e) {
        logger.warn('⚠️ Failed to update last_login during session check:', e);
      }

      return { data: { session, user: session.user, profile }, error: null };
    } catch (error: any) {
        logger.error('❌ Session check failed:', error);
      return { data: null, error };
    }
  }

  static getDeviceId(): string {
    // Generate or retrieve device ID
    let deviceId = localStorage.getItem('vibetune-device-id');
    if (!deviceId) {
      deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('vibetune-device-id', deviceId);
    }
    return deviceId;
  }
}

// Test function for authentication system
export async function testAuth(): Promise<boolean> {
  try {
  logger.info('🔍 Testing authentication system...');
    
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('❌ Auth test failed:', error);
      return false;
    }
    
  logger.info('✅ Auth system test passed');
    return true;
  } catch (error) {
    logger.error('❌ Auth test error:', error);
    return false;
  }
}
