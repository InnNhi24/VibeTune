import { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Cloud, CloudOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, useSync } from "../store/appStore";

interface SyncStatusIndicatorProps {
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function SyncStatusIndicator({
  compact = false,
  showLabel = true,
  className = ""
}: SyncStatusIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const sync = useSync();
  const syncData = useAppStore((state) => state.syncData);
  
  const { online, syncing, lastSync, hasOfflineChanges } = sync;

  const getStatusInfo = () => {
    if (!online) {
      return {
        icon: CloudOff,
        text: "Offline",
        color: "destructive",
        description: "Working offline. Changes will sync when connected.",
        bgColor: "bg-destructive/10",
        textColor: "text-destructive"
      };
    }

    if (syncing) {
      return {
        icon: RefreshCw,
        text: "Syncing...",
        color: "default",
        description: "Syncing your data with VibeTune cloud.",
        bgColor: "bg-accent/10",
        textColor: "text-accent"
      };
    }

    if (hasOfflineChanges) {
      return {
        icon: AlertCircle,
        text: "Pending",
        color: "secondary",
        description: "You have changes waiting to sync.",
        bgColor: "bg-secondary/10",
        textColor: "text-secondary-foreground"
      };
    }

    return {
      icon: Cloud,
      text: "Synced",
      color: "success",
      description: lastSync 
        ? `Last synced ${lastSync.toLocaleTimeString()}` 
        : "All changes are saved to VibeTune cloud.",
      bgColor: "bg-success/10",
      textColor: "text-success-foreground"
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  // Auto-hide details after 5 seconds
  useEffect(() => {
    if (showDetails) {
      const timer = setTimeout(() => setShowDetails(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showDetails]);

  if (compact) {
    return (
      <motion.div 
        className={`flex items-center gap-1 ${className}`}
        whileHover={{ scale: 1.05 }}
        title={status.description}
      >
        <div className={`p-1.5 rounded-full ${status.bgColor}`}>
          <StatusIcon 
            className={`w-3 h-3 ${status.textColor} ${syncing ? 'animate-spin' : ''}`} 
          />
        </div>
        {showLabel && (
          <span className="text-xs font-medium">
            {status.text}
          </span>
        )}
      </motion.div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Badge
          variant={status.color as any}
          className="cursor-pointer flex items-center gap-2 text-xs px-3 py-1.5 transition-all duration-200 hover:shadow-md"
          onClick={() => setShowDetails(!showDetails)}
        >
          <StatusIcon 
            className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} 
          />
          {showLabel && status.text}
        </Badge>
      </motion.div>

      <AnimatePresence>
        {showDetails && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowDetails(false)}
            />
            
            {/* Details panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 p-4 bg-card border border-border rounded-lg shadow-xl z-50 min-w-72 max-w-sm"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${status.bgColor}`}>
                    <StatusIcon className={`w-4 h-4 ${status.textColor} ${syncing ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <span className="font-medium text-sm">{status.text}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      VibeTune Cloud Sync
                    </p>
                  </div>
                </div>
                
                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {status.description}
                </p>

                {/* Sync details */}
                <div className="space-y-2 pt-2 border-t border-border">
                  {lastSync && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Last sync:</span>
                      <span className="font-medium">{lastSync.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`font-medium ${status.textColor}`}>
                      {online ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  
                  {hasOfflineChanges && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Pending changes:</span>
                      <span className="font-medium text-secondary-foreground">Yes</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {hasOfflineChanges && online && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        syncData();
                        setShowDetails(false);
                      }}
                      disabled={syncing}
                      className="flex-1"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                      Sync Now
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDetails(false)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}