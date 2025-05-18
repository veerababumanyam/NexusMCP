import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Palette,
  Settings,
  LayoutDashboard,
  Award,
  BookOpen,
  Sliders,
  Sparkles,
  Bell,
  RefreshCw
} from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Define interfaces based on our API schemas
interface WizardProgressData {
  id: number;
  userId: number;
  wizardType: string;
  completed: boolean;
  currentStep: number;
  stepsCompleted: string[];
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface PersonalizationData {
  id: number;
  userId: number;
  theme: string;
  language: string;
  sidebarCollapsed: boolean;
  defaultView: string;
  dashboardLayout: string;
  accessibilitySettings: Record<string, any>;
  notifications: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface FeatureUsage {
  id: number;
  userId: number;
  featureId: string;
  usageCount: number;
  lastUsedAt: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Wizard step schemas
const themePreferencesSchema = z.object({
  theme: z.string().min(1, "Please select a theme"),
  accentColor: z.string().optional(),
  highContrast: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  fontSize: z.string().default("medium"),
});

const layoutPreferencesSchema = z.object({
  sidebarCollapsed: z.boolean().default(false),
  defaultView: z.string().min(1, "Please select a default view"),
  dashboardLayout: z.string().min(1, "Please select a dashboard layout"),
  compactMode: z.boolean().default(false),
});

const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  inAppNotifications: z.boolean().default(true),
  notificationSounds: z.boolean().default(true),
  digestFrequency: z.string().default("daily"),
  notifyOnServerStatus: z.boolean().default(true),
  notifyOnAuditEvents: z.boolean().default(true),
});

const workspacePreferencesSchema = z.object({
  defaultWorkspace: z.string().optional(),
  showFavorites: z.boolean().default(true),
  rememberLastVisited: z.boolean().default(true),
});

// Combined schema type
type ThemePreferencesFormValues = z.infer<typeof themePreferencesSchema>;
type LayoutPreferencesFormValues = z.infer<typeof layoutPreferencesSchema>;
type NotificationPreferencesFormValues = z.infer<typeof notificationPreferencesSchema>;
type WorkspacePreferencesFormValues = z.infer<typeof workspacePreferencesSchema>;

// Wizard steps configuration
const wizardSteps = [
  {
    id: "theme",
    title: "Theme & Appearance",
    description: "Customize the look and feel of your interface",
    icon: Palette,
    schema: themePreferencesSchema,
  },
  {
    id: "layout",
    title: "Layout Preferences",
    description: "Configure how the application layout appears",
    icon: LayoutDashboard,
    schema: layoutPreferencesSchema,
  },
  {
    id: "notifications",
    title: "Notification Settings",
    description: "Manage your notification preferences",
    icon: Bell,
    schema: notificationPreferencesSchema,
  },
  {
    id: "workspace",
    title: "Workspace Settings",
    description: "Configure your workspace preferences",
    icon: Settings,
    schema: workspacePreferencesSchema,
  },
];

export function PersonalizationWizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [isCompleting, setIsCompleting] = useState(false);

