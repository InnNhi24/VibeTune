/**
 * Test Setup Configuration for VibeTune Backend
 */

import { config } from 'dotenv';
import { beforeAll, afterAll, beforeEach } from '@jest/globals';

// Load test environment variables
config({ path: '.env.test' });

// Mock external services
jest.mock('../clients/openai', () => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              replyText: "Test AI response",
              turn_feedback: {
                grammar: [],
                vocab: [],
                prosody: { rate: 0.8, pitch: 0.7, energy: 0.9, notes: "Good!" }
              },
              guidance: "Keep practicing!"
            })
          }
        }]
      })
    }
  }
}));

jest.mock('../clients/deepgram', () => ({
  listen: {
    prerecorded: {
      transcribeUrl: jest.fn().mockResolvedValue({
        result: {
          results: {
            channels: [{
              alternatives: [{
                transcript: "Test transcription"
              }]
            }]
          }
        },
        error: null
      })
    }
  }
}));

jest.mock('../clients/supabase', () => ({
  supabaseServiceRole: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockResolvedValue({ error: null }),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    }))
  }
}));

// Test database setup
beforeAll(async () => {
  // Setup test database if needed
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup test database
  console.log('Cleaning up test environment...');
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

// Test utilities
export const testUtils = {
  createMockRequest: (body: any = {}, params: any = {}, query: any = {}) => ({
    body,
    params,
    query,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'test-agent'
    },
    ip: '127.0.0.1'
  }),

  createMockResponse: () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    return res;
  },

  createMockNext: () => jest.fn()
};

// Test data
export const testData = {
  validUser: {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    level: 'Beginner'
  },

  validConversation: {
    id: 'test-conversation-id',
    profile_id: 'test-user-id',
    topic: 'Test Topic',
    is_placement_test: false
  },

  validMessage: {
    conversationId: 'test-conversation-id',
    profileId: 'test-user-id',
    text: 'Hello, this is a test message',
    deviceId: 'test-device-id'
  },

  validAudioMessage: {
    conversationId: 'test-conversation-id',
    profileId: 'test-user-id',
    audioUrl: 'https://example.com/audio.mp3',
    deviceId: 'test-device-id'
  }
};
