import logger from '../utils/logger';
import { supabase } from './supabaseClient';

// Analytics service with localStorage + database sync
export interface AnalyticsEvent {
  event_type: string;
  metadata: Record<string, any>;
  profile_id?: string;
  created_at: string;
  timestamp: number;
}

export class SimpleAnalyticsService {
  private static readonly STORAGE_KEY = 'vibetune_analytics_simple';
  private static readonly MAX_EVENTS = 1000;
  private static syncInterval: NodeJS.Timeout | null = null;

  // Initialize analytics service (localStorage + database sync)
  static initialize() {
    try {
      logger.info('✅ Analytics ready (localStorage + database sync)');
      
      // Delayed cleanup and sync to avoid blocking startup
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            this.cleanupOldEvents();
            this.syncToDatabase(); // Initial sync
          } catch (e) {
            logger.warn('Cleanup/sync failed:', e);
          }
        }, 10000);

        // Periodic sync every 5 minutes
        this.syncInterval = setInterval(() => {
          this.syncToDatabase().catch(e => logger.warn('Periodic sync failed:', e));
        }, 5 * 60 * 1000);
      }
    } catch (error) {
      logger.warn('⚠️ Analytics init failed (non-critical):', error);
    }
  }

  // Track an event (localStorage only)
  static track(eventType: string, metadata: Record<string, any> = {}, profileId?: string) {
    try {
      const event: AnalyticsEvent = {
        event_type: eventType,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'unknown'
        },
        profile_id: profileId,
        created_at: new Date().toISOString(),
        timestamp: Date.now()
      };

  this.storeEvent(event);
  logger.info(`Analytics tracked: ${eventType}`, metadata);
    } catch (error) {
      logger.warn('Failed to track analytics event:', error);
    }
  }

  // Store event in localStorage
  private static storeEvent(event: AnalyticsEvent) {
    try {
      if (typeof window === 'undefined' || !localStorage) {
        return;
      }

      const existing = localStorage.getItem(this.STORAGE_KEY);
      const events: AnalyticsEvent[] = existing ? JSON.parse(existing) : [];
      
      events.push(event);
      
      // Keep only last N events to prevent storage bloat
      if (events.length > this.MAX_EVENTS) {
        events.splice(0, events.length - this.MAX_EVENTS);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));

      // Try immediate database insert (non-blocking)
      this.insertToDatabase(event).catch(e => 
        logger.warn('Immediate DB insert failed (will retry in batch):', e)
      );
    } catch (error) {
      logger.warn('Failed to store analytics event:', error);
    }
  }

  // Insert single event to database
  private static async insertToDatabase(event: AnalyticsEvent) {
    try {
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          event_type: event.event_type,
          metadata: event.metadata,
          profile_id: event.profile_id || null,
          created_at: event.created_at
        });

      if (error) throw error;
    } catch (error) {
      // Silently fail - will be retried in batch sync
      throw error;
    }
  }

  // Sync all localStorage events to database
  private static async syncToDatabase() {
    try {
      const events = this.getStoredEvents();
      if (events.length === 0) return;

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      
      // Prepare events for insertion
      const eventsToInsert = events.map(event => ({
        event_type: event.event_type,
        metadata: event.metadata,
        profile_id: event.profile_id || session?.user?.id || null,
        created_at: event.created_at
      }));

      // Insert in batches of 50
      const batchSize = 50;
      let successCount = 0;

      for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('analytics_events')
          .insert(batch);

        if (!error) {
          successCount += batch.length;
        } else {
          logger.warn(`Failed to sync batch ${i / batchSize + 1}:`, error);
        }
      }

      if (successCount > 0) {
        logger.info(`✅ Synced ${successCount} analytics events to database`);
      }
    } catch (error) {
      logger.warn('Failed to sync analytics to database:', error);
    }
  }

  // Get stored events
  static getStoredEvents(): AnalyticsEvent[] {
    try {
      if (typeof window === 'undefined' || !localStorage) {
        return [];
      }

      const existing = localStorage.getItem(this.STORAGE_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
      logger.warn('Failed to get stored analytics events:', error);
      return [];
    }
  }

  // Clean up old events (keep only last 30 days)
  private static cleanupOldEvents() {
    try {
      if (typeof window === 'undefined' || !localStorage) {
        return;
      }

      const events = this.getStoredEvents();
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const recentEvents = events.filter(event => event.timestamp > thirtyDaysAgo);
      
      if (recentEvents.length !== events.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentEvents));
        logger.info(`Cleaned up ${events.length - recentEvents.length} old analytics events`);
      }
    } catch (error) {
      logger.warn('Failed to cleanup old analytics events:', error);
    }
  }

  // Get analytics summary for user dashboard
  static getUserAnalytics(profileId: string, days: number = 7) {
    try {
      const events = this.getStoredEvents();
      const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      // Filter events for this user and time period
      const userEvents = events.filter(event => 
        event.profile_id === profileId && event.timestamp > startTime
      );

      // Process analytics data
      const summary = {
        total_events: userEvents.length,
        session_count: 0,
        practice_sessions: 0,
        placement_tests: 0,
        avg_prosody_score: 0,
        most_active_topics: [] as string[],
        daily_activity: {} as Record<string, number>
      };

      const sessionIds = new Set();
      const prosodyScores: number[] = [];
      const topics: Record<string, number> = {};
      const dailyActivity: Record<string, number> = {};

      userEvents.forEach(event => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        dailyActivity[date] = (dailyActivity[date] || 0) + 1;

        if (event.metadata?.sessionId) {
          sessionIds.add(event.metadata.sessionId);
        }

        if (event.event_type === 'practice_session_completed') {
          summary.practice_sessions++;
        }

        if (event.event_type === 'placement_test_completed') {
          summary.placement_tests++;
        }

        if (event.metadata?.prosodyScore) {
          prosodyScores.push(event.metadata.prosodyScore);
        }

        if (event.metadata?.topic) {
          topics[event.metadata.topic] = (topics[event.metadata.topic] || 0) + 1;
        }
      });

      summary.session_count = sessionIds.size;
      summary.avg_prosody_score = prosodyScores.length > 0 
        ? Math.round(prosodyScores.reduce((a, b) => a + b, 0) / prosodyScores.length)
        : 0;
      summary.most_active_topics = Object.entries(topics)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic);
      summary.daily_activity = dailyActivity;

      return { data: summary, error: null };
    } catch (error) {
      logger.error('Failed to get user analytics:', error);
      return { data: null, error };
    }
  }

  // Common event tracking methods
  static trackPageView(page: string, metadata: Record<string, any> = {}) {
    this.track('page_view', { page, ...metadata });
  }

  static trackUserAction(action: string, metadata: Record<string, any> = {}) {
    this.track('user_action', { action, ...metadata });
  }

  static trackPracticeSession(sessionData: {
    topic: string;
    duration: number;
    messageCount: number;
    prosodyScore?: number;
  }) {
    this.track('practice_session_completed', sessionData);
  }

  static trackPlacementTest(testData: {
    score: number;
    level: string;
    duration: number;
    questionsAnswered: number;
  }) {
    this.track('placement_test_completed', testData);
  }

  static trackError(error: string, context: Record<string, any> = {}) {
    this.track('error', { error, ...context });
  }

  static trackPerformance(metric: string, value: number, metadata: Record<string, any> = {}) {
    this.track('performance_metric', { metric, value, ...metadata });
  }

  // Clear all stored events (for debugging/privacy)
  static clearAllEvents() {
    try {
      if (typeof window !== 'undefined' && localStorage) {
        localStorage.removeItem(this.STORAGE_KEY);
        logger.info('All analytics events cleared');
      }
    } catch (error) {
      logger.warn('Failed to clear analytics events:', error);
    }
  }

  // Export events for debugging
  static exportEvents() {
    try {
      const events = this.getStoredEvents();
      logger.info('Analytics Events Export:', events);
      return events;
    } catch (error) {
      logger.warn('Failed to export analytics events:', error);
      return [];
    }
  }
}

// Export as default for easy replacement
export { SimpleAnalyticsService as AnalyticsService };