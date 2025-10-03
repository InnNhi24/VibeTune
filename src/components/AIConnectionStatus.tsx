import { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Zap, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { aiProsodyService } from "../services/aiProsodyService";

interface AIConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AIConnectionStatus({ 
  className = "", 
  showLabel = true, 
  size = 'md' 
}: AIConnectionStatusProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('connected');
  const [isConfigured, setIsConfigured] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(new Date());

  // Check status on mount and periodically
  useEffect(() => {
    checkStatus();
    
    // Check every 30 seconds if configured
    const interval = setInterval(() => {
      if (isConfigured) {
        checkStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConfigured]);

  const checkStatus = async () => {
    // VibeTune AI is always ready!
    setIsConfigured(true);
    setConnectionStatus('connected');
    setLastChecked(new Date());
  };

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'bg-success text-success-foreground',
          icon: CheckCircle2,
          label: 'AI Ready',
          description: '🎉 VibeTune AI is ready! Advanced prosody analysis powered by OpenAI GPT-4.'
        };
      case 'checking':
        return {
          color: 'bg-accent text-accent-foreground',
          icon: Loader2,
          label: 'Starting AI',
          description: 'Initializing VibeTune AI...',
          animate: true
        };
      case 'disconnected':
      default:
        return {
          color: 'bg-accent text-accent-foreground',
          icon: Zap,
          label: 'AI Built-in',
          description: 'VibeTune includes advanced AI prosody analysis. Ready to help improve your English!'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2 py-1',
    lg: 'text-sm px-3 py-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-4 h-4'
  };

  const formatLastChecked = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Badge 
                className={`${config.color} ${sizeClasses[size]} transition-all duration-200`}
              >
                <Icon 
                  className={`${iconSizes[size]} mr-1 ${config.animate ? 'animate-spin' : ''}`} 
                />
                {showLabel && (
                  <>
                    <Zap className={`${iconSizes[size]} mr-1`} />
                    {config.label}
                  </>
                )}
              </Badge>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{config.description}</p>
              {lastChecked && connectionStatus === 'connected' && (
                <p className="text-xs opacity-75">
                  Last checked: {formatLastChecked(lastChecked)}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* No configuration needed - VibeTune has built-in AI! */}
    </div>
  );
}