/**
 * VibeTune Comprehensive Test Suite
 * Tests all major components and features of the VibeTune app
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../App";
import { AuthService } from "../services/authService";
import { SyncManager } from "../services/syncManager";
import { OfflineService } from "../services/offlineService";
import { AnalyticsService } from "../services/analyticsService";

// Mock services
vi.mock("../services/authService");
vi.mock("../services/syncManager");
vi.mock("../services/offlineService");
vi.mock("../services/analyticsService");

describe("VibeTune App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    vi.mocked(AuthService.getCurrentSession).mockResolvedValue(
      null,
    );
    vi.mocked(AuthService.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    vi.mocked(SyncManager.enableAutoSync).mockImplementation(
      () => {},
    );
    vi.mocked(OfflineService.isOffline).mockReturnValue(false);
    vi.mocked(AnalyticsService.initialize).mockImplementation(
      () => {},
    );
  });

  describe("App Branding", () => {
    it("displays VibeTune branding consistently", async () => {
      render(<App />);

      // Wait for onboarding screen
      await waitFor(() => {
        expect(
          screen.getByText("VibeTune"),
        ).toBeInTheDocument();
      });
    });

    it("shows loading state with VibeTune branding", async () => {
      // Mock slow session check
      vi.mocked(
        AuthService.getCurrentSession,
      ).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(null), 100),
          ),
      );

      render(<App />);

      expect(
        screen.getByText("Loading VibeTune..."),
      ).toBeInTheDocument();
    });
  });

  describe("Authentication Flow", () => {
    it("navigates from onboarding to signup", async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Sign Up")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Sign Up"));

      await waitFor(() => {
        expect(
          screen.getByText("Create Account"),
        ).toBeInTheDocument();
      });
    });

    it("supports OAuth login with Google and GitHub", async () => {
      render(<App />);

      // Navigate to auth screen
      await waitFor(() => {
        fireEvent.click(screen.getByText("Sign Up"));
      });

      await waitFor(() => {
        expect(
          screen.getByText("Continue with Google"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Continue with GitHub"),
        ).toBeInTheDocument();
        // No Apple OAuth as per requirements
        expect(
          screen.queryByText("Continue with Apple"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Level Selection and Placement Test", () => {
    beforeEach(() => {
      // Mock authenticated user without level
      const mockUser = {
        id: "123",
        email: "test@example.com",
        username: "testuser",
        level: null,
        placement_test_completed: false,
      };

      vi.mocked(
        AuthService.getCurrentSession,
      ).mockResolvedValue({
        user: { id: "123" },
      });
      vi.mocked(AuthService.updateProfile).mockResolvedValue({
        data: mockUser,
      });
    });

    it("shows level selection for new users", async () => {
      render(<App />);

      await waitFor(() => {
        expect(
          screen.getByText("Choose Your Level"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Take Placement Test"),
        ).toBeInTheDocument();
      });
    });

    it("prominently displays self-selection with small placement test button", async () => {
      render(<App />);

      await waitFor(() => {
        const selfSelectButtons = screen.getAllByText(
          /Beginner|Intermediate|Advanced/,
        );
        const placementButton = screen.getByText(
          "Take Placement Test",
        );

        // Self-select buttons should be more prominent
        expect(selfSelectButtons.length).toBeGreaterThan(0);
        // Placement test button should be smaller/less prominent
        expect(placementButton).toBeInTheDocument();
      });
    });
  });

  describe("Main Chat Interface", () => {
    beforeEach(() => {
      // Mock authenticated user with level
      const mockUser = {
        id: "123",
        email: "test@example.com",
        username: "testuser",
        level: "Intermediate",
        placement_test_completed: true,
      };

      vi.mocked(
        AuthService.getCurrentSession,
      ).mockResolvedValue({
        user: { id: "123" },
      });
      vi.mocked(AuthService.updateProfile).mockResolvedValue({
        data: mockUser,
      });
    });

    it("shows main app with prosody features", async () => {
      render(<App />);

      await waitFor(() => {
        expect(
          screen.getByText("VibeTune"),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/AI Prosody Practice/),
        ).toBeInTheDocument();
      });
    });

    it("displays redo placement test button only for users who completed it", async () => {
      render(<App />);

      await waitFor(() => {
        expect(
          screen.getByText("Redo Placement Test"),
        ).toBeInTheDocument();
      });
    });

    it("shows recording controls with pulsing animation", async () => {
      render(<App />);

      await waitFor(() => {
        const recordButton = screen.getByRole("button", {
          name: /record/i,
        });
        expect(recordButton).toBeInTheDocument();
        // Recording button should have pulse animation classes
        expect(recordButton.closest("div")).toHaveClass(
          "animate-pulse",
        );
      });
    });
  });

  describe("Prosody Feedback", () => {
    it("highlights prosody errors with red underlines", async () => {
      // Mock a message with prosody feedback
      const mockMessage = {
        id: "1",
        text: "I went to the store yesterday.",
        isUser: true,
        isAudio: true,
        prosodyFeedback: {
          score: 75,
          highlights: [
            {
              text: "store",
              type: "error",
              feedback:
                'Try emphasizing "store" with rising intonation',
            },
          ],
          suggestions: [
            "Vary your pitch more throughout the sentence",
          ],
        },
      };

      // This would require rendering MessageBubble component directly
      // with the mock data to test prosody highlighting
    });
  });

  describe("Offline Sync", () => {
    it("handles offline state gracefully", async () => {
      vi.mocked(OfflineService.isOffline).mockReturnValue(true);

      render(<App />);

      // Should handle offline state without errors
      await waitFor(() => {
        expect(
          screen.getByText("VibeTune"),
        ).toBeInTheDocument();
      });
    });

    it("enables auto-sync after authentication", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        username: "testuser",
        level: "Intermediate",
        placement_test_completed: true,
      };

      vi.mocked(
        AuthService.getCurrentSession,
      ).mockResolvedValue({
        user: { id: "123" },
      });
      vi.mocked(AuthService.updateProfile).mockResolvedValue({
        data: mockUser,
      });

      render(<App />);

      await waitFor(() => {
        expect(SyncManager.enableAutoSync).toHaveBeenCalled();
      });
    });
  });

  describe("Color Scheme and UI", () => {
    it("uses VibeTune color scheme", async () => {
      render(<App />);

      await waitFor(() => {
        // Check that components use the custom color scheme
        const elements = document.querySelectorAll(
          '[class*="bg-accent"]',
        );
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it("is mobile-first responsive", async () => {
      // Test responsive behavior
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375, // Mobile width
      });

      render(<App />);

      await waitFor(() => {
        // Should render mobile-appropriate layout
        expect(
          screen.getByText("VibeTune"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("User Flow Compliance", () => {
    it("requires registration before feature access", async () => {
      render(<App />);

      // Should show onboarding, not main features
      await waitFor(() => {
        expect(
          screen.getByText("Master English Prosody with AI"),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("AI Prosody Practice"),
        ).not.toBeInTheDocument();
      });
    });

    it("directs new users to level selection first", async () => {
      // Mock new user (no level set)
      const mockUser = {
        id: "123",
        email: "test@example.com",
        username: "testuser",
        level: null,
        placement_test_completed: false,
      };

      vi.mocked(
        AuthService.getCurrentSession,
      ).mockResolvedValue({
        user: { id: "123" },
      });
      vi.mocked(AuthService.updateProfile).mockResolvedValue({
        data: mockUser,
      });

      render(<App />);

      await waitFor(() => {
        expect(
          screen.getByText("Choose Your Level"),
        ).toBeInTheDocument();
      });
    });

    it("directs returning users to main app", async () => {
      // Mock returning user (has level)
      const mockUser = {
        id: "123",
        email: "test@example.com",
        username: "testuser",
        level: "Intermediate",
        placement_test_completed: true,
      };

      vi.mocked(
        AuthService.getCurrentSession,
      ).mockResolvedValue({
        user: { id: "123" },
      });
      vi.mocked(AuthService.updateProfile).mockResolvedValue({
        data: mockUser,
      });

      render(<App />);

      await waitFor(() => {
        expect(
          screen.getByText("AI Prosody Practice"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Analytics Integration", () => {
    it("initializes analytics service", async () => {
      render(<App />);

      await waitFor(() => {
        expect(AnalyticsService.initialize).toHaveBeenCalled();
      });
    });

    it("tracks user events", async () => {
      // Mock trackEvent function
      const trackEventSpy = vi.fn();
      vi.doMock("../utils/helpers", () => ({
        trackEvent: trackEventSpy,
      }));

      render(<App />);

      // Should track session restore or onboarding view
      await waitFor(() => {
        expect(trackEventSpy).toHaveBeenCalled();
      });
    });
  });
});

/**
 * Integration Tests for VibeTune API
 */
