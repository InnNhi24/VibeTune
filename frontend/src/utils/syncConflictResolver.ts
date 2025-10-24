import logger from './logger';

interface ConflictResolutionStrategy {
  name: string;
  description: string;
  resolve: (localData: any, serverData: any) => any;
}

interface SyncConflict {
  id: string;
  type: 'message' | 'conversation' | 'profile';
  localData: any;
  serverData: any;
  timestamp: string;
  resolved: boolean;
  resolution?: any;
}

export class SyncConflictResolver {
  private static conflicts: SyncConflict[] = [];

  // Conflict resolution strategies
  private static strategies: { [key: string]: ConflictResolutionStrategy } = {
    serverWins: {
      name: 'Server Wins',
      description: 'Server data takes precedence',
      resolve: (localData, serverData) => serverData
    },
    
    clientWins: {
      name: 'Client Wins', 
      description: 'Local data takes precedence',
      resolve: (localData, serverData) => localData
    },
    
    timestampWins: {
      name: 'Latest Timestamp Wins',
      description: 'Most recently modified data takes precedence',
      resolve: (localData, serverData) => {
        const localTime = new Date(localData.updated_at || localData.created_at).getTime();
        const serverTime = new Date(serverData.updated_at || serverData.created_at).getTime();
        return localTime > serverTime ? localData : serverData;
      }
    },
    
    merge: {
      name: 'Intelligent Merge',
      description: 'Merge non-conflicting fields, use timestamps for conflicts',
      resolve: (localData, serverData) => {
        const merged = { ...serverData }; // Start with server data
        
        // Merge specific fields based on data type
        if (localData.type === 'message') {
          // For messages, prefer local prosody feedback if more recent
          if (localData.prosody_feedback && 
              (!serverData.prosody_feedback || 
               new Date(localData.updated_at || localData.created_at) > 
               new Date(serverData.updated_at || serverData.created_at))) {
            merged.prosody_feedback = localData.prosody_feedback;
          }
        } else if (localData.type === 'profile') {
          // For profiles, merge settings and preferences
          merged.settings = { ...serverData.settings, ...localData.settings };
          merged.preferences = { ...serverData.preferences, ...localData.preferences };
        }
        
        return merged;
      }
    }
  };

  // Detect conflicts between local and server data
  static detectConflicts(localItems: any[], serverItems: any[], type: string): SyncConflict[] {
    const conflicts: SyncConflict[] = [];

    localItems.forEach(localItem => {
      const serverItem = serverItems.find(si => si.id === localItem.id);
      
      if (serverItem) {
        const localTime = new Date(localItem.updated_at || localItem.created_at).getTime();
        const serverTime = new Date(serverItem.updated_at || serverItem.created_at).getTime();
        
        // Check if there's a meaningful difference (beyond small timestamp variations)
        const hasConflict = Math.abs(localTime - serverTime) > 5000 && // More than 5 seconds apart
                           JSON.stringify(localItem) !== JSON.stringify(serverItem);
        
        if (hasConflict) {
          conflicts.push({
            id: `${type}_${localItem.id}_${Date.now()}`,
            type: type as 'message' | 'conversation' | 'profile',
            localData: localItem,
            serverData: serverItem,
            timestamp: new Date().toISOString(),
            resolved: false
          });
        }
      }
    });

    this.conflicts.push(...conflicts);
    return conflicts;
  }

  // Resolve conflicts using specified strategy
  static resolveConflicts(
    conflicts: SyncConflict[], 
    strategy: string = 'timestampWins'
  ): { resolved: any[]; errors: string[] } {
    const resolved: any[] = [];
    const errors: string[] = [];

    const resolverStrategy = this.strategies[strategy];
    if (!resolverStrategy) {
      errors.push(`Unknown resolution strategy: ${strategy}`);
      return { resolved, errors };
    }

    conflicts.forEach(conflict => {
      try {
        const resolution = resolverStrategy.resolve(conflict.localData, conflict.serverData);
        
        // Mark conflict as resolved
        conflict.resolved = true;
        conflict.resolution = resolution;
        
        resolved.push(resolution);
        
        logger.info(`Resolved conflict ${conflict.id} using ${strategy}:`, {
          local: conflict.localData,
          server: conflict.serverData,
          resolution
        });
        
      } catch (error) {
        errors.push(`Failed to resolve conflict ${conflict.id}: ${error}`);
        logger.error('Conflict resolution error:', error);
      }
    });

    return { resolved, errors };
  }

