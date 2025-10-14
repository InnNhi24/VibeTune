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

type AppState = 'loading' | 'onboarding' | 'signup' | 'signin' | 'level-selection' | 'placement-test' | 'main-app';

function AppContent() {
  const { state, dispatch } = useAppContext();
  const { trackEvent } = useAppStore();
  const [currentState, setCurrentState] = useState<AppState>('loading');
  const [isInitialized, setIsInitialized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { user } = state;

  // Simplified initialization - check auth once and set state accordingly
  useEffect(() => {
    if (isInitialized) {
      console.log("App already initialized, skipping.");
      return;
    }
    
    const initializeApp = async () => {
      console.log('🚀 Initializing VibeTune... Current state:', currentState, 'isInitialized:', isInitialized, 'authChecked:', authChecked);
      setIsInitialized(true);

      try {
        // Set offline status safely
        if (typeof navigator !== 'undefined') {
          dispatch(appActions.setOffline(!navigator.onLine));
        }

        // Check for existing session
        const sessionResult = await SimpleAuthService.getCurrentSession();
        
        if (sessionResult?.data?.user && sessionResult?.data?.profile) {
          console.log('✅ Found existing session with profile. User ID:', sessionResult.data.user.id);
          dispatch(appActions.setUser(sessionResult.data.profile));
          
          // Navigate based on user's level status
          if (!sessionResult.data.profile.level) {
            setCurrentState('level-selection');
          } else {
            setCurrentState('main-app');
          }
        } else {
          console.log('❌ No valid session found');
          setCurrentState('onboarding');
          console.log('➡️ Setting state to onboarding after no session.');
        }
      } catch (error) {
        console.warn('⚠️ Session check failed:', error);
        setCurrentState('onboarding');
        console.log('➡️ Setting state to onboarding after session check failed.');
      } finally {
        setAuthChecked(true);
        console.log('Auth check completed. authChecked set to true.');
      }
    };

    initializeApp();
  }, [dispatch, isInitialized, authChecked]); // Added authChecked to dependencies to ensure re-evaluation if it changes unexpectedly

  const handleSignUp = () => {
    console.log('📝 Navigating to signup');
    setCurrentState('signup');
    trackEvent('onboarding_signup_clicked');
  };

  const handleSignIn = () => {
    console.log('🔑 Navigating to signin');
    setCurrentState('signin');
    trackEvent('onboarding_signin_clicked');
  };

  const handleAuthComplete = useCallback((userData: Profile) => {
    console.log('🚀 Auth completed for user:', userData.id);
    
    // Set user in context immediately
    dispatch(appActions.setUser(userData));
    
    // Navigate based on user's level status
    if (!userData.level) {
      console.log('🎯 User has no level - navigating to level selection');
      setCurrentState('level-selection');
    } else {
      console.log('🎯 User has level - navigating to main app');
      setCurrentState('main-app');
    }
    
    // Background tasks
    setTimeout(() => {
      try {
        SyncManager.enableAutoSync().catch(error => 
          console.warn('⚠️ Sync setup failed:', error)
        );
        
        trackEvent('auth_completed', { 
          userId: userData.id, 
          level: userData.level,
          isNewUser: !userData.level 
        }).catch(error => 
          console.warn('Event tracking failed:', error)
        );
      } catch (error) {
        console.warn('Background tasks failed:', error);
      }
    }, 100);
  }, [dispatch, trackEvent]);

  const handlePlacementTestComplete = async (results: { level: string; score: number }) => {
    console.log('🎯 Placement test completed:', results);
    
    if (user) {
      try {
        // Update profile with placement test results
        const { data: updatedProfile } = await SimpleAuthService.updateProfile(user.id, { 
          level: results.level as Profile['level'],
          placement_test_completed: true,
          placement_test_score: results.score
        }, user);
        
        if (updatedProfile) {
          dispatch(appActions.setUser(updatedProfile));
        }
        
        // Track completion
        trackEvent('placement_test_completed', {
          userId: user.id,
          score: results.score,
          level: results.level,
          previousLevel: user.level,
          selectionMethod: 'placement_test'
        }).catch(error => console.warn('Tracking failed:', error));
        
      } catch (error) {
        console.error('❌ Failed to update profile after placement test:', error);
      }
    }
    
    // Navigate to main app
    setCurrentState('main-app');
  };

  const handlePlacementTestSkip = () => {
    console.log('⏭️ Placement test skipped');
    setCurrentState('main-app');
    trackEvent('placement_test_skipped', { userId: user?.id });
  };

  const handleLevelSelection = async (level: string) => {
    console.log('🎯 Level selected:', level);
    
    if (user) {
      try {
        // Update profile with selected level
        const { data: updatedProfile } = await SimpleAuthService.updateProfile(user.id, { 
          level: level as Profile['level'],
          placement_test_completed: false
        }, user);
        
        if (updatedProfile) {
          dispatch(appActions.setUser(updatedProfile));
        }
        
        // Track selection
        trackEvent('level_selected', { 
          userId: user.id, 
          level,
          previousLevel: user.level,
          selectionMethod: 'manual'
        }).catch(error => console.warn('Tracking failed:', error));
        
      } catch (error) {
        console.error('❌ Failed to update profile with selected level:', error);
      }
    }
    
    // Navigate to main app
    setCurrentState('main-app');
  };

  const handleStartLevelSelection = () => {
    console.log('🎯 Starting level selection');
    setCurrentState('level-selection');
    trackEvent('level_selection_started', { userId: user?.id });
  };

  const handleLogout = useCallback(async () => {
    console.log('🚪 Starting logout...');
    
    try {
      // Track logout
      trackEvent('user_logout_initiated', { userId: user?.id }).catch(error => 
        console.warn('Logout tracking failed:', error)
      );
      
      // Sign out from Supabase
      await SimpleAuthService.signOut();
      
      // Reset sync cache
      SyncManager.resetAuthCache().catch(error => 
        console.warn('Sync reset failed:', error)
      );
      
    } catch (error) {
      console.warn('⚠️ Logout cleanup failed:', error);
    } finally {
      // Clear local state and navigate to onboarding
      dispatch(appActions.setUser(null));
      setCurrentState('onboarding');
    }
  }, [dispatch, trackEvent, user?.id]);

  const handleBackToOnboarding = () => {
    console.log('🔙 Back to onboarding');
    setCurrentState('onboarding');
    trackEvent('auth_back_to_onboarding');
  };

  // Show loading screen while checking authentication
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading VibeTune...</p>
        </div>
      </div>
    );
  }

  // Render current screen based on state
  console.log('🖼️ Rendering screen:', currentState, 'User:', !!user, 'User level:', user?.level, 'authChecked:', authChecked);
  
  switch (currentState) {
    case 'onboarding':
      return (
        <Onboarding
          onSignUp={handleSignUp}
          onSignIn={handleSignIn}

        />
      );

    case 'signup':
      return (
        <Auth
          mode="signup"
          onAuthComplete={handleAuthComplete}
          onBack={handleBackToOnboarding}
        />
      );

    case 'signin':
      return (
        <Auth
          mode="signin"
          onAuthComplete={handleAuthComplete}
          onBack={handleBackToOnboarding}
        />
      );

    case 'level-selection':
      return (
        <LevelSelection
          onLevelSelect={handleLevelSelection}
          onTakePlacementTest={() => setCurrentState('placement-test')}
          onBack={handleBackToOnboarding}
          user={user}
        />
      );

    case 'placement-test':
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
      if (!user) {
        console.log('⚠️ User is null in main-app, redirecting to signin');
        setCurrentState('signin');
        return null;
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
            <p className="text-destructive">Unexpected app state: {currentState}</p>
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

