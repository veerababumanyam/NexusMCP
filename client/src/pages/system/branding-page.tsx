import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/theme-provider";
import { queryClient, apiRequest } from "@/lib/queryClient";

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
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, FileUp, Palette, BriefcaseBusiness, LayoutDashboard } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// Branding form schema
const brandingFormSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  logoUrl: z.string().optional(),
  logoAltText: z.string().optional(),
  favicon: z.string().optional(),
  // Primary brand color
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Must be a valid hex color code",
  }),
  // Secondary brand color
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Must be a valid hex color code",
  }),
  // Accent color
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Must be a valid hex color code",
  }),
  // Enable dark mode
  enableDarkMode: z.boolean().default(true),
  // Default theme
  defaultTheme: z.enum(["light", "dark", "system"]).default("system"),
  // Font settings
  primaryFontFamily: z.string().optional(),
  primaryFontUrl: z.string().optional(),
  secondaryFontFamily: z.string().optional(),
  secondaryFontUrl: z.string().optional(),
  // Custom CSS
  customCss: z.string().optional(),
  // Copyright text
  copyrightText: z.string().optional(),
  // Support email
  supportEmail: z.string().email().optional().or(z.literal("")),
  // Support URL
  supportUrl: z.string().url().optional().or(z.literal("")),
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