  // Auto-resolve conflicts based on data type and conflict severity
  static autoResolveConflicts(conflicts: SyncConflict[]): { resolved: any[]; errors: string[] } {
    const resolved: any[] = [];
    const errors: string[] = [];

    conflicts.forEach(conflict => {
      let strategy = 'timestampWins'; // Default strategy

      try {
        // Choose strategy based on conflict type and characteristics
        if (conflict.type === 'message') {
          // For messages, prefer server data for core content, but merge prosody feedback
          if (this.isOnlyProsodyFeedbackDifferent(conflict.localData, conflict.serverData)) {
            strategy = 'merge';
          } else {
            strategy = 'serverWins';
          }
        } else if (conflict.type === 'conversation') {
          // For conversations, prefer latest timestamp
          strategy = 'timestampWins';
        } else if (conflict.type === 'profile') {
          // For profiles, merge user preferences but keep server auth data
          strategy = 'merge';
        }

        const resolverStrategy = this.strategies[strategy];
        const resolution = resolverStrategy.resolve(conflict.localData, conflict.serverData);
        
        conflict.resolved = true;
        conflict.resolution = resolution;
        resolved.push(resolution);
        
      } catch (error) {
        errors.push(`Auto-resolution failed for conflict ${conflict.id}: ${error}`);
        logger.error('Auto-resolution error for conflict:', conflict.id, error);
      }
    });

    return { resolved, errors };
  }

  // Check if only prosody feedback differs between messages
  private static isOnlyProsodyFeedbackDifferent(local: any, server: any): boolean {
    const localCopy = { ...local };
    const serverCopy = { ...server };
    
    // Remove prosody feedback for comparison
    delete localCopy.prosody_feedback;
    delete localCopy.vocab_suggestions;
    delete localCopy.guidance;
    delete serverCopy.prosody_feedback;
    delete serverCopy.vocab_suggestions;
    delete serverCopy.guidance;
    
    return JSON.stringify(localCopy) === JSON.stringify(serverCopy);
  }

  // Get all unresolved conflicts
  static getUnresolvedConflicts(): SyncConflict[] {
    return this.conflicts.filter(c => !c.resolved);
  }

  // Get conflict statistics
  static getConflictStats(): {
    total: number;
    resolved: number;
    unresolved: number;
    byType: { [key: string]: number };
  } {
    const stats = {
      total: this.conflicts.length,
      resolved: this.conflicts.filter(c => c.resolved).length,
      unresolved: this.conflicts.filter(c => !c.resolved).length,
      byType: {} as { [key: string]: number }
    };

    this.conflicts.forEach(conflict => {
      stats.byType[conflict.type] = (stats.byType[conflict.type] || 0) + 1;
    });

    return stats;
  }

  // Clear resolved conflicts older than specified days
  static cleanupResolvedConflicts(daysOld: number = 7): void {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    this.conflicts = this.conflicts.filter(conflict => 
      !conflict.resolved || new Date(conflict.timestamp) > cutoffDate
    );
  }

  // Manual conflict resolution for user intervention
  static manualResolve(conflictId: string, userChoice: 'local' | 'server' | 'custom', customData?: any): boolean {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) return false;

    try {
      let resolution;
      
      switch (userChoice) {
        case 'local':
          resolution = conflict.localData;
          break;
        case 'server':
          resolution = conflict.serverData;
          break;
        case 'custom':
          if (!customData) throw new Error('Custom data required for custom resolution');
          resolution = customData;
          break;
        default:
          throw new Error('Invalid user choice');
      }

      conflict.resolved = true;
      conflict.resolution = resolution;
      
      return true;
    } catch (error) {
      logger.error('Manual conflict resolution failed:', error);
      return false;
    }
  }

  // Export conflicts for debugging/analysis
  static exportConflicts(): string {
    return JSON.stringify({
      conflicts: this.conflicts,
      stats: this.getConflictStats(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}