  // Query for retrieving wizard progress
  const {
    data: wizardProgress,
    isLoading: isLoadingProgress,
    error: progressError,
  } = useQuery<WizardProgressData>({
    queryKey: ["/api/ui/wizard/personalization"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user && isOpen,
  });

  // Query for retrieving existing personalization settings
  const {
    data: personalization,
    isLoading: isLoadingPersonalization,
    error: personalizationError,
  } = useQuery<PersonalizationData>({
    queryKey: ["/api/ui/personalization"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user && isOpen,
  });

  // Mutation for updating wizard progress
  const updateWizardProgressMutation = useMutation({
    mutationFn: async (data: Partial<WizardProgressData>) => {
      const res = await apiRequest("POST", "/api/ui/wizard/personalization", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ui/wizard/personalization"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update progress",
        description: error.message || "An error occurred while updating your progress.",
        variant: "destructive",
      });
    },
  });

  // Mutation for completing a wizard step
  const completeStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/ui/wizard/personalization/step/${stepId}/complete`,
        {}
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ui/wizard/personalization"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete step",
        description: error.message || "An error occurred while completing the step.",
        variant: "destructive",
      });
    },
  });

  // Mutation for completing the entire wizard
  const completeWizardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ui/wizard/personalization/complete", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ui/wizard/personalization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ui/personalization"] });
      setIsCompleting(false);
      setIsOpen(false);
      toast({
        title: "Personalization complete",
        description: "Your personalization settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      setIsCompleting(false);
      toast({
        title: "Failed to complete personalization",
        description: error.message || "An error occurred while saving your settings.",
        variant: "destructive",
      });
    },
  });

  // Mutation for saving personalization settings
  const updatePersonalizationMutation = useMutation({
    mutationFn: async (data: Partial<PersonalizationData>) => {
      const res = await apiRequest("POST", "/api/ui/personalization", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ui/personalization"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update personalization",
        description: error.message || "An error occurred while updating your settings.",
        variant: "destructive",
      });
    },
  });

  // Mutation for tracking feature usage
  const trackFeatureUsageMutation = useMutation({
    mutationFn: async (data: { featureId: string; metadata?: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/ui/feature-usage", data);
      return res.json();
    },
  });

  // Initialize forms for each step
  const themeForm = useForm<ThemePreferencesFormValues>({
    resolver: zodResolver(themePreferencesSchema),
    defaultValues: {
      theme: "system",
      accentColor: "blue",
      highContrast: false,
      reducedMotion: false,
      fontSize: "medium",
    },
  });

  const layoutForm = useForm<LayoutPreferencesFormValues>({
    resolver: zodResolver(layoutPreferencesSchema),
    defaultValues: {
      sidebarCollapsed: false,
      defaultView: "dashboard",
      dashboardLayout: "grid",
      compactMode: false,
    },
  });

  const notificationForm = useForm<NotificationPreferencesFormValues>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      emailNotifications: true,
      inAppNotifications: true,
      notificationSounds: true,
      digestFrequency: "daily",
      notifyOnServerStatus: true,
      notifyOnAuditEvents: true,
    },
  });

  const workspaceForm = useForm<WorkspacePreferencesFormValues>({
    resolver: zodResolver(workspacePreferencesSchema),
    defaultValues: {
      defaultWorkspace: "",
      showFavorites: true,
      rememberLastVisited: true,
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (personalization && wizardProgress) {
      // Update theme form
      themeForm.reset({
        theme: personalization.theme || "system",
        accentColor: personalization.accessibilitySettings?.accentColor || "blue",
        highContrast: personalization.accessibilitySettings?.highContrast || false,
        reducedMotion: personalization.accessibilitySettings?.reducedMotion || false,
        fontSize: personalization.accessibilitySettings?.fontSize || "medium",
      });

      // Update layout form
      layoutForm.reset({
        sidebarCollapsed: personalization.sidebarCollapsed || false,
        defaultView: personalization.defaultView || "dashboard",
        dashboardLayout: personalization.dashboardLayout || "grid",
        compactMode: personalization.accessibilitySettings?.compactMode || false,
      });

      // Update notification form
      notificationForm.reset({
        emailNotifications: personalization.notifications?.email || true,
        inAppNotifications: personalization.notifications?.inApp || true,
        notificationSounds: personalization.notifications?.sounds || true,
        digestFrequency: personalization.notifications?.digestFrequency || "daily",
        notifyOnServerStatus: personalization.notifications?.serverStatus || true,
        notifyOnAuditEvents: personalization.notifications?.auditEvents || true,
      });

      // Update workspace form with wizard progress data
      workspaceForm.reset({
        defaultWorkspace: wizardProgress.data?.defaultWorkspace || "",
        showFavorites: wizardProgress.data?.showFavorites !== false,
        rememberLastVisited: wizardProgress.data?.rememberLastVisited !== false,
      });

      // Set current step from wizard progress
      if (wizardProgress.currentStep > 0) {
        setCurrentStep(wizardProgress.currentStep);
      }
    }
  }, [personalization, wizardProgress]);

  // Track wizard open as feature usage
  useEffect(() => {
    if (isOpen && user) {
      trackFeatureUsageMutation.mutate({
        featureId: "personalization_wizard_open",
        metadata: { source: "profile_page" },
      });
    }
  }, [isOpen, user]);

  // Handle step change
  const handleNextStep = async () => {
    // Get current step form
    const currentStepId = wizardSteps[currentStep].id;
    let isValid = false;
    let formData = {};

    // Validate current step form
    switch (currentStepId) {
      case "theme":
        isValid = await themeForm.trigger();
        formData = themeForm.getValues();
        break;
      case "layout":
        isValid = await layoutForm.trigger();
        formData = layoutForm.getValues();
        break;
      case "notifications":
        isValid = await notificationForm.trigger();
        formData = notificationForm.getValues();
        break;
      case "workspace":
        isValid = await workspaceForm.trigger();
        formData = workspaceForm.getValues();
        break;
    }

    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please check the form for errors before continuing.",
        variant: "destructive",
      });
      return;
    }

    // Save form data
    setFormValues((prev) => ({
      ...prev,
      [currentStepId]: formData,
    }));

    // Mark step as completed
    await completeStepMutation.mutateAsync(currentStepId);

    // Save data to relevant endpoints based on step
    if (currentStepId === "theme" || currentStepId === "layout") {
      // Save personalization settings for theme and layout steps
      const themeData = themeForm.getValues();
      const layoutData = layoutForm.getValues();
      
      const personalizationData: Partial<PersonalizationData> = {
        ...(currentStepId === "theme" ? {
          theme: themeData.theme,
          accessibilitySettings: {
            accentColor: themeData.accentColor,
            highContrast: themeData.highContrast,
            reducedMotion: themeData.reducedMotion,
            fontSize: themeData.fontSize,
          }
        } : {}),
        ...(currentStepId === "layout" ? {
          sidebarCollapsed: layoutData.sidebarCollapsed,
          defaultView: layoutData.defaultView,
          dashboardLayout: layoutData.dashboardLayout,
          accessibilitySettings: {
            ...(personalization?.accessibilitySettings || {}),
            compactMode: layoutData.compactMode,
          }
        } : {})
      };

      await updatePersonalizationMutation.mutateAsync(personalizationData);

      // Track feature usage
      trackFeatureUsageMutation.mutate({
        featureId: `personalization_${currentStepId}_updated`,
        metadata: { stepId: currentStepId }
      });
    }

    // Update wizard progress
    updateWizardProgressMutation.mutate({
      currentStep: currentStep + 1,
      data: {
        ...(wizardProgress?.data || {}),
        [currentStepId]: formData,
      },
    });

    // Move to next step or complete wizard
    if (currentStep < wizardSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      
      // Update wizard progress
      updateWizardProgressMutation.mutate({
        currentStep: currentStep - 1,
      });
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);

    try {
      // Save all form data
      const themeData = themeForm.getValues();
      const layoutData = layoutForm.getValues();
      const notificationData = notificationForm.getValues();
      const workspaceData = workspaceForm.getValues();

      // Update personalization settings with all collected data
      await updatePersonalizationMutation.mutateAsync({
        theme: themeData.theme,
        sidebarCollapsed: layoutData.sidebarCollapsed,
        defaultView: layoutData.defaultView,
        dashboardLayout: layoutData.dashboardLayout,
        accessibilitySettings: {
          accentColor: themeData.accentColor,
          highContrast: themeData.highContrast,
          reducedMotion: themeData.reducedMotion,
          fontSize: themeData.fontSize,
          compactMode: layoutData.compactMode,
        },
        notifications: {
          email: notificationData.emailNotifications,
          inApp: notificationData.inAppNotifications,
          sounds: notificationData.notificationSounds,
          digestFrequency: notificationData.digestFrequency,
          serverStatus: notificationData.notifyOnServerStatus,
          auditEvents: notificationData.notifyOnAuditEvents,
        },
      });

      // Save workspace preferences to wizard data
      await updateWizardProgressMutation.mutateAsync({
        data: {
          ...(wizardProgress?.data || {}),
          defaultWorkspace: workspaceData.defaultWorkspace,
          showFavorites: workspaceData.showFavorites,
          rememberLastVisited: workspaceData.rememberLastVisited,
        },
      });

      // Mark wizard as completed
      await completeWizardMutation.mutateAsync();

      // Track wizard completion
      trackFeatureUsageMutation.mutate({
        featureId: "personalization_wizard_completed",
        metadata: { stepsCompleted: wizardSteps.length }
      });
    } catch (error) {
      setIsCompleting(false);
      toast({
        title: "Failed to save settings",
        description: "An error occurred while saving your personalization settings.",
        variant: "destructive",
      });
    }
  };

  // Render current step form
  const renderStepForm = () => {
    const currentStepId = wizardSteps[currentStep].id;

    switch (currentStepId) {
      case "theme":
        return (
          <Form {...themeForm}>
            <form className="space-y-6">
              <FormField
                control={themeForm.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interface Theme</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a theme" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System Default</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the color scheme for the application interface.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={themeForm.control}
                name="accentColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accent Color</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select accent color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the accent color for buttons and highlighted elements.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={themeForm.control}
                name="fontSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Font Size</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select font size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select your preferred font size for better readability.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={themeForm.control}
                name="highContrast"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>High Contrast Mode</FormLabel>
                      <FormDescription>
                        Enable high contrast for better visibility.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={themeForm.control}
                name="reducedMotion"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Reduced Motion</FormLabel>
                      <FormDescription>
                        Minimize animations throughout the interface.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
        
      case "layout":
        return (
          <Form {...layoutForm}>
            <form className="space-y-6">
              <FormField
                control={layoutForm.control}
                name="defaultView"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default View</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select default view" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dashboard">Dashboard</SelectItem>
                        <SelectItem value="servers">Servers</SelectItem>
                        <SelectItem value="agents">Agents</SelectItem>
                        <SelectItem value="analytics">Analytics</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose which view to show by default when you log in.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={layoutForm.control}
                name="dashboardLayout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dashboard Layout</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select dashboard layout" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select your preferred dashboard layout style.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={layoutForm.control}
                name="sidebarCollapsed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Collapsed Sidebar</FormLabel>
                      <FormDescription>
                        Start with sidebar collapsed by default.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={layoutForm.control}
                name="compactMode"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Compact Mode</FormLabel>
                      <FormDescription>
                        Use more compact spacing throughout the interface.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
        
      case "notifications":
        return (
          <Form {...notificationForm}>
            <form className="space-y-6">
              <FormField
                control={notificationForm.control}
                name="emailNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Email Notifications</FormLabel>
                      <FormDescription>
                        Receive important notifications via email.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={notificationForm.control}
                name="inAppNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>In-App Notifications</FormLabel>
                      <FormDescription>
                        Show notification alerts within the application.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={notificationForm.control}
                name="notificationSounds"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Notification Sounds</FormLabel>
                      <FormDescription>
                        Play sounds for important notifications.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={notificationForm.control}
                name="digestFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Digest Frequency</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select digest frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often to receive notification digests.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={notificationForm.control}
                name="notifyOnServerStatus"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>MCP Server Status</FormLabel>
                      <FormDescription>
                        Get notified about server status changes.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={notificationForm.control}
                name="notifyOnAuditEvents"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Audit Events</FormLabel>
                      <FormDescription>
                        Get notified about important audit events.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
        
      case "workspace":
        return (
          <Form {...workspaceForm}>
            <form className="space-y-6">
              <FormField
                control={workspaceForm.control}
                name="defaultWorkspace"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Workspace</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select default workspace" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="organization">Organization</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select your preferred default workspace.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={workspaceForm.control}
                name="showFavorites"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Show Favorites</FormLabel>
                      <FormDescription>
                        Show favorite items at the top of lists.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={workspaceForm.control}
                name="rememberLastVisited"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Remember Last Visited</FormLabel>
                      <FormDescription>
                        Return to the last workspace visited when logging in.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-2"
      >
        <Sparkles className="h-4 w-4" />
        <span>Personalization Wizard</span>
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="h-6 w-6 text-primary" />
              Smart UI Personalization Wizard
            </DialogTitle>
            <DialogDescription>
              Customize your interface experience to match your preferences and workflow.
            </DialogDescription>
          </DialogHeader>
          
          {/* Progress indicator */}
          <div className="mb-4">
            <Progress value={((currentStep + 1) / wizardSteps.length) * 100} className="h-2 mb-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {wizardSteps.length}</span>
              <span>{Math.round(((currentStep + 1) / wizardSteps.length) * 100)}% complete</span>
            </div>
          </div>
          
          {/* Step navigation pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {wizardSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = wizardProgress?.stepsCompleted?.includes(step.id);
              const isCurrent = currentStep === index;
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-pointer border ${
                    isCurrent 
                      ? 'border-primary bg-primary text-white'
                      : isCompleted
                      ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950'
                      : 'border-muted bg-background'
                  }`}
                  onClick={() => {
                    if (isCompleted || index <= currentStep) {
                      setCurrentStep(index);
                      updateWizardProgressMutation.mutate({
                        currentStep: index,
                      });
                    }
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                  <span>{step.title}</span>
                </div>
              );
            })}
          </div>
          
          {/* Current step content */}
          <div className="flex flex-col space-y-4 py-2">
            <div className="flex items-center gap-4 mb-4">
              {wizardSteps[currentStep].icon && (
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  {React.createElement(wizardSteps[currentStep].icon, { className: "h-6 w-6" })}
                </div>
              )}
              <div>
                <h3 className="text-lg font-medium">{wizardSteps[currentStep].title}</h3>
                <p className="text-sm text-muted-foreground">{wizardSteps[currentStep].description}</p>
              </div>
            </div>
            
            {isLoadingProgress || isLoadingPersonalization ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading your preferences...</span>
              </div>
            ) : (
              <div className="py-2">{renderStepForm()}</div>
            )}
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              disabled={currentStep === 0 || isCompleting}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            
            <Button
              onClick={handleNextStep}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : currentStep === wizardSteps.length - 1 ? (
                <>
                  Complete <CheckCircle className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}