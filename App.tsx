import { useState, useEffect, useCallback, useRef } from "react";
import { Onboarding } from "./components/pages/Onboarding";
import { Auth } from "./components/pages/Auth";
import { MainAppScreen } from "./components/MainAppScreen";
import { PlacementTest } from "./components/PlacementTest";
import { LevelSelection } from "./components/LevelSelection";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthService } from "./services/authService";
import { Profile } from "./services/supabaseClient";
import { trackEvent } from "./utils/helpers";
import { AppProvider, useAppContext, appActions } from "./contexts/AppContext";
import { SyncManager } from "./services/syncManager";
import { OfflineService } from "./services/offlineService";
import { AnalyticsService } from "./services/analyticsService";

type AppState = 'loading' | 'onboarding' | 'signup' | 'signin' | 'level-selection' | 'placement-test' | 'main-app';

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [currentState, setCurrentState] = useState<AppState>('loading');
  const [initError, setInitError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { user } = state;
  const initTimeoutRef = useRef<NodeJS.Timeout>();
  const sessionCheckCompleted = useRef(false);
  const appInitStartTime = useRef(Date.now());

  // Optimized session check with timeout and error handling
  const checkExistingSession = useCallback(async () => {
    if (sessionCheckCompleted.current) return;
    
    try {
      // Set a timeout for the entire initialization process
      const timeoutPromise = new Promise((_, reject) => {
        initTimeoutRef.current = setTimeout(() => {
          reject(new Error('Session check timeout'));
        }, 10000); // 10 second timeout
      });

      const sessionPromise = (async () => {
        try {
          // Quick session check first
          const session = await Promise.race([
            AuthService.getCurrentSession(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Auth timeout')), 5000)
            )
          ]) as any;

          if (session?.user) {
            // Try to get existing profile first, create if doesn't exist
            let profile;
            try {
              const { data } = await Promise.race([
                AuthService.updateProfile(session.user.id, {}),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Profile timeout')), 3000)
                )
              ]) as any;
              profile = data;
            } catch (profileError) {
              console.warn('Profile fetch failed, using session data:', profileError);
              // Fallback to creating basic profile from session
              profile = {
                id: session.user.id,
                email: session.user.email || '',
                username: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                level: null,
                placement_test_completed: false
              };
            }

            if (profile) {
              dispatch(appActions.setUser(profile));
              
              // Enable sync after a short delay (non-blocking)
              setTimeout(() => {
                try {
                  console.log('Enabling auto-sync for authenticated user');
                  SyncManager.enableAutoSync();
                } catch (syncError) {
                  console.warn('Sync initialization failed:', syncError);
                }
              }, 1000);

              // Determine next state
              if (!profile.level) {
                setCurrentState('level-selection');
              } else {
                setCurrentState('main-app');
              }
              
              // Track event (non-blocking)
              setTimeout(() => {
                try {
                  trackEvent('session_restored', { userId: session.user.id });
                } catch (trackError) {
                  console.warn('Event tracking failed:', trackError);
                }
              }, 0);
              
              return;
            }
          }
          
          // No session or profile, go to onboarding
          setCurrentState('onboarding');
        } catch (error) {
          console.error('Session check failed:', error);
          setCurrentState('onboarding');
        }
      })();

      await Promise.race([sessionPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('Initialization failed:', error);
      setInitError(error instanceof Error ? error.message : 'Initialization failed');
      setCurrentState('onboarding'); // Fallback to onboarding
    } finally {
      sessionCheckCompleted.current = true;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    }
  }, [dispatch]);

  // Initialize app (run once)
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoadingProgress(10);
        
        // Set up global error handler
        const handleUnhandledError = (event: ErrorEvent) => {
          console.error('Unhandled error:', event.error);
          setInitError(`Unhandled error: ${event.error?.message || 'Unknown error'}`);
        };
        
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
          console.error('Unhandled promise rejection:', event.reason);
          setInitError(`Promise rejection: ${event.reason?.message || 'Unknown rejection'}`);
        };

        window.addEventListener('error', handleUnhandledError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        setLoadingProgress(20);

        // Set up offline detection immediately
        if (typeof window !== 'undefined') {
          const handleOnline = () => dispatch(appActions.setOffline(false));
          const handleOffline = () => dispatch(appActions.setOffline(true));
          
          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);
          
          // Set initial offline status
          dispatch(appActions.setOffline(!navigator.onLine));
          
          setLoadingProgress(40);
          
          // Initialize analytics (non-blocking, after delay)
          setTimeout(() => {
            try {
              AnalyticsService.initialize();
              setLoadingProgress(60);
            } catch (error) {
              console.warn('Analytics initialization failed:', error);
            }
          }, 500);

          // Check session after allowing initial render
          setTimeout(() => {
            setLoadingProgress(80);
            checkExistingSession();
          }, 200);
          
          // Cleanup function
          const cleanup = () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('error', handleUnhandledError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
          };
          
          // Force fallback to onboarding after maximum wait time
          setTimeout(() => {
            if (currentState === 'loading') {
              console.warn('App initialization took too long, falling back to onboarding');
              setCurrentState('onboarding');
              setLoadingProgress(100);
            }
          }, 15000); // 15 second maximum wait
          
          return cleanup;
        } else {
          // Non-browser environment fallback
          setCurrentState('onboarding');
          setLoadingProgress(100);
        }
        
      } catch (error) {
        console.error('App initialization failed:', error);
        setInitError('App initialization failed');
        setCurrentState('onboarding');
        setLoadingProgress(100);
      }
    };

    const cleanup = initApp();
    
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [dispatch, checkExistingSession, currentState]);

  // Optimized auth state change listener
  useEffect(() => {
    let subscription: any;
    
    try {
      const { data } = AuthService.onAuthStateChange(async (event, session) => {
        try {
          if (event === 'SIGNED_IN' && session?.user) {
            // Handle sign in with timeout
            const handleSignIn = async () => {
              try {
                const profilePromise = AuthService.updateProfile(session.user.id, {});
                const { data: profile } = await Promise.race([
                  profilePromise,
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Profile load timeout')), 5000)
                  )
                ]) as any;

                if (profile) {
                  dispatch(appActions.setUser(profile));
                  
                  // Enable sync (non-blocking)
                  setTimeout(() => {
                    try {
                      console.log('Enabling auto-sync for signed-in user');
                      SyncManager.enableAutoSync();
                    } catch (syncError) {
                      console.warn('Sync setup failed:', syncError);
                    }
                  }, 1000);

                  // Determine next state
                  if (!profile.level) {
                    setCurrentState('level-selection');
                  } else {
                    setCurrentState('main-app');
                  }

                  // Track event (non-blocking)
                  setTimeout(() => {
                    try {
                      trackEvent('user_signed_in', { userId: session.user.id });
                    } catch (trackError) {
                      console.warn('Event tracking failed:', trackError);
                    }
                  }, 0);
                } else {
                  console.warn('Failed to load profile, redirecting to level selection');
                  setCurrentState('level-selection');
                }
              } catch (error) {
                console.error('Sign in handling failed:', error);
                // Create basic profile from session as fallback
                const basicProfile = {
                  id: session.user.id,
                  email: session.user.email || '',
                  username: session.user.user_metadata?.name || 'User',
                  level: null,
                  placement_test_completed: false
                };
                dispatch(appActions.setUser(basicProfile));
                setCurrentState('level-selection');
              }
            };

            // Execute sign in handling
            handleSignIn();

          } else if (event === 'SIGNED_OUT') {
            try {
              dispatch(appActions.setUser(null));
              
              // Cleanup sync (non-blocking)
              setTimeout(() => {
                try {
                  if (typeof window !== 'undefined' && window.__vibeTuneSyncCleanup) {
                    console.log('Disabling auto-sync for signed-out user');
                    window.__vibeTuneSyncCleanup();
                  }
                  SyncManager.resetAuthCache();
                } catch (syncError) {
                  console.warn('Sync cleanup failed:', syncError);
                }
              }, 0);

              setCurrentState('onboarding');
              
              // Track event (non-blocking)
              setTimeout(() => {
                try {
                  trackEvent('user_signed_out');
                } catch (trackError) {
                  console.warn('Event tracking failed:', trackError);
                }
              }, 0);
              
            } catch (error) {
              console.error('Sign out handling failed:', error);
              setCurrentState('onboarding'); // Always go to onboarding on error
            }
          }
        } catch (error) {
          console.error('Auth state change handler failed:', error);
        }
      });
      
      subscription = data.subscription;
    } catch (error) {
      console.error('Failed to set up auth listener:', error);
    }

    return () => {
      try {
        subscription?.unsubscribe();
      } catch (error) {
        console.warn('Failed to unsubscribe from auth changes:', error);
      }
    };
  }, [dispatch]);

  const handleSignUp = () => {
    setCurrentState('signup');
    trackEvent('onboarding_signup_clicked');
  };

  const handleSignIn = () => {
    setCurrentState('signin');
    trackEvent('onboarding_signin_clicked');
  };

  const handleAuthComplete = (userData: Profile) => {
    dispatch(appActions.setUser(userData));
    // New users or users without a level must go through level selection
    if (!userData.level) {
      setCurrentState('level-selection');
    } else {
      setCurrentState('main-app');
    }
    trackEvent('auth_completed', { 
      userId: userData.id, 
      level: userData.level,
      isNewUser: !userData.level 
    });
  };

  const handlePlacementTestComplete = async (results: { level: string; score: number }) => {
    if (user) {
      try {
        const { data: updatedProfile } = await AuthService.updateProfile(user.id, { 
          level: results.level as Profile['level'],
          placement_test_completed: true,
          placement_test_score: results.score
        });
        if (updatedProfile) {
          dispatch(appActions.setUser(updatedProfile));
        }
        trackEvent('placement_test_completed', {
          userId: user.id,
          score: results.score,
          level: results.level,
          previousLevel: user.level
        });
      } catch (error) {
        console.error('Failed to update user after placement test:', error);
      }
    }
    setCurrentState('main-app');
  };

  const handlePlacementTestSkip = () => {
    setCurrentState('main-app');
    trackEvent('placement_test_skipped', { userId: user?.id });
  };

  const handleLevelSelection = async (level: string) => {
    if (user) {
      try {
        const { data: updatedProfile } = await AuthService.updateProfile(user.id, { level: level as Profile['level'] });
        if (updatedProfile) {
          dispatch(appActions.setUser(updatedProfile));
        }
        trackEvent('level_selected', { 
          userId: user.id, 
          level,
          previousLevel: user.level 
        });
      } catch (error) {
        console.error('Failed to update user level:', error);
      }
    }
    setCurrentState('main-app');
  };

  const handleStartLevelSelection = () => {
    setCurrentState('level-selection');
    trackEvent('level_selection_started', { userId: user?.id });
  };

  const handleLogout = async () => {
    try {
      trackEvent('user_logout_initiated', { userId: user?.id });
      // Reset sync authentication cache before signing out
      SyncManager.resetAuthCache();
      await AuthService.signOut();
      dispatch(appActions.setUser(null));
      setCurrentState('onboarding');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleBackToOnboarding = () => {
    setCurrentState('onboarding');
    trackEvent('auth_back_to_onboarding');
  };

  // Render loading state with progress and timeout handling
  if (currentState === 'loading') {
    const loadingTime = Date.now() - appInitStartTime.current;
    const isSlowLoading = loadingTime > 5000; // Show additional info after 5 seconds

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 max-w-sm mx-auto">
          {/* VibeTune Logo */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">VibeTune</h1>
          </div>

          {/* Loading Spinner */}
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
          
          {/* Loading Text */}
          <div>
            <p className="text-muted-foreground">Loading VibeTune...</p>
            {isSlowLoading && (
              <p className="text-xs text-muted-foreground mt-2">
                This is taking longer than usual...
              </p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-accent h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(loadingProgress, 10)}%` }}
            />
          </div>

          {/* Error State */}
          {initError && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-left">
              <p className="text-sm text-destructive font-medium mb-2">Initialization Error:</p>
              <p className="text-xs text-muted-foreground mb-3">{initError}</p>
              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setInitError(null);
                    setCurrentState('onboarding');
                    setLoadingProgress(100);
                  }}
                  className="w-full px-3 py-2 bg-accent text-accent-foreground rounded text-sm hover:bg-accent/90 transition-colors"
                >
                  Continue to App
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full px-3 py-2 border border-border rounded text-sm hover:bg-muted transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          )}

          {/* Slow Loading Help */}
          {isSlowLoading && !initError && (
            <div className="text-xs text-muted-foreground space-y-2">
              <p>Taking longer than expected?</p>
              <button 
                onClick={() => {
                  setCurrentState('onboarding');
                  setLoadingProgress(100);
                }}
                className="text-accent hover:text-accent/80 underline"
              >
                Skip to app
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render current screen based on state
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
        />
      );

    case 'placement-test':
      return (
        <PlacementTest
          onComplete={handlePlacementTestComplete}
          onSkip={handlePlacementTestSkip}
          onBack={() => setCurrentState('level-selection')}
        />
      );

    case 'main-app':
      if (!user) {
        // Fallback to signin if user is somehow null
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