import { supabase, Profile } from './supabaseClient';
import logger from '../utils/logger';

export interface SignUpData {
  email: string;
  password: string;
  username: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export class AuthService {
  static async signUp({ email, password, username }: SignUpData) {
    try {
  logger.info('Starting signup process for:', email);
      
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          }
        }
      });

      if (authError) {
        logger.error('Supabase auth signup error:', authError);
        throw authError;
      }

      logger.info('Auth signup successful:', authData.user?.id);

      if (authData.user) {
        // Create a basic profile object to return immediately
        const basicProfile: Profile = {
          id: authData.user.id,
          email,
          username,
          level: 'Beginner' as const,
          placement_test_completed: false,
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        // Try to create profile in the database (non-blocking for signup flow)
        setTimeout(async () => {
          try {
            await supabase
              .from('profiles')
              .upsert({
                id: authData.user.id,
                email,
                username,
                level: 'Beginner' as const,
                placement_test_completed: false,
                device_id: this.getDeviceId(),
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
              }, {
                onConflict: 'id'
              });
          } catch (error) {
            logger.warn('Profile creation failed (non-blocking):', error);
          }
        }, 0);

        return { data: { user: authData.user, profile: basicProfile }, error: null };
      }

      return { data: authData, error: null };
    } catch (error: any) {
      logger.error('SignUp error:', error);
      return { data: null, error };
    }
  }

  static async signIn({ email, password }: SignInData) {
    try {
  logger.info('Starting signin process for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logger.error('Supabase auth signin error:', error);
        throw error;
      }

      logger.info('Auth signin successful:', data.user?.id);

      if (data.user) {
        // Create basic profile from auth data
        const basicProfile: Profile = {
          id: data.user.id,
          email: data.user.email || email,
          username: data.user.user_metadata?.username || 
                   data.user.user_metadata?.name || 
                   email.split('@')[0] || 'User',
          level: 'Beginner' as const, // Default level
          placement_test_completed: false,
          created_at: data.user.created_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
          device_id: this.getDeviceId()
        };

        // Try to get existing profile from database (non-blocking)
        setTimeout(async () => {
          try {
            // Update last login in background
            await supabase
              .from('profiles')
              .upsert({
                id: data.user.id,
                email: data.user.email || email,
                username: data.user.user_metadata?.username || 
                         data.user.user_metadata?.name || 
                         email.split('@')[0] || 'User',
                last_login: new Date().toISOString(),
                device_id: this.getDeviceId()
              }, {
                onConflict: 'id'
              });
          } catch (error) {
            logger.warn('Profile update failed (non-blocking):', error);
          }
        }, 0);

        return { data: { user: data.user, profile: basicProfile }, error: null };
      }

      return { data, error: null };
    } catch (error: any) {
      logger.error('SignIn error:', error);
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

  static async signInWithOAuth(provider: 'google' | 'github') {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });

      return { data, error };
    } catch (error) {
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

  static async updateProfile(userId: string, updates: Partial<Profile>) {
    try {
  logger.info('Updating profile for user:', userId, 'with updates:', updates);
      
      // If no updates provided, just fetch existing profile
      if (Object.keys(updates).length === 0) {
  logger.info('No updates provided, fetching existing profile...');
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
  logger.debug('Profile fetch result:', { data: !!data, error: !!error });
        
        // If profile doesn't exist, create it
        if (error && (error.code === 'PGRST116' || error.message.includes('No rows'))) {
          logger.info('Profile not found, creating new one...');
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.user) {
            const newProfile = {
              id: userId,
              email: session.session.user.email || '',
              username: session.session.user.user_metadata?.username || 
                       session.session.user.user_metadata?.name || 
                       session.session.user.email?.split('@')[0] || 'User',
              level: 'Beginner' as const, // Set default level instead of null
              placement_test_completed: false,
              device_id: this.getDeviceId(),
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString()
            };
            
            logger.debug('Creating new profile:', newProfile);
            const { data: createdProfile, error: createError } = await supabase
              .from('profiles')
              .upsert(newProfile, { onConflict: 'id' })
              .select()
              .single();
              
            logger.debug('Profile creation result:', { data: !!createdProfile, error: !!createError });
            return { data: createdProfile, error: createError };
          }
        }
        
        return { data, error };
      }

      // Perform update
  logger.info('Performing profile update...');
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...updates,
          last_login: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single();

  logger.debug('Profile update result:', { data: !!data, error: !!error });
      return { data, error };
    } catch (error: any) {
      logger.error('Profile update error:', error);
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
      logger.warn('Failed to access localStorage for device ID:', error);
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  static async getCurrentSession() {
    try {
      // Add timeout to prevent hanging
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 5000)
      );
      
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      return session;
    } catch (error) {
      logger.error('Failed to get current session:', error);
      return null;
    }
  }

  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}