export default function BrandingPage() {
  const { toast } = useToast();
  const { theme, setTheme, loadCustomFonts } = useTheme();
  const [activeTab, setActiveTab] = useState("general");
  const [uploadingPrimaryFont, setUploadingPrimaryFont] = useState(false);
  const [uploadingSecondaryFont, setUploadingSecondaryFont] = useState(false);
  const [previewColors, setPreviewColors] = useState<{
    primary: string;
    secondary: string;
    accent: string;
  }>({
    primary: "",
    secondary: "",
    accent: "",
  });
  
  // Define default values for the form
  const defaultValues: Partial<BrandingFormValues> = {
    organizationName: "NexusMCP",
    primaryColor: "#234f8e", // Default primary color 
    secondaryColor: "#2c9a73", // Default secondary color
    accentColor: "#3986ca", // Default accent color
    enableDarkMode: true,
    defaultTheme: "system",
    primaryFontFamily: "Inter, system-ui, sans-serif",
    secondaryFontFamily: "Inter, system-ui, sans-serif",
    copyrightText: `© ${new Date().getFullYear()} NexusMCP. All rights reserved.`,
  };
  
  // Fetch branding configuration from API
  const { data: brandingData, isLoading } = useQuery<BrandingFormValues>({
    queryKey: ['/api/system/branding'],
    onSuccess: (data) => {
      // Reset form with fetched data
      form.reset(data);
      
      // Set preview colors
      setPreviewColors({
        primary: data.primaryColor,
        secondary: data.secondaryColor,
        accent: data.accentColor
      });
    },
    onError: () => {
      // If there's an error, use default values
      form.reset(defaultValues);
      
      // Set preview colors with defaults
      setPreviewColors({
        primary: defaultValues.primaryColor || "",
        secondary: defaultValues.secondaryColor || "",
        accent: defaultValues.accentColor || ""
      });
    }
  });
  
  // Create form
  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: brandingData || defaultValues,
  });
  
  // Save branding mutation
  const saveBrandingMutation = useMutation({
    mutationFn: async (data: BrandingFormValues) => {
      const res = await apiRequest("POST", "/api/system/branding", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Branding saved",
        description: "The branding configuration has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/branding'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving branding",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (data: BrandingFormValues) => {
    saveBrandingMutation.mutate(data);
  };
  
  // Apply theme changes on form values change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Only update preview when color values change
      if (name?.includes("Color") && value.primaryColor && value.secondaryColor && value.accentColor) {
        setPreviewColors({
          primary: value.primaryColor,
          secondary: value.secondaryColor,
          accent: value.accentColor
        });
      }
      
      // Update theme when defaultTheme changes
      if (name === "defaultTheme" && value.defaultTheme) {
        setTheme(value.defaultTheme as "light" | "dark" | "system");
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, setTheme]);
  
  // Apply color changes to root CSS variables for live preview
  useEffect(() => {
    const root = document.documentElement;
    
    if (previewColors.primary) {
      const { r: h, g: s, b: l } = hexToRgb(previewColors.primary);
      
      // Set all primary-related CSS variables
      root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
      root.style.setProperty('--primary-foreground', '210 40% 98%');
      
      // Update sidebar and chart colors derived from primary
      root.style.setProperty('--sidebar-background', `${h} ${s}% ${Math.max(10, l - 5)}%`);
      root.style.setProperty('--sidebar-foreground', '0 0% 100%');
      root.style.setProperty('--sidebar-primary', `${h} ${Math.max(30, s - 10)}% ${Math.min(40, l + 10)}%`);
      root.style.setProperty('--chart-1', `${h} ${s}% ${l}%`);
    }
    
    if (previewColors.secondary) {
      const { r: h, g: s, b: l } = hexToRgb(previewColors.secondary);
      
      // Set all secondary-related CSS variables
      root.style.setProperty('--secondary', `${h} ${s}% ${l}%`);
      root.style.setProperty('--secondary-foreground', '210 40% 98%');
      
      // Apply secondary color to appropriate UI elements
      root.style.setProperty('--chart-2', `${h} ${s}% ${l}%`);
      root.style.setProperty('--chart-4', `${h} ${Math.min(100, s + 20)}% ${Math.min(80, l + 20)}%`);
    }
    
    if (previewColors.accent) {
      const { r: h, g: s, b: l } = hexToRgb(previewColors.accent);
      
      // Set all accent-related CSS variables
      root.style.setProperty('--accent', `${h} ${s}% ${l}%`);
      root.style.setProperty('--accent-foreground', '222.2 47.4% 11.2%');
      
      // Additional accent colors
      root.style.setProperty('--sidebar-accent', `${h} ${s}% ${l}%`);
      root.style.setProperty('--chart-3', `${h} ${Math.max(30, s - 10)}% ${Math.max(30, l - 10)}%`);
      root.style.setProperty('--chart-5', `${h} ${Math.min(90, s + 10)}% ${Math.min(85, l + 15)}%`);
    }
    
    return () => {
      // Cleanup function - reset to default values if needed
    };
  }, [previewColors]);
  
  // Function to convert hex to HSL (accurate conversion)
  function hexToRgb(hex: string) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert shortened hex to full form
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Convert RGB to HSL (more accurate)
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
        case gNorm: h = (bNorm - rNorm) / d + 2; break;
        case bNorm: h = (rNorm - gNorm) / d + 4; break;
      }
      
      h = Math.round(h * 60);
    }
    
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    return { r: h, g: s, b: l };
  }
  
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <DashboardHeader 
        heading="Branding" 
        text="Configure your organization's branding and appearance settings."
      >
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          disabled={saveBrandingMutation.isPending}
        >
          {saveBrandingMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </DashboardHeader>
      
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">
            <BriefcaseBusiness className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Advanced
          </TabsTrigger>
        </TabsList>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Information</CardTitle>
                  <CardDescription>
                    Configure your organization's information and branding
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="organizationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter organization name" {...field} />
                        </FormControl>
                        <FormDescription>
                          This name will be displayed throughout the application.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo URL</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="Enter URL or upload logo" {...field} />
                            <Button type="button" variant="secondary" size="icon">
                              <FileUp className="h-4 w-4" />
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Enter a URL or upload a logo image (recommended size: 200x50px)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="logoAltText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo Alt Text</FormLabel>
                        <FormControl>
                          <Input placeholder="Alternative text for the logo" {...field} />
                        </FormControl>
                        <FormDescription>
                          Accessibility text for screen readers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="favicon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Favicon URL</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="Enter URL or upload favicon" {...field} />
                            <Button type="button" variant="secondary" size="icon">
                              <FileUp className="h-4 w-4" />
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          URL for browser favicon (recommended format: .ico, 32x32px)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Support Information</CardTitle>
                  <CardDescription>
                    Configure support contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="supportEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="support@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          Email address for support inquiries
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="supportUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://support.example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          Link to your support portal or documentation
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="appearance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Colors & Themes
                  </CardTitle>
                  <CardDescription>
                    Customize the application colors and themes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input type="color" {...field} className="w-12 h-10 p-1" />
                              <Input 
                                type="text" 
                                placeholder="#234f8e" 
                                value={field.value || ''} 
                                onChange={field.onChange}
                                className="flex-1"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Main brand color used for buttons and important elements
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="secondaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input type="color" {...field} className="w-12 h-10 p-1" />
                              <Input 
                                type="text" 
                                placeholder="#2c9a73" 
                                value={field.value || ''} 
                                onChange={field.onChange}
                                className="flex-1"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Complementary color for accents and supporting elements
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="accentColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accent Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input type="color" {...field} className="w-12 h-10 p-1" />
                              <Input 
                                type="text" 
                                placeholder="#3986ca" 
                                value={field.value || ''} 
                                onChange={field.onChange}
                                className="flex-1"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Highlight color for selected items and hover states
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="enableDarkMode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Enable Dark Mode
                            </FormLabel>
                            <FormDescription>
                              Allow users to switch between light and dark themes
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
                      control={form.control}
                      name="defaultTheme"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel>Default Theme</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              type="button"
                              variant={field.value === "light" ? "default" : "outline"}
                              onClick={() => field.onChange("light")}
                              className="w-full justify-start"
                            >
                              Light
                            </Button>
                            <Button
                              type="button"
                              variant={field.value === "dark" ? "default" : "outline"}
                              onClick={() => field.onChange("dark")}
                              className="w-full justify-start"
                            >
                              Dark
                            </Button>
                            <Button
                              type="button"
                              variant={field.value === "system" ? "default" : "outline"}
                              onClick={() => field.onChange("system")}
                              className="w-full justify-start"
                            >
                              System
                            </Button>
                          </div>
                          <FormDescription>
                            The default theme used when users first access the application
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="mt-6">
                    <h3 className="text-sm font-medium mb-2">Live Preview</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 bg-background border rounded-lg">
                        <div className="font-medium">Background</div>
                        <div className="text-sm text-muted-foreground">text-foreground</div>
                      </div>
                      <div className="p-4 bg-primary text-primary-foreground rounded-lg">
                        <div className="font-medium">Primary</div>
                        <div className="text-sm opacity-90">text-primary-foreground</div>
                      </div>
                      <div className="p-4 bg-secondary text-secondary-foreground rounded-lg">
                        <div className="font-medium">Secondary</div>
                        <div className="text-sm opacity-90">text-secondary-foreground</div>
                      </div>
                      <div className="p-4 bg-accent text-accent-foreground rounded-lg">
                        <div className="font-medium">Accent</div>
                        <div className="text-sm opacity-90">text-accent-foreground</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Button className="w-full">Primary Button</Button>
                      <Button variant="secondary" className="w-full">Secondary Button</Button>
                      <Button variant="outline" className="w-full">Outline Button</Button>
                    </div>
                    
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge>Primary Badge</Badge>
                      <Badge variant="secondary">Secondary Badge</Badge>
                      <Badge variant="outline">Outline Badge</Badge>
                      <Badge variant="destructive">Destructive Badge</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Typography</CardTitle>
                  <CardDescription>
                    Configure font families used throughout the application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="primaryFontFamily"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Font Family</FormLabel>
                        <FormControl>
                          <Input placeholder="Inter, system-ui, sans-serif" {...field} />
                        </FormControl>
                        <FormDescription>
                          Main font used for text throughout the application
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="primaryFontUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Font URL (optional)</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" {...field} />
                            <Button 
                              type="button" 
                              variant="secondary" 
                              size="icon"
                              disabled={uploadingPrimaryFont}
                              onClick={() => {
                                // Create a hidden file input element
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.woff,.woff2,.ttf,.otf';
                                
                                // Handle file selection
                                input.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (!file) return;
                                  
                                  try {
                                    setUploadingPrimaryFont(true);
                                    
                                    // Create a FormData object to send the file
                                    const formData = new FormData();
                                    formData.append('font', file);
                                    
                                    // Upload the file
                                    const res = await fetch('/api/system/config/upload-font', {
                                      method: 'POST',
                                      body: formData,
                                    });
                                    
                                    if (!res.ok) {
                                      throw new Error('Failed to upload font');
                                    }
                                    
                                    const data = await res.json();
                                    
                                    // Update the form with the returned URL
                                    form.setValue('primaryFontUrl', data.url);
                                    
                                    toast({
                                      title: 'Font uploaded successfully',
                                      description: `${file.name} has been uploaded and will be used as the primary font.`,
                                    });
                                    
                                    // Refresh font preview
                                    loadCustomFonts();
                                  } catch (error) {
                                    console.error('Error uploading font:', error);
                                    toast({
                                      title: 'Font upload failed',
                                      description: error instanceof Error ? error.message : 'Unknown error',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setUploadingPrimaryFont(false);
                                  }
                                };
                                
                                // Trigger file selection dialog
                                input.click();
                              }}
                            >
                              {uploadingPrimaryFont ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileUp className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          URL to the web font or upload a font file (WOFF2 format recommended)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-4" />
                  
                  <FormField
                    control={form.control}
                    name="secondaryFontFamily"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Font Family</FormLabel>
                        <FormControl>
                          <Input placeholder="Inter, system-ui, sans-serif" {...field} />
                        </FormControl>
                        <FormDescription>
                          Secondary font used for headings or special elements
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="secondaryFontUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Font URL (optional)</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&display=swap" {...field} />
                            <Button 
                              type="button" 
                              variant="secondary" 
                              size="icon"
                              disabled={uploadingSecondaryFont}
                              onClick={() => {
                                // Create a hidden file input element
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.woff,.woff2,.ttf,.otf';
                                
                                // Handle file selection
                                input.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (!file) return;
                                  
                                  try {
                                    setUploadingSecondaryFont(true);
                                    
                                    // Create a FormData object to send the file
                                    const formData = new FormData();
                                    formData.append('font', file);
                                    
                                    // Upload the file
                                    const res = await fetch('/api/system/config/upload-font', {
                                      method: 'POST',
                                      body: formData,
                                    });
                                    
                                    if (!res.ok) {
                                      throw new Error('Failed to upload font');
                                    }
                                    
                                    const data = await res.json();
                                    
                                    // Update the form with the returned URL
                                    form.setValue('secondaryFontUrl', data.url);
                                    
                                    toast({
                                      title: 'Font uploaded successfully',
                                      description: `${file.name} has been uploaded and will be used as the secondary font.`,
                                    });
                                    
                                    // Refresh font preview
                                    loadCustomFonts();
                                  } catch (error) {
                                    console.error('Error uploading font:', error);
                                    toast({
                                      title: 'Font upload failed',
                                      description: error instanceof Error ? error.message : 'Unknown error',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setUploadingSecondaryFont(false);
                                  }
                                };
                                
                                // Trigger file selection dialog
                                input.click();
                              }}
                            >
                              {uploadingSecondaryFont ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileUp className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          URL to the web font or upload a font file (WOFF2 format recommended)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="mt-6 p-4 border rounded-md bg-muted/50">
                    <h4 className="text-sm font-medium mb-2">Font Preview</h4>
                    <p className="text-xl" style={{ fontFamily: form.watch("primaryFontFamily") || 'inherit' }}>
                      Primary Font: The quick brown fox jumps over the lazy dog.
                    </p>
                    <p className="text-xl mt-2" style={{ fontFamily: form.watch("secondaryFontFamily") || 'inherit' }}>
                      Secondary Font: The five boxing wizards jump quickly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Settings</CardTitle>
                  <CardDescription>
                    Configure advanced branding options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customCss"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom CSS</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter custom CSS rules..." 
                            className="font-mono h-32"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Add custom CSS to further customize the application appearance
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="copyrightText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Copyright Text</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="© 2023 Your Company Name. All rights reserved." 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Copyright text displayed in the footer
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                className="w-full sm:w-auto"
                disabled={saveBrandingMutation.isPending}
              >
                {saveBrandingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  );
}