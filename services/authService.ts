import { supabase, Profile } from './supabaseClient';

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

      if (authError) throw authError;

      if (authData.user) {
        // Create profile in the profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email,
            username,
            level: 'Beginner' as const,
            device_id: this.getDeviceId()
          })
          .select()
          .single();

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        return { data: { user: authData.user, profile: profileData }, error: null };
      }

      return { data: authData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  static async signIn({ email, password }: SignInData) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Update last login
        await supabase
          .from('profiles')
          .update({ 
            last_login: new Date().toISOString(),
            device_id: this.getDeviceId()
          })
          .eq('id', data.user.id);

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        return { data: { user: data.user, profile }, error: null };
      }

      return { data, error: null };
    } catch (error) {
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

  static async signInWithOAuth(provider: 'google' | 'github' | 'apple' | 'facebook') {
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
      // If no updates provided, just fetch existing profile
      if (Object.keys(updates).length === 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        // If profile doesn't exist, create it
        if (error && error.code === 'PGRST116') {
          const { data: session } = await supabase.auth.getSession();
          if (session?.user) {
            const newProfile = {
              id: userId,
              email: session.user.email || '',
              username: session.user.user_metadata?.username || 
                       session.user.user_metadata?.name || 
                       session.user.email?.split('@')[0] || 'User',
              level: null,
              placement_test_completed: false,
              device_id: this.getDeviceId(),
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString()
            };
            
            const { data: createdProfile, error: createError } = await supabase
              .from('profiles')
              .insert(newProfile)
              .select()
              .single();
              
            return { data: createdProfile, error: createError };
          }
        }
        
        return { data, error };
      }

      // Perform update
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
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
      // Add timeout to prevent hanging
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 5000)
      );
      
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      return session;
    } catch (error) {
      console.error('Failed to get current session:', error);
      return null;
    }
  }

  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}