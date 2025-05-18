import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ChevronRight,
  Key,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  User,
  UserCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LanguageSelector } from "@/components/language-selector";
import { PersonalizationWizard } from "@/components/personalization";

// Profile update form schema
const profileFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

// Password change form schema
const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Preferences form schema
const preferencesFormSchema = z.object({
  language: z.string(),
  theme: z.string(),
  timezone: z.string(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isTerminatingSession, setIsTerminatingSession] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] = useState<string | null>(null);

  // Define profile data interface
  interface ProfileData {
    user: {
      id: number;
      username: string;
      fullName: string | null;
      email: string | null;
      phoneNumber: string | null;
      avatarUrl: string | null;
    };
    preferences: {
      language: string;
      theme: string;
      timezone: string;
      dateFormat: string;
      timeFormat: string;
    };
    roles?: Array<{
      id: number;
      name: string;
    }>;
    mfa?: {
      enabled: boolean;
      method: string;
    };
  }

  // Fetch profile data
  const { data: profileData, isLoading: isLoadingProfile } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user,
  });

  // Define sessions interface
  interface SessionData {
    sessionId: string;
    id?: string | number;  // Some APIs might return id instead of sessionId
    userAgent: string;
    ipAddress: string;
    lastActive: string;
    current: boolean;
  }

  // Fetch user sessions
  const { data: sessions, isLoading: isLoadingSessions } = useQuery<SessionData[]>({
    queryKey: ["/api/profile/sessions"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user,
  });

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      avatarUrl: user?.avatarUrl || "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Preferences form
  const preferencesForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      language: profileData?.preferences?.language || "en",
      theme: profileData?.preferences?.theme || "system",
      timezone: profileData?.preferences?.timezone || "UTC",
      dateFormat: profileData?.preferences?.dateFormat || "YYYY-MM-DD",
      timeFormat: profileData?.preferences?.timeFormat || "HH:mm:ss",
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PUT", "/api/profile", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "An error occurred while updating your profile.",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const res = await apiRequest("PUT", "/api/profile/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to change password",
        description: error.message || "An error occurred while changing your password.",
        variant: "destructive",
      });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: PreferencesFormValues) => {
      const res = await apiRequest("PUT", "/api/profile/preferences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Preferences updated",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update preferences",
        description: error.message || "An error occurred while updating your preferences.",
        variant: "destructive",
      });
    },
  });

  // Terminate session mutation
  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("DELETE", `/api/profile/sessions/${sessionId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/sessions"] });
      setIsTerminatingSession(false);
      setSessionToTerminate(null);
      toast({
        title: "Session terminated",
        description: "The session has been terminated successfully.",
      });
    },
    onError: (error: any) => {
      setIsTerminatingSession(false);
      setSessionToTerminate(null);
      toast({
        title: "Failed to terminate session",
        description: error.message || "An error occurred while terminating the session.",
        variant: "destructive",
      });
    },
  });

  // Update form defaults when data loads
  React.useEffect(() => {
    if (profileData) {
      profileForm.reset({
        fullName: profileData.user.fullName || "",
        email: profileData.user.email || "",
        phoneNumber: profileData.user.phoneNumber || "",
        avatarUrl: profileData.user.avatarUrl || "",
      });

      preferencesForm.reset({
        language: profileData.preferences?.language || "en",
        theme: profileData.preferences?.theme || "system",
        timezone: profileData.preferences?.timezone || "UTC",
        dateFormat: profileData.preferences?.dateFormat || "YYYY-MM-DD",
        timeFormat: profileData.preferences?.timeFormat || "HH:mm:ss",
      });
    }
  }, [profileData]);

  // Handle profile form submission
  const onProfileSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  // Handle password form submission
  const onPasswordSubmit = (data: PasswordFormValues) => {
    changePasswordMutation.mutate(data);
  };

  // Handle preferences form submission
  const onPreferencesSubmit = (data: PreferencesFormValues) => {
    updatePreferencesMutation.mutate(data);
  };

  // Terminate session handler
  const handleTerminateSession = (sessionId: string) => {
    setSessionToTerminate(sessionId);
    setIsTerminatingSession(true);
  };

  const confirmTerminateSession = () => {
    if (sessionToTerminate) {
      terminateSessionMutation.mutate(sessionToTerminate);
    }
  };

  if (isLoading || isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-3xl mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication required</AlertTitle>
          <AlertDescription>
            You need to be logged in to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8">
      <div className="flex flex-col gap-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatarUrl || ""} alt={user.fullName || user.username} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
              {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : user.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">{user.username}</p>
              {profileData?.roles?.map((role: any) => (
                <Badge key={role.id} variant="outline">{role.name}</Badge>
              ))}
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-4 mb-8">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              <span>{t('profile.tabs.profile')}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>{t('profile.tabs.security')}</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{t('profile.tabs.preferences')}</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span>{t('profile.tabs.sessions')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.personalInfo')}</CardTitle>
                <CardDescription>
                  {t('profile.personalInfoDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.fullName')}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John Doe" />
                          </FormControl>
                          <FormDescription>
                            {t('profile.fullNameDesc')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.email')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="john@example.com" />
                          </FormControl>
                          <FormDescription>
                            {t('profile.emailDesc')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.phone')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="+1 (555) 123-4567"
                            />
                          </FormControl>
                          <FormDescription>
                            {t('profile.phoneDesc')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="avatarUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.avatarUrl')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="https://example.com/avatar.jpg"
                            />
                          </FormControl>
                          <FormDescription>
                            {t('profile.avatarUrlDesc')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending || !profileForm.formState.isDirty}
                      >
                        {updateProfileMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            {t('profile.updating')}
                          </>
                        ) : (
                          t('profile.updateProfile')
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.changePassword')}</CardTitle>
                <CardDescription>
                  {t('profile.changePasswordDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.currentPassword')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.newPassword')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" />
                          </FormControl>
                          <FormDescription>
                            {t('profile.passwordReqs')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.confirmPassword')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={changePasswordMutation.isPending || !passwordForm.formState.isDirty}
                      >
                        {changePasswordMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            {t('profile.changing')}
                          </>
                        ) : (
                          t('profile.changePassword')
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
            
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.twoFactorAuth')}</CardTitle>
                  <CardDescription>
                    {t('profile.twoFactorAuthDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">
                        {profileData?.mfa?.enabled ? t('profile.mfaEnabled') : t('profile.mfaDisabled')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profileData?.mfa?.enabled 
                          ? t('profile.mfaEnabledDesc', { method: profileData?.mfa?.method }) 
                          : t('profile.mfaDisabledDesc')}
                      </p>
                    </div>
                    <Switch 
                      checked={profileData?.mfa?.enabled || false}
                      onCheckedChange={() => {
                        // This would be implemented with a mutation to enable/disable MFA
                        toast({
                          title: "MFA settings",
                          description: "MFA settings changes are not implemented yet.",
                        });
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.preferences')}</CardTitle>
                  <CardDescription>
                    {t('profile.preferencesDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...preferencesForm}>
                    <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-6">
                    <FormField
                      control={preferencesForm.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.language')}</FormLabel>
                          <div className="flex items-center gap-4">
                            <p className="text-sm text-muted-foreground">
                              {t('profile.selectLanguage')}:
                            </p>
                            <LanguageSelector 
                              variant="secondary" 
                              showLabel={true} 
                              onLanguageChange={(lang: string) => {
                                field.onChange(lang);
                                // Auto-submit when language changes
                                setTimeout(() => {
                                  preferencesForm.handleSubmit(onPreferencesSubmit)();
                                }, 100);
                              }} 
                            />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={preferencesForm.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.theme')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('profile.selectTheme')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="light">{t('theme.light')}</SelectItem>
                              <SelectItem value="dark">{t('theme.dark')}</SelectItem>
                              <SelectItem value="system">{t('theme.system')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t('profile.themeDesc')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={preferencesForm.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('profile.timezone')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('profile.selectTimezone')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="UTC">UTC</SelectItem>
                              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                              <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                              <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                              <SelectItem value="Europe/London">London (GMT)</SelectItem>
                              <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                              <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updatePreferencesMutation.isPending || !preferencesForm.formState.isDirty}
                      >
                        {updatePreferencesMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            {t('profile.savingPreferences')}
                          </>
                        ) : (
                          t('profile.savePreferences')
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
            
            {/* Advanced Personalization Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Advanced UI Personalization</CardTitle>
                <CardDescription>
                  Customize your interface experience with the Smart UI Personalization Wizard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Fine-tune your experience with advanced customization options for themes, layouts, 
                    notifications, and workspace preferences. Our step-by-step wizard will guide you through 
                    the process of personalizing the interface to match your workflow.
                  </p>
                  <PersonalizationWizard />
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.sessions')}</CardTitle>
                <CardDescription>
                  {t('profile.sessionsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center p-4">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    <span>{t('profile.loadingSessions')}</span>
                  </div>
                ) : sessions && sessions.length > 0 ? (
                  <div className="space-y-4">
                    {sessions.map((session) => (
                      <div key={session.id || session.sessionId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex flex-col">
                          <div className="flex items-center">
                            {session.current && (
                              <Badge variant="secondary" className="mr-2 bg-primary/10">
                                {t('profile.currentSession')}
                              </Badge>
                            )}
                            <span className="font-medium">{session.userAgent || t('profile.unknownDevice')}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>{session.ipAddress || 'Unknown IP'}</span>
                            <span className="mx-2">•</span>
                            <span>
                              {session.lastActive ? new Date(session.lastActive).toLocaleString() : t('profile.unknown')}
                            </span>
                          </div>
                        </div>
                        {!session.current && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTerminateSession(session.sessionId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            {t('profile.terminateSession')}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <p>{t('profile.noSessions')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Session Termination Confirmation Dialog */}
      <Dialog open={isTerminatingSession} onOpenChange={setIsTerminatingSession}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.confirmTerminate')}</DialogTitle>
            <DialogDescription>
              {t('profile.confirmTerminateDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTerminatingSession(false);
                setSessionToTerminate(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmTerminateSession}
              disabled={terminateSessionMutation.isPending}
            >
              {terminateSessionMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('profile.terminating')}
                </>
              ) : (
                t('profile.terminate')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}