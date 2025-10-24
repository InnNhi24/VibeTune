/**
 * Test Setup Configuration for VibeTune Frontend
 */

import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from '@jest/globals';

// Typed IntersectionObserver mock
class IO implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect() {}
  observe(_: Element) {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  unobserve(_: Element) {}
}
(global as any).IntersectionObserver = IO as unknown as typeof IntersectionObserver;

// Typed ResizeObserver mock (simple shim)
class RO {
  disconnect() {}
  observe(_: Element) {}
  unobserve(_: Element) {}
}
(global as any).ResizeObserver = RO;

// matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
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

// localStorage/sessionStorage shim
const storage = () => {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; }
  };
};
(global as any).localStorage  = storage() as unknown as Storage;
(global as any).sessionStorage = storage() as unknown as Storage;

// fetch mock
(global as any).fetch = jest.fn();

// navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// AudioContext shim
(global as any).AudioContext = jest.fn().mockImplementation(() => ({
  createMediaStreamSource: jest.fn(),
  createAnalyser: jest.fn(),
  createGain: jest.fn(),
  createOscillator: jest.fn(),
  destination: {},
  state: 'running',
  close: jest.fn(),
  resume: jest.fn(),
}));

// Typed MediaRecorder shim
// MediaRecorder mock (implements EventTarget so addEventListener/dispatchEvent exist)
class MR extends EventTarget implements MediaRecorder {
  readonly mimeType: string = 'audio/webm';
  ignoreMutedMedia = false;
  audioBitsPerSecond = 0;
  videoBitsPerSecond = 0;
  state: RecordingState = 'inactive';
  stream!: MediaStream;

  ondataavailable: ((this: MediaRecorder, ev: BlobEvent) => any) | null = null;
  onerror: ((this: MediaRecorder, ev: Event) => any) | null = null;
  onpause: ((this: MediaRecorder, ev: Event) => any) | null = null;
  onresume: ((this: MediaRecorder, ev: Event) => any) | null = null;
  onstart: ((this: MediaRecorder, ev: Event) => any) | null = null;
  onstop: ((this: MediaRecorder, ev: Event) => any) | null = null;

  start() {
    this.state = 'recording';
    const ev = new Event('start');
    this.onstart?.(ev);
    this.dispatchEvent(ev);
  }
  stop() {
    this.state = 'inactive';
    const ev = new Event('stop');
    this.onstop?.(ev);
    this.dispatchEvent(ev);
  }
  pause() { const ev = new Event('pause'); this.state = 'paused'; this.onpause?.(ev); this.dispatchEvent(ev); }
  resume(){ const ev = new Event('resume'); this.state = 'recording'; this.onresume?.(ev); this.dispatchEvent(ev); }
  requestData() {
    const blobEv = new BlobEvent('dataavailable', { data: new Blob() });
    this.ondataavailable?.(blobEv);
    this.dispatchEvent(blobEv);
  }

  static isTypeSupported(_: string) { return true; }
}
(global as any).MediaRecorder = MR as unknown as typeof MediaRecorder;

// getUserMedia shim
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn(), kind: 'audio', enabled: true }]
    }),
  },
});

// Setup before all tests
beforeAll(() => {
  // Suppress specific console warnings in tests
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning: ReactDOM.render is no longer supported')) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  (global.localStorage as unknown as { clear?: () => void }).clear?.();
  (global.sessionStorage as unknown as { clear?: () => void }).clear?.();
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
