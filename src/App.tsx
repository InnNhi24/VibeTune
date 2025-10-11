import { useState, useEffect, useCallback } from "react";
import { Onboarding } from "./components/pages/Onboarding";
import { Auth } from "./components/pages/Auth";
import { MainAppScreen } from "./components/MainAppScreen";
import { AIPlacementTest } from "./components/AIPlacementTest";
import { LevelSelection } from "./components/LevelSelection";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SimpleAuthService } from "./services/authServiceSimple";
import { Profile } from "./services/supabaseClient";
import { AppProvider, useAppContext, appActions } from "./contexts/AppContext";
import { useAppStore } from "./store/appStore";
import { SyncManager } from "./services/syncManager";
import { tryWithTimeout } from "./utils/timeoutHelpers";

type AppState = 'loading' | 'onboarding' | 'signup' | 'signin' | 'level-selection' | 'placement-test' | 'main-app';

function AppContent() {
  const { state, dispatch } = useAppContext();
  const { trackEvent } = useAppStore();
  const [currentState, setCurrentState] = useState<AppState>('onboarding');
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = state;

  // Ultra-fast initialization - show onboarding immediately, check auth in background
  useEffect(() => {
    if (isInitialized) return;
    setIsInitialized(true);
    
    console.log('🚀 Starting VibeTune - immediate launch');

    // Show onboarding IMMEDIATELY - no loading screen delays
    setCurrentState('onboarding');

    // Check session in background without blocking UI
    const checkSessionInBackground = async () => {
      try {
        // Set offline status safely
        try {
          if (typeof navigator !== 'undefined') {
            dispatch(appActions.setOffline(!navigator.onLine));
          }
        } catch (navError) {
          console.warn('Navigator check failed:', navError);
        }

        // Quick session check in background
        const session = await tryWithTimeout(
          () => SimpleAuthService.getCurrentSession(),
          800,
          null
        );
        
        if (session?.user) {
          console.log('✅ Found existing session - auto-updating UI');
          
          const profile: Profile = {
            id: session.user.id,
            email: session.user.email || '',
            username: session.user.user_metadata?.username || 'User',
            level: session.user.user_metadata?.level || null,
            placement_test_completed: session.user.user_metadata?.placement_test_completed || false,
            created_at: session.user.created_at || new Date().toISOString(),
            last_login: new Date().toISOString(),
            device_id: SimpleAuthService.getDeviceId()
          };

          dispatch(appActions.setUser(profile));
          
          // Smoothly transition to appropriate screen
          if (!profile.level) {
            setCurrentState('level-selection');
          } else {
            setCurrentState('main-app');
          }
        } else {
          console.log('❌ No valid session - staying on onboarding');
        }
      } catch (error) {
        console.log('⚠️ Background session check failed:', error.message);
        // UI already shows onboarding, no action needed
      }
    };

    // Run background check without blocking
    setTimeout(() => {
      checkSessionInBackground().catch(error => {
        console.warn('Background session check rejected:', error);
      });
    }, 50);

  }, [dispatch, isInitialized]);

  // Skip auth state change listener to avoid potential timeout issues
  // Auth state changes will be handled manually when needed

  const handleSignUp = () => {
    setCurrentState('signup');
    trackEvent('onboarding_signup_clicked');
  };

  const handleSignIn = () => {
    setCurrentState('signin');
    trackEvent('onboarding_signin_clicked');
  };

  const handleAuthComplete = useCallback((userData: Profile) => {
    console.log('🚀 Auth completed for user:', userData.id);
    
    // Set user in context immediately
    dispatch(appActions.setUser(userData));
    
    // Navigate immediately without waiting for background tasks
    if (!userData.level) {
      console.log('🎯 Navigating to level selection');
      setCurrentState('level-selection');
    } else {
      console.log('🎯 Navigating to main app');
      setCurrentState('main-app');
    }
    
    // Background tasks with timeout protection
    setTimeout(() => {
      try {
        // Enable sync with timeout
        const syncPromise = SyncManager.enableAutoSync();
        const syncTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sync timeout')), 2000)
        );
        
        Promise.race([syncPromise, syncTimeout])
          .then(() => console.log('✅ Auto sync enabled'))
          .catch(error => console.warn('⚠️ Sync setup failed:', error));
          
        // Track event with timeout
        const trackPromise = trackEvent('auth_completed', { 
          userId: userData.id, 
          level: userData.level,
          isNewUser: !userData.level 
        });
        
        const trackTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tracking timeout')), 1000)
        );
        
        Promise.race([trackPromise, trackTimeout])
          .catch(error => console.warn('Event tracking failed:', error));
          
      } catch (error) {
        console.warn('Background tasks failed:', error);
      }
    }, 50);
  }, [dispatch, trackEvent]);

  const handlePlacementTestComplete = async (results: { level: string; score: number }) => {
    // Navigate immediately to prevent blocking
    setCurrentState('main-app');
    
    if (user) {
      // Background update with timeout
      setTimeout(async () => {
        try {
          const updatePromise = SimpleAuthService.updateProfile(user.id, { 
            level: results.level as Profile['level'],
            placement_test_completed: true,
            placement_test_score: results.score
          }, user);
          
          const updateTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile update timeout')), 3000)
          );
          
          const { data: updatedProfile } = await Promise.race([updatePromise, updateTimeout]);
          
          if (updatedProfile) {
            dispatch(appActions.setUser(updatedProfile));
          }
          
          // Track event with timeout
          const trackPromise = trackEvent('placement_test_completed', {
            userId: user.id,
            score: results.score,
            level: results.level,
            previousLevel: user.level,
            selectionMethod: 'placement_test'
          });
          
          const trackTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Track timeout')), 1000)
          );
          
          Promise.race([trackPromise, trackTimeout])
            .catch(error => console.warn('Tracking failed:', error));
            
        } catch (error) {
          console.error('Background update failed:', error);
        }
      }, 100);
    }
  };

  const handlePlacementTestSkip = () => {
    setCurrentState('main-app');
    trackEvent('placement_test_skipped', { userId: user?.id });
  };

  const handleLevelSelection = async (level: string) => {
    console.log('🎯 handleLevelSelection called:', { level, userId: user?.id, currentUserLevel: user?.level });
    
    // Navigate immediately to prevent blocking
    console.log('🏁 Setting state to main-app');
    setCurrentState('main-app');
    
    if (user) {
      // Background update with aggressive timeout
      setTimeout(async () => {
        try {
          console.log('🔄 Updating user profile with level:', level);
          
          const updatePromise = SimpleAuthService.updateProfile(user.id, { 
            level: level as Profile['level'],
            placement_test_completed: false
          }, user);
          
          const updateTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Level update timeout')), 2000)
          );
          
          const { data: updatedProfile, error: updateError } = await Promise.race([updatePromise, updateTimeout]);
          
          console.log('📋 Profile update result:', { updatedProfile, updateError });
          
          if (updatedProfile) {
            console.log('✅ Dispatching updated user profile:', updatedProfile);
            dispatch(appActions.setUser(updatedProfile));
          } else {
            console.warn('❌ No updated profile returned from updateProfile');
          }
          
          if (updateError) {
            console.warn('❌ Error from updateProfile:', updateError);
          }
          
          // Track event with timeout
          const trackPromise = trackEvent('level_selected', { 
            userId: user.id, 
            level,
            previousLevel: user.level,
            selectionMethod: 'manual'
          });
          
          const trackTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Track timeout')), 1000)
          );
          
          Promise.race([trackPromise, trackTimeout])
            .catch(error => console.warn('Tracking failed:', error));
            
        } catch (error) {
          console.warn('❌ Background level update failed:', error);
        }
      }, 50);
    } else {
      console.error('❌ No user found in handleLevelSelection');
    }
  };

  const handleStartLevelSelection = () => {
    setCurrentState('level-selection');
    trackEvent('level_selection_started', { userId: user?.id });
  };

  const handleLogout = useCallback(async () => {
    console.log('🚪 Starting logout...');
    
    // Clear local state immediately
    dispatch(appActions.setUser(null));
    setCurrentState('onboarding');
    
    // Cleanup in background with timeout protection
    setTimeout(async () => {
      try {
        // Track logout with timeout
        const trackPromise = trackEvent('user_logout_initiated', { userId: user?.id });
        const trackTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Logout track timeout')), 500)
        );
        Promise.race([trackPromise, trackTimeout])
          .catch(error => console.warn('Logout tracking failed:', error));
        
        // Reset sync cache with timeout
        const syncPromise = SyncManager.resetAuthCache();
        const syncTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sync reset timeout')), 1000)
        );
        Promise.race([syncPromise, syncTimeout])
          .catch(error => console.warn('Sync reset failed:', error));
        
        // Sign out with timeout
        const signOutPromise = SimpleAuthService.signOut();
        const signOutTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign out timeout')), 2000)
        );
        await Promise.race([signOutPromise, signOutTimeout]);
        
        console.log('✅ Logout cleanup completed');
      } catch (error) {
        console.warn('⚠️ Logout cleanup failed:', error);
      }
    }, 50);
  }, [dispatch, trackEvent, user?.id]);

  const handleBackToOnboarding = () => {
    setCurrentState('onboarding');
    trackEvent('auth_back_to_onboarding');
  };

  // No loading screen - we go straight to onboarding for instant startup

  // Render current screen based on state
  console.log('🖼️ Rendering screen:', currentState, 'User:', !!user, 'User level:', user?.level);
  
  switch (currentState) {
    case 'onboarding':
      console.log('📄 Rendering: Onboarding');
      return (
        <Onboarding
          onSignUp={handleSignUp}
          onSignIn={handleSignIn}
          onDemoUser={handleAuthComplete}
        />
      );

    case 'signup':
      console.log('📄 Rendering: Signup');
      return (
        <Auth
          mode="signup"
          onAuthComplete={handleAuthComplete}
          onBack={handleBackToOnboarding}
        />
      );

    case 'signin':
      console.log('📄 Rendering: Signin');
      return (
        <Auth
          mode="signin"
          onAuthComplete={handleAuthComplete}
          onBack={handleBackToOnboarding}
        />
      );

    case 'level-selection':
      console.log('📄 Rendering: Level Selection');
      return (
        <LevelSelection
          onLevelSelect={handleLevelSelection}
          onTakePlacementTest={() => setCurrentState('placement-test')}
          onBack={handleBackToOnboarding}
          user={user}
        />
      );

    case 'placement-test':
      console.log('📄 Rendering: AI Placement Test');
      if (!user) {
        console.log('⚠️ No user for placement test, redirecting to signin');
        setCurrentState('signin');
        return null;
      }
      return (
        <AIPlacementTest
          user={user}
          onComplete={handlePlacementTestComplete}
          onSkip={handlePlacementTestSkip}
          onBack={() => setCurrentState('level-selection')}
        />
      );

    case 'main-app':
      console.log('📄 Rendering: Main App');
      if (!user) {
        // Fallback to signin if user is somehow null
        console.log('⚠️ User is null in main-app, redirecting to signin');
        setCurrentState('signin');
        return (
          <Auth
            mode="signin"
            onAuthComplete={handleAuthComplete}
            onBack={handleBackToOnboarding}
          />
        );
      }
      return (
        <MainAppScreen
          user={user}
          onLogout={handleLogout}
          onStartPlacementTest={() => setCurrentState('placement-test')}
          onUserUpdate={(updatedUser) => {
            dispatch(appActions.setUser(updatedUser));
          }}
        />
      );

    default:
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-destructive">Unexpected app state</p>
            <button 
              onClick={() => setCurrentState('onboarding')}
              className="text-accent underline"
            >
              Return to start
            </button>
          </div>
        </div>
      );
  }
}

// Main App component with context provider and error boundary
export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}