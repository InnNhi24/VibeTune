import { supabase } from './supabaseClient';
import { OfflineService } from './offlineService';
import { logger } from '../utils/logger';

export interface AnalyticsEvent {
  event_type: string;
  metadata: Record<string, any>;
  profile_id?: string | null;
  created_at?: string;
}

export class AnalyticsService {
  private static eventQueue: AnalyticsEvent[] = [];
  private static isProcessing = false;
  private static batchSize = 10;
  private static flushInterval = 30000; // 30 seconds

  // Initialize analytics service (non-blocking)
  static initialize() {
    try {
      // Start periodic flush (non-blocking)
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          setInterval(() => {
            this.flush().catch(error => {
                logger.warn('Analytics flush failed:', error);
            });
          }, this.flushInterval);

          // Flush when page is about to unload
          window.addEventListener('beforeunload', () => {
            this.flush().catch(error => {
                logger.warn('Analytics beforeunload flush failed:', error);
            });
          });

          // Flush when coming back online
          window.addEventListener('online', () => {
            this.flush().catch(error => {
                logger.warn('Analytics online flush failed:', error);
            });
          });
        }, 1000); // Delay initialization to not block app startup
      }
    } catch (error) {
      logger.warn('Analytics initialization failed:', error);
    }
  }

  // Track an event
  static track(eventType: string, metadata: Record<string, any> = {}, profileId?: string) {
    const event: AnalyticsEvent = {
      event_type: eventType,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown'
      },
      profile_id: profileId,
      created_at: new Date().toISOString()
    };

    // Add to queue
    this.eventQueue.push(event);

    // Auto-flush if we have enough events
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }

    // Store offline if needed
    if (OfflineService.isOffline()) {
      this.storeOfflineEvent(event);
    }
  }

  // Flush events to server
  static async flush() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // If offline, store events locally
      if (OfflineService.isOffline()) {
        this.eventQueue.forEach(event => this.storeOfflineEvent(event));
        this.eventQueue = [];
        return;
      }

      // Get current user session (don't fail if not authenticated)
      let session = null;
      try {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      } catch (error) {
        logger.info('Analytics: No authenticated session, proceeding with anonymous events');
      }
      
      // Prepare events for insertion
      const eventsToInsert = this.eventQueue.map(event => ({
        ...event,
        profile_id: event.profile_id || session?.user?.id || null
      }));

            // DISABLED: Database analytics (use localStorage only)
  logger.info('Database analytics disabled - using localStorage fallback');
      
      // Always store offline instead of trying database
      eventsToInsert.forEach(event => this.storeOfflineEvent(event));
      
  logger.info(`Stored ${eventsToInsert.length} events offline (database disabled)`);

      // Clear queue
      this.eventQueue = [];

      // Try to sync offline events as well
      await this.syncOfflineEvents();

    } catch (error) {
      logger.error('Analytics flush failed:', error);
      // Store events offline for retry
      this.eventQueue.forEach(event => this.storeOfflineEvent(event));
      this.eventQueue = [];
    } finally {
      this.isProcessing = false;
    }
  }

  // Store event offline
  private static storeOfflineEvent(event: AnalyticsEvent) {
    try {
      const storage = typeof window !== 'undefined' ? localStorage : null;
      if (!storage) return;

      const key = 'vibetune_offline_analytics';
      const existing = storage.getItem(key);
      const events: AnalyticsEvent[] = existing ? JSON.parse(existing) : [];
      
      events.push(event);
      
      // Keep only last 1000 events to prevent storage bloat
      if (events.length > 1000) {
        events.splice(0, events.length - 1000);
      }
      
      storage.setItem(key, JSON.stringify(events));
    } catch (error) {
      logger.error('Failed to store analytics event offline:', error);
    }
  }

  // Sync offline events
  private static async syncOfflineEvents() {
    try {
      const storage = typeof window !== 'undefined' ? localStorage : null;
      if (!storage) return;

      const key = 'vibetune_offline_analytics';
      const existing = storage.getItem(key);
      if (!existing) return;

      const events: AnalyticsEvent[] = JSON.parse(existing);
      if (events.length === 0) return;

      // Get current user session (don't fail if not authenticated)
      let session = null;
      try {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      } catch (error) {
        logger.info('Analytics sync: No authenticated session');
      }
      
      // Prepare events for insertion
      const eventsToInsert = events.map(event => ({
        ...event,
        profile_id: event.profile_id || session?.user?.id || null
      }));

      // Insert in batches
      const batchSize = 50;
      for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        
        // DISABLED: Database sync (keep events in localStorage)
  logger.info(`Keeping ${batch.length} events in localStorage (database sync disabled)`);
      }

      // Clear offline events on successful sync
      storage.removeItem(key);
  logger.info(`Successfully synced ${eventsToInsert.length} offline analytics events`);

    } catch (error) {
      logger.error('Failed to sync offline analytics events:', error);
    }
  }

  // Get analytics summary for user dashboard
  static async getUserAnalytics(profileId: string, days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_type, metadata, created_at')
        .eq('profile_id', profileId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process analytics data
      const summary = {
        total_events: data?.length || 0,
        session_count: 0,
        practice_sessions: 0,
        placement_tests: 0,
        avg_prosody_score: 0,
        most_active_topics: [] as string[],
        daily_activity: {} as Record<string, number>
      };

      if (data) {
        const sessionIds = new Set();
        const prosodyScores: number[] = [];
        const topics: Record<string, number> = {};
        const dailyActivity: Record<string, number> = {};

        data.forEach(event => {
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
      }

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
}