import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Alert, AlertDescription } from "./ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { 
  User, 
  Mail, 
  GraduationCap, 
  Clock, 
  Bell, 
  Volume2, 
  Palette, 
  Shield, 
  Trash2,
  Edit3,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Settings as SettingsIcon,
  ArrowLeft,
  Zap,
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { Profile } from "../services/supabaseClient";
import { SimpleAuthService } from "../services/authServiceSimple";
import { logger } from '../utils/logger';

interface SettingsProps {
  user: Profile;
  onUserUpdate: (updatedUser: Profile) => void;
  onBack?: () => void;
  onStartPlacementTest?: () => void;
}

export function Settings({ user, onUserUpdate, onBack, onStartPlacementTest }: SettingsProps) {
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState(user.username);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Settings state
  const [settings, setSettings] = useState({
    notifications: true,
    soundEffects: true,
    autoSync: true,
    darkMode: false,
    prosodyFeedback: true,
    voiceRecording: true
  });

  const handleUsernameUpdate = async () => {
    if (!editedUsername.trim() || editedUsername === user.username) {
      setIsEditingUsername(false);
      setEditedUsername(user.username);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: updatedProfile, error: updateError } = await SimpleAuthService.updateProfile(
        user.id,
        { username: editedUsername.trim() },
        user
      );

      if (updateError) {
        throw updateError;
      }

      if (updatedProfile) {
        onUserUpdate(updatedProfile);
        setSuccess('Username updated successfully!');
        setIsEditingUsername(false);
      }
    } catch (err: any) {
      logger.error('Username update error:', err);
      setError(err.message || 'Failed to update username');
      setEditedUsername(user.username); // Reset to original
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // In a real app, you'd save this to the backend
  logger.info(`Setting ${key} changed to:`, value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLevelBadgeColor = (level: string | null) => {
    switch (level) {
      case 'Beginner':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Intermediate':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Advanced':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlacementTestStatus = () => {
    if (user.placement_test_completed) {
      return {
        text: "Completed",
        color: "text-success",
        icon: CheckCircle2,
        action: "Retake Test",
        actionIcon: TrendingUp
      };
    } else {
      return {
        text: "Not taken",
        color: "text-muted-foreground",
        icon: AlertCircle,
        action: "Take Test",
        actionIcon: Zap
      };
    }
  };

  const placementStatus = getPlacementTestStatus();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
        </div>

        {/* Success/Error Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Alert className="border-success/20 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success-foreground">{success}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your account details and learning progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Username */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Username</Label>
                {isEditingUsername ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value)}
                      className="max-w-xs"
                      disabled={isLoading}
                    />
                    <Button
                      size="sm"
                      onClick={handleUsernameUpdate}
                      disabled={isLoading}
                    >
                      {isLoading ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditingUsername(false);
                        setEditedUsername(user.username);
                        setError(null);
                      }}
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">{user.username}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingUsername(true)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Email */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            {/* Learning Level */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Learning Level
                </Label>
                <div className="flex items-center gap-2">
                  <Badge className={getLevelBadgeColor(user.level)}>
                    {user.level || 'Not set'}
                  </Badge>
                  {user.level && (
                    <span className="text-xs text-muted-foreground">
                      {user.placement_test_completed ? '(From placement test)' : '(Self-selected)'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Placement Test Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Placement Test</Label>
                <div className="flex items-center gap-2">
                  <placementStatus.icon className={`w-4 h-4 ${placementStatus.color}`} />
                  <span className={`text-sm ${placementStatus.color}`}>
                    {placementStatus.text}
                  </span>
                  {user.placement_test_score && (
                    <Badge variant="outline" className="text-xs">
                      Score: {user.placement_test_score}%
                    </Badge>
                  )}
                </div>
              </div>
              {onStartPlacementTest && (
                <Button
                  size="sm"
                  onClick={onStartPlacementTest}
                  className="bg-accent hover:bg-accent/90"
                >
                  <placementStatus.actionIcon className="w-4 h-4 mr-2" />
                  {placementStatus.action}
                </Button>
              )}
            </div>

            <Separator />

            {/* Account Created */}
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Member Since
              </Label>
              <p className="text-sm text-muted-foreground">
                {formatDate(user.created_at)}
              </p>
            </div>

            {/* Last Login */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Last Login</Label>
              <p className="text-sm text-muted-foreground">
                {formatDate(user.last_login || '')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* App Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              App Preferences
            </CardTitle>
            <CardDescription>
              Customize your learning experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive reminders and progress updates
                </p>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
              />
            </div>

            <Separator />

            {/* Sound Effects */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Sound Effects
                </Label>
                <p className="text-xs text-muted-foreground">
                  Play sounds for interactions and feedback
                </p>
              </div>
              <Switch
                checked={settings.soundEffects}
                onCheckedChange={(checked) => handleSettingChange('soundEffects', checked)}
              />
            </div>

            <Separator />

            {/* Auto Sync */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Auto Sync</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically sync your progress across devices
                </p>
              </div>
              <Switch
                checked={settings.autoSync}
                onCheckedChange={(checked) => handleSettingChange('autoSync', checked)}
              />
            </div>

            <Separator />

            {/* Prosody Feedback */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Detailed Prosody Feedback</Label>
                <p className="text-xs text-muted-foreground">
                  Show detailed pronunciation and rhythm analysis
                </p>
              </div>
              <Switch
                checked={settings.prosodyFeedback}
                onCheckedChange={(checked) => handleSettingChange('prosodyFeedback', checked)}
              />
            </div>

            <Separator />

            {/* Voice Recording */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Voice Recording</Label>
                <p className="text-xs text-muted-foreground">
                  Enable microphone for pronunciation practice
                </p>
              </div>
              <Switch
                checked={settings.voiceRecording}
                onCheckedChange={(checked) => handleSettingChange('voiceRecording', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Manage your data and account security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Device ID</Label>
              <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                {user.device_id}
              </p>
            </div>

            <Separator />

            {/* Danger Zone */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-destructive">Danger Zone</Label>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <Trash2 className="w-5 h-5" />
                      Delete Account
                    </DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Warning:</strong> All your learning progress, conversations, and settings will be permanently lost.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex gap-2">
                      <Button variant="destructive" className="flex-1">
                        Yes, Delete My Account
                      </Button>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          Cancel
                        </Button>
                      </DialogTrigger>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* App Information */}
        <Card>
          <CardHeader>
            <CardTitle>App Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Build</span>
              <span>2024.10.10</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform</span>
              <span>Web</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