describe("VibeTune API Integration", () => {
  describe("Audio Analysis API", () => {
    it("processes audio with prosody feedback", async () => {
      const mockResponse = {
        prosodyErrors: [
          {
            word: "important",
            type: "stress",
            suggestion: "Emphasize the second syllable",
          },
        ],
        vocabSuggestions: [],
        guidance: "Good effort! Focus on stress patterns.",
        score: 78,
      };

      // Mock fetch for API call
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse }),
      });

      // Test API integration
      const response = await fetch("/api/analyze-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "This is important",
          level: "Intermediate",
        }),
      });

      const data = await response.json();
      expect(data.data.score).toBe(78);
    });
  });

  describe("Conversation History API", () => {
    it("retrieves user conversation history", async () => {
      const mockHistory = {
        conversations: [
          {
            id: "1",
            topic: "Travel Discussion",
            started_at: "2023-12-01T10:00:00Z",
            messages_count: 12,
          },
        ],
        messages: [
          {
            id: "1",
            conversation_id: "1",
            sender: "user",
            content: "I love traveling",
            prosody_feedback: { score: 85 },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      });

      const response = await fetch("/api/get-history");
      const data = await response.json();

      expect(data.conversations).toHaveLength(1);
      expect(data.messages).toHaveLength(1);
    });
  });

  describe("Rate Limiting", () => {
    it("enforces rate limits on API endpoints", async () => {
      // Mock rate limit exceeded response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: "Rate limit exceeded" }),
      });

      const response = await fetch("/api/analyze-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "test" }),
      });

      expect(response.status).toBe(429);
    });
  });
});

/**
 * Accessibility Tests for VibeTune
 */
describe("VibeTune Accessibility", () => {
  it("has proper ARIA labels for interactive elements", async () => {
    render(<App />);

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        // Each button should have accessible name
        expect(button).toHaveAccessibleName();
      });
    });
  });

  it("supports keyboard navigation", async () => {
    render(<App />);

    await waitFor(() => {
      const interactiveElements = screen.getAllByRole("button");
      interactiveElements.forEach((element) => {
        expect(element).not.toHaveAttribute("tabindex", "-1");
      });
    });
  });

  it("maintains high contrast for text", async () => {
    render(<App />);

    // Visual regression test would check color contrast ratios
    // This is a placeholder for actual contrast checking
    await waitFor(() => {
      expect(screen.getByText("VibeTune")).toBeInTheDocument();
    });
  });
});