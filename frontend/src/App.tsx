import { useState, useEffect, useCallback } from "react";
import { Onboarding } from "./components/pages/Onboarding";
import { Auth } from "./components/pages/Auth";
import { MainAppScreen } from "./components/MainAppScreen";
import { AIPlacementTest } from "./components/AIPlacementTest";
import { LevelSelection } from "./components/LevelSelection";
import PersonalInfo from "./pages/PersonalInfo";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SimpleAuthService } from "./services/authServiceSimple";
import { Profile } from "./services/supabaseClient";
import { AppProvider, useAppContext, appActions } from "./contexts/AppContext";
import { useAppStore } from "./store/appStore";
import { SyncManager } from "./services/syncManager";
import { logger } from "./utils/logger";

type AppState =
  | "loading"
  | "onboarding"
  | "signup"
  | "signin"
  | "personal-info"
  | "level-selection"
  | "placement-test"
  | "main-app";

function AppContent() {
  const { state, dispatch } = useAppContext();
  const { trackEvent } = useAppStore();
  const [currentState, setCurrentState] = useState<AppState>("loading");
  const [isInitialized, setIsInitialized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { user } = state;

  const needsPersonalInfo = (p?: Partial<Profile> & { full_name?: string | null; dob?: string | null }) =>
    !p || !p.username || !p.full_name || !p.dob;

  useEffect(() => {
    if (isInitialized) return;
    setIsInitialized(true);

    const initializeApp = async () => {
      try {
        // Run migration for old conversation IDs
        try {
          const { migrateOldConversationIds } = await import('./utils/migrationHelper');
          migrateOldConversationIds();
        } catch (migrationError) {
          logger.warn('⚠️ Migration failed:', migrationError);
        }
        
        if (typeof navigator !== "undefined") {
          dispatch(appActions.setOffline(!navigator.onLine));
        }

        const sessionResult = await SimpleAuthService.getCurrentSession();

        if (sessionResult?.data?.user && sessionResult?.data?.profile) {
          const profile = sessionResult.data.profile;
          dispatch(appActions.setUser(profile));

          if (needsPersonalInfo(profile)) {
            setCurrentState("personal-info");
          } else if (!profile.level) {
            setCurrentState("level-selection");
          } else {
            setCurrentState("main-app");
          }
        } else {
          setCurrentState("onboarding");
        }
      } catch (err) {
        logger.warn("⚠️ Session check failed:", err);
        setCurrentState("onboarding");
      } finally {
        setAuthChecked(true);
      }
    };

    initializeApp();
  }, [dispatch, isInitialized]);

  const handleSignUp = () => {
    setCurrentState("signup");
    trackEvent("onboarding_signup_clicked");
  };

  const handleSignIn = () => {
    setCurrentState("signin");
    trackEvent("onboarding_signin_clicked");
  };

  const handleAuthComplete = useCallback(
    async (userData: Profile) => {
      dispatch(appActions.setUser(userData));
      if (needsPersonalInfo(userData)) {
        setCurrentState("personal-info");
      } else if (!userData.level) {
        setCurrentState("level-selection");
      } else {
        setCurrentState("main-app");
      }

      // background best-effort tasks
      setTimeout(async () => {
        try {
          try {
            await Promise.resolve(SyncManager.enableAutoSync());
          } catch (err: unknown) {
            logger.warn("⚠️ Sync setup failed:", err);
          }

          try {
            await Promise.resolve(
              trackEvent("auth_completed", {
                userId: userData.id,
                level: userData.level,
                isNewUser: !userData.level,
              })
            );
          } catch (err: unknown) {
            logger.warn("Event tracking failed:", err);
          }
        } catch (error) {
          logger.warn("Background tasks failed:", error);
        }
      }, 100);
    },
    [dispatch, trackEvent]
  );

  const handlePlacementTestComplete = useCallback(
    async (results: { level: string; score: number }) => {
      if (!user) {
        setCurrentState("signin");
        return;
      }

      try {
        const { data: updatedProfile } = await SimpleAuthService.updateProfile(
          user.id,
          {
            level: results.level as Profile["level"],
            placement_test_completed: true,
            placement_test_score: results.score,
          },
          user
        );

        if (updatedProfile) dispatch(appActions.setUser(updatedProfile));

        try {
          await Promise.resolve(
            trackEvent("placement_test_completed", {
              userId: user.id,
              score: results.score,
              level: results.level,
              previousLevel: user.level,
              selectionMethod: "placement_test",
            })
          );
        } catch (err: unknown) {
          logger.warn("Tracking failed:", err);
        }
      } catch (err) {
        logger.error("❌ Failed to update profile after placement test:", err);
      }

      setCurrentState("main-app");
    },
    [dispatch, trackEvent, user]
  );

  const handlePlacementTestSkip = () => {
    setCurrentState("main-app");
    trackEvent("placement_test_skipped", { userId: user?.id });
  };

  const handleLevelSelection = useCallback(
    async (level: string) => {
      if (!user) {
        setCurrentState("signin");
        return;
      }

      try {
        const { data: updatedProfile } = await SimpleAuthService.updateProfile(
          user.id,
          { level: level as Profile["level"], placement_test_completed: false },
          user
        );

        if (updatedProfile) dispatch(appActions.setUser(updatedProfile));

        try {
          await Promise.resolve(
            trackEvent("level_selected", {
              userId: user.id,
              level,
              previousLevel: user.level,
              selectionMethod: "manual",
            })
          );
        } catch (err: unknown) {
          logger.warn("Tracking failed:", err);
        }
      } catch (err) {
        logger.error("❌ Failed to update profile with selected level:", err);
      }

      setCurrentState("main-app");
    },
    [dispatch, trackEvent, user]
  );

  const handleStartLevelSelection = () => {
    setCurrentState("level-selection");
    trackEvent("level_selection_started", { userId: user?.id });
  };

  const handleLogout = useCallback(async () => {
    try {
      try {
        await Promise.resolve(trackEvent("user_logout_initiated", { userId: user?.id }));
      } catch (err: unknown) {
        logger.warn("Logout tracking failed:", err);
      }

      await SimpleAuthService.signOut();

      try {
        await Promise.resolve(SyncManager.resetAuthCache());
      } catch (err: unknown) {
        logger.warn("Sync reset failed:", err);
      }
    } catch (err) {
      logger.warn("⚠️ Logout cleanup failed:", err);
    } finally {
      dispatch(appActions.setUser(null));
      // Clear all user data to prevent data leakage between accounts
      const { clearUserData } = useAppStore.getState();
      clearUserData();
      setCurrentState("onboarding");
    }
  }, [dispatch, trackEvent, user?.id]);

  const handleBackToOnboarding = () => {
    setCurrentState("onboarding");
    trackEvent("auth_back_to_onboarding");
  };

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

  switch (currentState) {
    case "onboarding":
      return <Onboarding onSignUp={handleSignUp} onSignIn={handleSignIn} />;

    case "signup":
      return <Auth mode="signup" onAuthComplete={handleAuthComplete} onBack={handleBackToOnboarding} />;

    case "signin":
      return <Auth mode="signin" onAuthComplete={handleAuthComplete} onBack={handleBackToOnboarding} />;

    case "level-selection":
      return (
        <LevelSelection
          onLevelSelect={handleLevelSelection}
          onTakePlacementTest={() => setCurrentState("placement-test")}
          onBack={handleBackToOnboarding}
          user={user}
        />
      );

    case "personal-info":
      return (
        <PersonalInfo
          onDone={(updatedProfile) => {
            // update store if we received profile back
            if (updatedProfile) dispatch(appActions.setUser(updatedProfile));

            if (updatedProfile?.level) {
              setCurrentState("main-app");
            } else {
              setCurrentState("level-selection");
            }
          }}
          onBack={() => setCurrentState("onboarding")}
        />
      );

    case "placement-test":
      if (!user) {
        setCurrentState("signin");
        return null;
      }
      return <AIPlacementTest user={user} onComplete={handlePlacementTestComplete} onSkip={handlePlacementTestSkip} onBack={() => setCurrentState("level-selection")} />;

    case "main-app":
      if (!user) {
        setCurrentState("signin");
        return null;
      }
      return (
        <div className="h-screen overflow-hidden">
          <MainAppScreen
            user={user}
            onLogout={handleLogout}
            onStartPlacementTest={() => setCurrentState("placement-test")}
            onUserUpdate={(updatedUser) => dispatch(appActions.setUser(updatedUser))}
          />
        </div>
      );

    default:
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-destructive">Unexpected app state: {currentState}</p>
            <button onClick={() => setCurrentState("onboarding")} className="text-accent underline">
              Return to start
            </button>
          </div>
        </div>
      );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}


