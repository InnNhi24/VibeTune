/**
 * Test Setup Configuration for VibeTune Frontend
 */

import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from '@jest/globals';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createMediaStreamSource: jest.fn(),
  createAnalyser: jest.fn(),
  createGain: jest.fn(),
  createOscillator: jest.fn(),
  destination: {},
  state: 'running',
  close: jest.fn(),
  resume: jest.fn(),
}));

// Mock MediaRecorder
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  onerror: null,
}));

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{
        stop: jest.fn(),
        kind: 'audio',
        enabled: true
      }]
    }),
  },
});

// Setup before all tests
beforeAll(() => {
  // Suppress console warnings in tests
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Cleanup after all tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Test utilities
export const testUtils = {
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    level: 'Beginner' as const,
    placement_test_completed: false,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
    device_id: 'test-device-id'
  }),

  createMockMessage: (overrides = {}) => ({
    id: 'test-message-id',
    conversation_id: 'test-conversation-id',
    sender: 'user' as const,
    type: 'text' as const,
    content: 'Test message',
    created_at: new Date().toISOString(),
    retry_of_message_id: null,
    version: 1,
    device_id: 'test-device-id',
    ...overrides
  }),

  createMockConversation: (overrides = {}) => ({
    id: 'test-conversation-id',
    profile_id: 'test-user-id',
    topic: 'Test Topic',
    is_placement_test: false,
    started_at: new Date().toISOString(),
    ended_at: null,
    ...overrides
  }),

  mockFetch: (response: any, status = 200) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    });
  },

  mockFetchError: (error: string) => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(error));
  },

  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock data
export const mockData = {
  user: testUtils.createMockUser(),
  conversation: testUtils.createMockConversation(),
  message: testUtils.createMockMessage(),
  
  aiResponse: {
    replyText: "Hello! I'm your AI conversation partner.",
    turn_feedback: {
      grammar: [],
      vocab: [],
      prosody: {
        rate: 0.8,
        pitch: 0.7,
        energy: 0.9,
        notes: "Good pronunciation!"
      }
    },
    guidance: "Keep practicing!"
  },

  prosodyAnalysis: {
    overall_score: 85,
    pronunciation_score: 80,
    rhythm_score: 90,
    intonation_score: 85,
    fluency_score: 88,
    detailed_feedback: {
      strengths: ["Clear pronunciation", "Good rhythm"],
      improvements: ["Work on intonation"],
      specific_issues: []
    },
    suggestions: ["Practice with longer sentences"],
    next_focus_areas: ["intonation", "stress patterns"]
  }
};
