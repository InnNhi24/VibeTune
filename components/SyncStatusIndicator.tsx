import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Cloud, CloudOff, RefreshCw, Wifi, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { SyncManager } from '../services/syncManager';
import { OfflineService } from '../services/offlineService';
import { useAppContext } from '../contexts/AppContext';
import { motion } from 'motion/react';

export function SyncStatusIndicator() {
  const { state } = useAppContext();
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Don't show sync indicator if user is not authenticated
  if (!state.user) {
    return null;
  }

  useEffect(() => {
    // Set up sync status listener
    const handleSyncStatus = (status: 'syncing' | 'synced' | 'error') => {
      setSyncStatus(status);
      setIsSyncing(status === 'syncing');
    };

    SyncManager.addSyncListener(handleSyncStatus);

    // Update pending count periodically
    const updatePendingCount = () => {
      setPendingCount(SyncManager.getPendingSyncCount());
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000); // Every 5 seconds

    return () => {
      SyncManager.removeSyncListener(handleSyncStatus);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      await SyncManager.forceSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (state.isOffline) {
      return <WifiOff className="w-4 h-4 text-destructive" />;
    }

    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-accent animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'synced':
        return pendingCount > 0 
          ? <Cloud className="w-4 h-4 text-muted-foreground" />
          : <CheckCircle2 className="w-4 h-4 text-success" />;
      default:
        return <Cloud className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (state.isOffline) {
      return pendingCount > 0 ? `Offline (${pendingCount} pending)` : 'Offline';
    }

    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync Error';
      case 'synced':
        return pendingCount > 0 ? `${pendingCount} pending` : 'Synced';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (state.isOffline) return 'destructive';
    
    switch (syncStatus) {
      case 'syncing':
        return 'default';
      case 'error':
        return 'destructive';
      case 'synced':
        return pendingCount > 0 ? 'secondary' : 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ 
                scale: syncStatus === 'syncing' ? [1, 1.1, 1] : 1,
                opacity: state.isOffline ? 0.7 : 1
              }}
              transition={{ 
                duration: 1.5, 
                repeat: syncStatus === 'syncing' ? Infinity : 0 
              }}
            >
              <Badge 
                variant={getStatusColor()}
                className="flex items-center gap-1 text-xs cursor-pointer hover:opacity-80"
                onClick={!state.isOffline && !isSyncing ? handleManualSync : undefined}
              >
                {getStatusIcon()}
                {getStatusText()}
              </Badge>
            </motion.div>

            {/* Manual sync button when offline or has pending items */}
            {(!state.isOffline && (pendingCount > 0 || syncStatus === 'error')) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="h-6 px-2 text-xs"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  'Sync'
                )}
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2">
            <p className="font-medium">
              {state.isOffline ? 'Offline Mode' : 'Sync Status'}
            </p>
            {state.isOffline ? (
              <div className="text-sm space-y-1">
                <p>You're currently offline.</p>
                {pendingCount > 0 && (
                  <p>{pendingCount} items will sync when you're back online.</p>
                )}
              </div>
            ) : (
              <div className="text-sm space-y-1">
                {syncStatus === 'synced' && pendingCount === 0 && (
                  <p>All data is synchronized.</p>
                )}
                {syncStatus === 'synced' && pendingCount > 0 && (
                  <p>{pendingCount} items waiting to sync.</p>
                )}
                {syncStatus === 'syncing' && (
                  <p>Synchronizing your data...</p>
                )}
                {syncStatus === 'error' && (
                  <p>Sync failed. Click to retry.</p>
                )}
                <p className="text-muted-foreground">
                  Click to sync manually
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}