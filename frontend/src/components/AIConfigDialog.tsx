import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Settings, Key, Zap, AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { aiProsodyService } from "../services/aiProsodyService";

interface AIConfigDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function AIConfigDialog({ open, onOpenChange, trigger }: AIConfigDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Load existing configuration
    const loadConfig = () => {
      try {
        const configured = aiProsodyService.isReady();
        setIsConfigured(configured);
        
        if (configured) {
          // Check if auto-configured via environment variables
          const envApiKey = import.meta.env?.VITE_OPENAI_API_KEY || process.env?.OPENAI_API_KEY;
          if (envApiKey) {
            setApiKey('***AUTO-CONFIGURED***');
            setBaseUrl('https://api.openai.com/v1');
            setTestResult({ success: true });
            return;
          }
        }
        
        // Load from localStorage if not auto-configured
        const stored = localStorage.getItem('vibetune_ai_config');
        if (stored) {
          const config = JSON.parse(stored);
          setApiKey(config.apiKey || '');
          setBaseUrl(config.baseUrl || '');
        }
      } catch (error) {
        console.error('Failed to load AI config:', error);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const success = aiProsodyService.configure(apiKey, baseUrl);
      if (success) {
        setIsConfigured(true);
        setTestResult({ success: true });
        // Test connection after configuration
        await handleTestConnection();
      } else {
        setTestResult({ success: false, error: 'Failed to save configuration' });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Configuration failed' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await aiProsodyService.testConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Test failed' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    setApiKey("");
    setBaseUrl("");
    setTestResult(null);
    setIsConfigured(false);
    localStorage.removeItem('vibetune_ai_config');
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Settings className="w-4 h-4 mr-2" />
      AI Settings
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            AI Configuration
          </DialogTitle>
          <DialogDescription>
            Configure your AI service for advanced prosody analysis and conversation practice.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="setup" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            {/* Configuration Status */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={isConfigured ? "default" : "secondary"} className={
                isConfigured ? "bg-success text-success-foreground" : ""
              }>
                {isConfigured ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {apiKey === '***AUTO-CONFIGURED***' ? 'Auto-Configured' : 'Configured'}
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Setup Required
                  </>
                )}
              </Badge>
            </div>

            {/* Auto-configuration notice */}
            {isConfigured && apiKey === '***AUTO-CONFIGURED***' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Alert className="border-success/20 bg-success/10">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success-foreground">
                    🎉 AI is ready! Using your OpenAI API key automatically. No manual setup needed.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {/* Configuration Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  AI Service API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Service URL</Label>
                <Input
                  id="baseUrl"
                  type="url"
                  placeholder="https://api.example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Test Results */}
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Alert className={testResult.success ? 
                  "border-success/20 bg-success/10" : 
                  "border-destructive/20 bg-destructive/10"
                }>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <AlertDescription className={testResult.success ? "text-success-foreground" : "text-destructive-foreground"}>
                    {testResult.success ? 
                      "Connection successful! AI service is ready." : 
                      `Connection failed: ${testResult.error}`
                    }
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={handleSave}
                disabled={!apiKey || !baseUrl || isLoading}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Config
              </Button>
              
              <Button 
                onClick={handleTestConnection}
                disabled={!isConfigured || isTesting}
                variant="outline"
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Test
              </Button>
              
              <Button 
                onClick={handleClear}
                variant="ghost"
                size="sm"
              >
                Clear
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="help" className="space-y-4">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Setup Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Get an API key from your AI service provider</li>
                  <li>Enter the service URL (API endpoint)</li>
                  <li>Save and test the connection</li>
                  <li>Start practicing with AI-powered feedback!</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Supported Features:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Real-time pronunciation analysis</li>
                  <li>Rhythm and intonation feedback</li>
                  <li>Adaptive conversation difficulty</li>
                  <li>Personalized learning suggestions</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Recommended Services:</h4>
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="w-full justify-start h-auto p-2">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">OpenAI GPT-4</div>
                      <div className="text-xs text-muted-foreground">Advanced language processing</div>
                    </div>
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-auto p-2">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Custom AI Service</div>
                      <div className="text-xs text-muted-foreground">Your own prosody analysis API</div>
                    </div>
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-primary-foreground">
                  <strong>Note:</strong> Your API key is stored locally and never shared with VibeTune servers.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}