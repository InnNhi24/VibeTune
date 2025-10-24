import { supabase } from './supabaseClient';
import { OfflineService } from './offlineService';
import { AudioAnalysisService } from './apiAnalyzeAudio';
import logger from '../utils/logger';

// Extend window interface for cleanup function
declare global {
  interface Window {
    __vibeTuneSyncCleanup?: () => void;
  }
}

interface SyncResult {
  success: boolean;
  syncedMessages: number;
  syncedConversations: number;
  errors: string[];
}

export class SyncManager {
  private static syncInProgress = false;
  private static autoSyncEnabled = false;
  private static syncListeners: Array<(status: 'syncing' | 'synced' | 'error') => void> = [];
  private static lastAuthCheck = 0;
  private static isAuthenticated = false;

  // Add sync status listener
  static addSyncListener(callback: (status: 'syncing' | 'synced' | 'error') => void) {
    this.syncListeners.push(callback);
  }

  // Remove sync status listener
  static removeSyncListener(callback: (status: 'syncing' | 'synced' | 'error') => void) {
    this.syncListeners = this.syncListeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of sync status change
  private static notifyListeners(status: 'syncing' | 'synced' | 'error') {
    this.syncListeners.forEach(listener => listener(status));
  }

  // Main sync function with timeout protection
  static async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        syncedMessages: 0,
        syncedConversations: 0,
        errors: ['Sync already in progress']
      };
    }

    this.syncInProgress = true;
    this.notifyListeners('syncing');

    // Add overall sync timeout
    const syncTimeout = new Promise<SyncResult>((_, reject) => 
      setTimeout(() => reject(new Error('Sync operation timed out')), 10000)
    );

    try {
      return await Promise.race([this._performSync(), syncTimeout]);
    } catch (error) {
      this.syncInProgress = false;
      this.notifyListeners('error');
      logger.error('Sync failed:', error?.message || error);
      return {
        success: false,
        syncedMessages: 0,
        syncedConversations: 0,
        errors: [error?.message || 'Sync failed']
      };
    }
  }

  // Internal sync implementation
  private static async _performSync(): Promise<SyncResult> {

    const result: SyncResult = {
      success: false,
      syncedMessages: 0,
      syncedConversations: 0,
      errors: []
    };

    try {
      // Check if online
      if (OfflineService.isOffline()) {
        this.syncInProgress = false;
        this.notifyListeners('synced'); // Don't mark as error for offline
        return {
          success: true,
          syncedMessages: 0,
          syncedConversations: 0,
          errors: ['Device is offline - sync will resume when online']
        };
      }

      // Check authentication with caching to avoid repeated calls
      const authResult = await this.checkAuthentication();
      if (!authResult.isAuthenticated) {
        this.syncInProgress = false;
        this.notifyListeners('synced'); // Don't mark as error for missing auth
        logger.info('Skipping server updates download:', authResult.reason);
        return {
          success: true,
          syncedMessages: 0,
          syncedConversations: 0,
          errors: [authResult.reason || 'No authenticated user - sync skipped']
        };
      }

      // Get unsynced items
      const { messages, conversations } = OfflineService.getUnsyncedItems();

      // Sync conversations first
      for (const conversation of conversations) {
        try {
          await this.syncConversation(conversation);
          result.syncedConversations++;
        } catch (error) {
          logger.error('Failed to sync conversation:', error);
          result.errors.push(`Failed to sync conversation ${conversation.id}: ${error}`);
        }
      }

      // Sync messages
      for (const message of messages) {
        try {
          await this.syncMessage(message);
          result.syncedMessages++;
        } catch (error) {
          logger.error('Failed to sync message:', error);
          result.errors.push(`Failed to sync message ${message.id}: ${error}`);
        }
      }

      // Download new data from server
      await this.downloadServerUpdates();

      // Update last sync timestamp
      OfflineService.updateLastSync();

      result.success = result.errors.length === 0;
      this.notifyListeners(result.success ? 'synced' : 'error');

      // Clean up old synced items
      OfflineService.clearSyncedItems();

    } catch (error) {
      logger.error('Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sync failed: ${errorMessage}`);
      
      // Only mark as error for actual sync failures, not auth issues
      if (!errorMessage.includes('not authenticated') && !errorMessage.includes('offline')) {
        this.notifyListeners('error');
      } else {
        this.notifyListeners('synced');
      }
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  // Sync individual conversation
  private static async syncConversation(conversation: any) {
    try {
      // Check if conversation already exists on server
      const { data: existing } = await supabase
        .from('conversations')
        .select('id, device_id')
        .eq('id', conversation.id)
        .single();

      if (existing) {
        // Handle conflict resolution
        await this.resolveConversationConflict(conversation, existing);
      } else {
        // Insert new conversation
        const { error } = await supabase
          .from('conversations')
          .insert([{
            id: conversation.id,
            profile_id: conversation.profile_id,
            topic: conversation.topic,
            is_placement_test: conversation.is_placement_test,
            started_at: conversation.started_at,
            ended_at: conversation.ended_at,
            device_id: conversation.device_id
          }]);

        if (error) throw error;
      }

      // Mark as synced
      OfflineService.markAsSynced('conversation', conversation.id);
    } catch (error) {
      logger.error('Failed to sync conversation:', error);
      throw error;
    }
  }

  // Sync individual message
  private static async syncMessage(message: any) {
    try {
      // Check if message already exists on server
      const { data: existing } = await supabase
        .from('messages')
        .select('id, device_id, version')
        .eq('id', message.id)
        .single();

      if (existing) {
        // Handle conflict resolution
        await this.resolveMessageConflict(message, existing);
      } else {
        // Process audio if needed (get prosody feedback)
        let prosodyFeedback = null;
        if (message.type === 'audio' && message.sender === 'user') {
          try {
            const { data: analysis } = await AudioAnalysisService.analyzeAudio({
              text: message.content,
              level: 'Intermediate' // Would get from user profile
            });
            prosodyFeedback = analysis;
          } catch (error) {
            logger.warn('Failed to analyze audio during sync:', error);
          }
        }

        // Insert new message
        const { error } = await supabase
          .from('messages')
          .insert([{
            id: message.id,
            conversation_id: message.conversation_id,
            sender: message.sender,
            type: message.type,
            content: message.content,
            audio_url: message.audio_url,
            prosody_feedback: prosodyFeedback,
            created_at: message.created_at,
            device_id: message.device_id,
            version: 1
          }]);

        if (error) throw error;
      }

      // Mark as synced
      OfflineService.markAsSynced('message', message.id);
    } catch (error) {
      logger.error('Failed to sync message:', error);
      throw error;
    }
  }

  // Resolve conversation conflicts (latest wins)
  private static async resolveConversationConflict(localConversation: any, serverConversation: any) {
    const localTimestamp = new Date(localConversation.started_at).getTime();
    const serverTimestamp = new Date(serverConversation.started_at).getTime();

    // If local is newer or from same device, update server
    if (localTimestamp > serverTimestamp || localConversation.device_id === serverConversation.device_id) {
      const { error } = await supabase
        .from('conversations')
        .update({
          topic: localConversation.topic,
          ended_at: localConversation.ended_at,
          device_id: localConversation.device_id
        })
        .eq('id', localConversation.id);

      if (error) throw error;
    }
    // Otherwise, server version wins (no action needed)
  }

  // Resolve message conflicts (append new feedback, don't overwrite)
  private static async resolveMessageConflict(localMessage: any, serverMessage: any) {
    // For messages, we generally append new AI feedback rather than overwrite
    if (localMessage.sender === 'ai' && localMessage.prosody_feedback) {
      const { error } = await supabase
        .from('messages')
        .update({
          prosody_feedback: localMessage.prosody_feedback,
          version: (serverMessage.version || 1) + 1,
          device_id: localMessage.device_id
        })
        .eq('id', localMessage.id);

      if (error) throw error;
    }
  }

  // Download updates from server
  private static async downloadServerUpdates() {
    try {
      // Use our robust auth check
      const authResult = await this.checkAuthentication();
      if (!authResult.isAuthenticated) {
        logger.info('Skipping server updates download:', authResult.reason);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        logger.info('No session available for server updates');
        return;
      }

      const lastSync = OfflineService.getLastSync();
      const lastSyncDate = new Date(lastSync).toISOString();

      // Download new conversations
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('profile_id', session.user.id)
        .gt('started_at', lastSyncDate)
        .order('started_at', { ascending: false });

      // Download new messages
      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .gt('created_at', lastSyncDate)
          .order('created_at', { ascending: true });

        // Store downloaded data offline for quick access
        if (messages) {
          messages.forEach(message => {
            // Store in offline cache without overwriting local changes
            const offlineMessage = {
              ...message,
              synced: true
            };
            // This would merge with existing offline data
          });
        }
      }
    } catch (error) {
      logger.error('Failed to download server updates:', error);
      throw error;
    }
  }

  // Auto-sync with timeout protection - returns Promise for timeout handling
  static enableAutoSync() {
    return new Promise<void>((resolve, reject) => {
      if (this.autoSyncEnabled || typeof window === 'undefined') {
        logger.info('✅ Auto-sync already enabled');
        resolve();
        return;
      }

      try {
  this.autoSyncEnabled = true;
  logger.info('🔄 Auto-sync enabled');

        // Simple online handler with error protection
        const handleOnline = () => {
          logger.info('📡 Online - will sync soon');
          setTimeout(() => {
            this.sync().catch(error => {
              logger.warn('⚠️ Auto-sync failed:', error?.message || error);
            });
          }, 3000); // Longer delay to avoid timeout issues
        };

        window.addEventListener('online', handleOnline);

        // Periodic sync when online and authenticated
        const syncInterval = setInterval(async () => {
          if (!OfflineService.isOffline() && !this.syncInProgress) {
            try {
              // Check authentication with timeout before attempting sync
              const authPromise = this.checkAuthentication();
              const authTimeout = new Promise((_, timeoutReject) => 
                setTimeout(() => timeoutReject(new Error('Auth check timeout')), 2000)
              );
              
              const authResult = await Promise.race([authPromise, authTimeout]);
              if (authResult.isAuthenticated) {
                logger.info('Starting periodic sync');
                this.sync().catch(error => {
                  logger.warn('⚠️ Periodic sync failed:', error?.message || error);
                });
              } else {
                logger.info('Periodic sync skipped:', authResult.reason);
              }
            } catch (authError) {
              logger.warn('⚠️ Auth check failed for periodic sync:', authError?.message || authError);
            }
          }
        }, 5 * 60 * 1000); // Every 5 minutes

        // Store references for potential cleanup
        if (!window.__vibeTuneSyncCleanup) {
          window.__vibeTuneSyncCleanup = () => {
            logger.info('Cleaning up auto-sync');
            window.removeEventListener('online', handleOnline);
            clearInterval(syncInterval);
            this.autoSyncEnabled = false;
            this.resetAuthCache();
          };
        }
        
        // Resolve immediately - setup is complete
        resolve();
      } catch (error) {
        logger.warn('⚠️ Auto-sync setup failed:', error);
        reject(error);
      }
    });
  }

  // Force sync (for manual sync button)
  static async forceSync(): Promise<SyncResult> {
    return this.sync();
  }

  // Get sync status
  static isSyncing(): boolean {
    return this.syncInProgress;
  }

  // Get pending sync count
  static getPendingSyncCount(): number {
    const { messages, conversations } = OfflineService.getUnsyncedItems();
    return messages.length + conversations.length;
  }

  // Robust authentication check with caching
  private static async checkAuthentication(): Promise<{ isAuthenticated: boolean; reason?: string }> {
    const now = Date.now();
    
    // Use cached result if recent (within 30 seconds)
    if (now - this.lastAuthCheck < 30000 && this.isAuthenticated) {
      return { isAuthenticated: true };
    }

    try {
      // Clear any stale session first
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.warn('Auth check failed:', error.message);
        this.isAuthenticated = false;
        this.lastAuthCheck = now;
        return { isAuthenticated: false, reason: `Authentication error: ${error.message}` };
      }

      if (!session?.user) {
        this.isAuthenticated = false;
        this.lastAuthCheck = now;
        return { isAuthenticated: false, reason: 'No active session' };
      }

      // Verify the session is still valid by checking expiry
      if (session.expires_at && new Date(session.expires_at * 1000) <= new Date()) {
        logger.info('Session expired');
        this.isAuthenticated = false;
        this.lastAuthCheck = now;
        return { isAuthenticated: false, reason: 'Session expired' };
      }

      // Additional check: try to refresh if close to expiry
      if (session.expires_at && new Date(session.expires_at * 1000).getTime() - now < 5 * 60 * 1000) {
  logger.info('Session close to expiry, attempting refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          logger.warn('Session refresh failed:', refreshError.message);
          this.isAuthenticated = false;
          this.lastAuthCheck = now;
          return { isAuthenticated: false, reason: `Session refresh failed: ${refreshError.message}` };
        }

        if (!refreshData.session?.user) {
          this.isAuthenticated = false;
          this.lastAuthCheck = now;
          return { isAuthenticated: false, reason: 'Session refresh returned no user' };
        }
      }

      this.isAuthenticated = true;
      this.lastAuthCheck = now;
      return { isAuthenticated: true };

    } catch (error) {
      logger.error('Auth check exception:', error);
      this.isAuthenticated = false;
      this.lastAuthCheck = now;
      return { isAuthenticated: false, reason: `Auth check failed: ${error}` };
    }
  }

  // Reset authentication cache (call when user signs out)
  static resetAuthCache() {
    this.isAuthenticated = false;
    this.lastAuthCheck = 0;
  }
}