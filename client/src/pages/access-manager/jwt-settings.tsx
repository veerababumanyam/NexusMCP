import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { JwtSettings, JwtClaimMapping } from "@shared/schema_jwt";
import { DownloadIcon, RefreshCwIcon, KeyIcon, PlusIcon, CopyIcon, ClipboardCopyIcon, TrashIcon, PencilIcon } from "lucide-react";
import PageHeader from "@/components/page-header";
import { SkeletonCard } from "@/components/skeleton-card";

// Create form schema for JWT Settings
const jwtSettingsFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  workspaceId: z.number().optional(),
  isActive: z.boolean().default(true),
  audience: z.string().optional(),
  issuer: z.string().min(1, "Issuer is required"),
  tokenLifetime: z.number().min(60, "Token lifetime must be at least 60 seconds").default(3600),
  refreshTokenLifetime: z.number().min(300, "Refresh token lifetime must be at least 300 seconds").default(604800),
  signingAlgorithm: z.enum(["RS256", "RS384", "RS512", "HS256", "HS384", "HS512", "ES256", "ES384", "ES512"], {
    required_error: "Signing algorithm is required",
    invalid_type_error: "Invalid signing algorithm",
  }).default("RS256"),
  useJwks: z.boolean().default(false),
  jwksUrl: z.string().url("JWKS URL must be a valid URL").optional().nullable(),
  rotationFrequency: z.number().default(0),
  defaultSettings: z.boolean().default(false),
});

// Create form schema for JWT Claim Mapping
const jwtClaimMappingFormSchema = z.object({
  settingsId: z.number(),
  claimName: z.string().min(1, "Claim name is required"),
  sourceType: z.enum(["user_property", "user_metadata", "custom", "function", "constant"], {
    required_error: "Source type is required",
    invalid_type_error: "Invalid source type",
  }),
  sourcePath: z.string().optional().nullable(),
  defaultValue: z.string().optional().nullable(),
  transform: z.string().optional().nullable(),
  isRequired: z.boolean().default(false),
});

// Create form schema for test token generation
const testTokenFormSchema = z.object({
  payload: z.record(z.string(), z.any()).default({}),
});

export default function JwtSettingsPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("settings");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [isTestTokenDialogOpen, setIsTestTokenDialogOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<JwtSettings | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<JwtClaimMapping | null>(null);
  const [testToken, setTestToken] = useState<{ token: string; payload: any } | null>(null);

  // Fetch JWT settings
  const { data: jwtSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/jwt-settings"],
    queryFn: async () => {
      const response = await fetch("/api/jwt-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch JWT settings");
      }
      return await response.json() as JwtSettings[];
    },
  });

  // Fetch JWT claims for selected setting
  const { data: jwtClaims, isLoading: isLoadingClaims } = useQuery({
    queryKey: ["/api/jwt-settings", selectedSetting?.id, "claims"],
    queryFn: async () => {
      if (!selectedSetting?.id) return [];
      const response = await fetch(`/api/jwt-settings/${selectedSetting.id}/claims`);
      if (!response.ok) {
        throw new Error("Failed to fetch JWT claims");
      }
      return await response.json() as JwtClaimMapping[];
    },
    enabled: !!selectedSetting?.id,
  });

  // Create JWT setting
  const createSettingMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jwtSettingsFormSchema>) => {
      const response = await fetch("/api/jwt-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create JWT setting");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "JWT setting created successfully",
      });
      setIsCreateDialogOpen(false);
      createSettingForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/jwt-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update JWT setting
  const updateSettingMutation = useMutation({
    mutationFn: async (data: Partial<JwtSettings> & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/jwt-settings/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update JWT setting");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "JWT setting updated successfully",
      });
      setIsEditDialogOpen(false);
      editSettingForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/jwt-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete JWT setting
  const deleteSettingMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/jwt-settings/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete JWT setting");
      }
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "JWT setting deleted successfully",
      });
      setSelectedSetting(null);
      queryClient.invalidateQueries({ queryKey: ["/api/jwt-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Rotate keys for JWT setting
  const rotateKeysMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/jwt-settings/${id}/rotate`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to rotate keys");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Keys rotated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jwt-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create JWT claim
  const createClaimMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jwtClaimMappingFormSchema>) => {
      const response = await fetch(`/api/jwt-settings/${data.settingsId}/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create JWT claim");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "JWT claim created successfully",
      });
      setIsClaimDialogOpen(false);
      claimForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/jwt-settings", selectedSetting?.id, "claims"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update JWT claim
  const updateClaimMutation = useMutation({
    mutationFn: async (data: Partial<JwtClaimMapping> & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/jwt-settings/claims/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update JWT claim");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "JWT claim updated successfully",
      });
      setIsClaimDialogOpen(false);
      claimForm.reset();
      setSelectedClaim(null);
      queryClient.invalidateQueries({ queryKey: ["/api/jwt-settings", selectedSetting?.id, "claims"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete JWT claim
  const deleteClaimMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/jwt-settings/claims/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete JWT claim");
      }
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "JWT claim deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jwt-settings", selectedSetting?.id, "claims"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate test token
  const generateTestTokenMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, any> }) => {
      const response = await fetch(`/api/jwt-settings/${id}/test-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate test token");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setTestToken(data);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create setting form
  const createSettingForm = useForm<z.infer<typeof jwtSettingsFormSchema>>({
    resolver: zodResolver(jwtSettingsFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      tokenLifetime: 3600,
      refreshTokenLifetime: 604800,
      signingAlgorithm: "RS256",
      useJwks: false,
      rotationFrequency: 0,
      defaultSettings: false,
    },
  });

  // Edit setting form
  const editSettingForm = useForm<z.infer<typeof jwtSettingsFormSchema>>({
    resolver: zodResolver(jwtSettingsFormSchema),
    defaultValues: {
      name: selectedSetting?.name || "",
      description: selectedSetting?.description || "",
      isActive: selectedSetting?.isActive ?? true,
      audience: selectedSetting?.audience || "",
      issuer: selectedSetting?.issuer || "",
      tokenLifetime: selectedSetting?.tokenLifetime || 3600,
      refreshTokenLifetime: selectedSetting?.refreshTokenLifetime || 604800,
      signingAlgorithm: (selectedSetting?.signingAlgorithm as any) || "RS256",
      useJwks: selectedSetting?.useJwks ?? false,
      jwksUrl: selectedSetting?.jwksUrl || "",
      rotationFrequency: selectedSetting?.rotationFrequency || 0,
      defaultSettings: selectedSetting?.defaultSettings ?? false,
    },
  });

  // Claim form
  const claimForm = useForm<z.infer<typeof jwtClaimMappingFormSchema>>({
    resolver: zodResolver(jwtClaimMappingFormSchema),
    defaultValues: {
      settingsId: selectedSetting?.id || 0,
      claimName: selectedClaim?.claimName || "",
      sourceType: (selectedClaim?.sourceType as any) || "user_property",
      sourcePath: selectedClaim?.sourcePath || "",
      defaultValue: selectedClaim?.defaultValue || "",
      transform: selectedClaim?.transform || "",
      isRequired: selectedClaim?.isRequired ?? false,
    },
  });

  // Test token form
  const testTokenForm = useForm<z.infer<typeof testTokenFormSchema>>({
    resolver: zodResolver(testTokenFormSchema),
    defaultValues: {
      payload: {
        sub: "user123",
        name: "John Doe",
        email: "john.doe@example.com",
        roles: ["user", "admin"],
      },
    },
  });

  // Handle create setting form submission
  const onCreateSettingSubmit = (data: z.infer<typeof jwtSettingsFormSchema>) => {
    createSettingMutation.mutate(data);
  };

  // Handle edit setting form submission
  const onEditSettingSubmit = (data: z.infer<typeof jwtSettingsFormSchema>) => {
    if (selectedSetting?.id) {
      updateSettingMutation.mutate({ ...data, id: selectedSetting.id });
    }
  };

  // Handle claim form submission
  const onClaimSubmit = (data: z.infer<typeof jwtClaimMappingFormSchema>) => {
    if (selectedClaim?.id) {
      // Update existing claim
      updateClaimMutation.mutate({ ...data, id: selectedClaim.id });
    } else {
      // Create new claim
      createClaimMutation.mutate(data);
    }
  };

  // Handle test token form submission
  const onTestTokenSubmit = (data: z.infer<typeof testTokenFormSchema>) => {
    if (selectedSetting?.id) {
      generateTestTokenMutation.mutate({ id: selectedSetting.id, payload: data.payload });
    }
  };

  // Handle edit setting button click
  const handleEditSetting = (setting: JwtSettings) => {
    setSelectedSetting(setting);
    editSettingForm.reset({
      name: setting.name,
      description: setting.description || "",
      isActive: setting.isActive,
      audience: setting.audience || "",
      issuer: setting.issuer,
      tokenLifetime: setting.tokenLifetime,
      refreshTokenLifetime: setting.refreshTokenLifetime,
      signingAlgorithm: setting.signingAlgorithm as any,
      useJwks: setting.useJwks,
      jwksUrl: setting.jwksUrl || "",
      rotationFrequency: setting.rotationFrequency,
      defaultSettings: setting.defaultSettings,
    });
    setIsEditDialogOpen(true);
  };

  // Handle create claim button click
  const handleCreateClaim = () => {
    setSelectedClaim(null);
    claimForm.reset({
      settingsId: selectedSetting?.id || 0,
      claimName: "",
      sourceType: "user_property",
      sourcePath: "",
      defaultValue: "",
      transform: "",
      isRequired: false,
    });
    setIsClaimDialogOpen(true);
  };

  // Handle edit claim button click
  const handleEditClaim = (claim: JwtClaimMapping) => {
    setSelectedClaim(claim);
    claimForm.reset({
      settingsId: claim.settingsId,
      claimName: claim.claimName,
      sourceType: claim.sourceType as any,
      sourcePath: claim.sourcePath || "",
      defaultValue: claim.defaultValue || "",
      transform: claim.transform || "",
      isRequired: claim.isRequired,
    });
    setIsClaimDialogOpen(true);
  };

  // Handle generate test token button click
  const handleGenerateTestToken = () => {
    setTestToken(null);
    testTokenForm.reset();
    setIsTestTokenDialogOpen(true);
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Format date function
  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  // If loading, return skeleton
  if (isLoadingSettings) {
    return (
      <div className="container py-6">
        <PageHeader
          title="JWT Settings"
          description="Manage JSON Web Token (JWT) configurations for authentication and authorization"
          icon={KeyIcon}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <PageHeader
        title="JWT Settings"
        description="Manage JSON Web Token (JWT) configurations for authentication and authorization"
        icon={KeyIcon}
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New JWT Setting
          </Button>
        }
      />

      <div className="grid gap-6">
        {/* JWT Settings List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jwtSettings?.map((setting) => (
            <Card
              key={setting.id}
              className={`cursor-pointer ${
                selectedSetting?.id === setting.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedSetting(setting)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-bold">{setting.name}</CardTitle>
                  <div className="flex gap-1">
                    {setting.defaultSettings && (
                      <Badge className="bg-primary">Default</Badge>
                    )}
                    <Badge variant={setting.isActive ? "outline" : "secondary"}>
                      {setting.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <CardDescription>{setting.description || "No description provided"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Algorithm:</span>
                    <span>{setting.signingAlgorithm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Issuer:</span>
                    <span className="truncate max-w-[180px]">{setting.issuer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Token Lifetime:</span>
                    <span>{setting.tokenLifetime}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Last Rotated:</span>
                    <span>{formatDate(setting.lastRotated)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSetting(setting);
                      }}
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive hover:bg-destructive/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete JWT Setting</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this JWT setting? This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteSettingMutation.mutate(setting.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {jwtSettings?.length === 0 && (
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>No JWT Settings</CardTitle>
                <CardDescription>
                  You haven't created any JWT settings yet. Click the "New JWT Setting" button to
                  create one.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* JWT Setting Details */}
        {selectedSetting && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Setting Details: {selectedSetting.name}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTestToken}
                    disabled={!selectedSetting.isActive}
                  >
                    <KeyIcon className="h-4 w-4 mr-2" />
                    Generate Test Token
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rotateKeysMutation.mutate(selectedSetting.id)}
                    disabled={selectedSetting.useJwks}
                  >
                    <RefreshCwIcon className="h-4 w-4 mr-2" />
                    Rotate Keys
                  </Button>
                </div>
              </div>
              <CardDescription>
                Configure claims, view keys, and test token generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="claims">Claims</TabsTrigger>
                  <TabsTrigger value="keys">Keys</TabsTrigger>
                </TabsList>

                {/* Settings Tab */}
                <TabsContent value="settings">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="font-medium">ID:</span>
                        <span>{selectedSetting.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Name:</span>
                        <span>{selectedSetting.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Status:</span>
                        <Badge variant={selectedSetting.isActive ? "outline" : "secondary"}>
                          {selectedSetting.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Default:</span>
                        <Badge variant={selectedSetting.defaultSettings ? "default" : "secondary"}>
                          {selectedSetting.defaultSettings ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Created:</span>
                        <span>{formatDate(selectedSetting.createdAt)}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="font-medium">Algorithm:</span>
                        <span>{selectedSetting.signingAlgorithm}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Issuer:</span>
                        <span>{selectedSetting.issuer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Audience:</span>
                        <span>{selectedSetting.audience || "Not specified"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Token Lifetime:</span>
                        <span>{selectedSetting.tokenLifetime} seconds</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Refresh Token Lifetime:</span>
                        <span>{selectedSetting.refreshTokenLifetime} seconds</span>
                      </div>
                    </div>
                  </div>
                  {selectedSetting.description && (
                    <div className="mt-4">
                      <span className="font-medium">Description:</span>
                      <p className="mt-1 text-sm">{selectedSetting.description}</p>
                    </div>
                  )}

                  <div className="mt-4">
                    <span className="font-medium">JWKS Configuration:</span>
                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      <div className="flex justify-between">
                        <span>Use JWKS:</span>
                        <Badge variant={selectedSetting.useJwks ? "default" : "secondary"}>
                          {selectedSetting.useJwks ? "Yes" : "No"}
                        </Badge>
                      </div>
                      {selectedSetting.useJwks && selectedSetting.jwksUrl && (
                        <div className="flex justify-between">
                          <span>JWKS URL:</span>
                          <span className="text-sm truncate max-w-[200px]">
                            {selectedSetting.jwksUrl}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="font-medium">Key Rotation:</span>
                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      <div className="flex justify-between">
                        <span>Rotation Frequency:</span>
                        <span>
                          {selectedSetting.rotationFrequency === 0
                            ? "Manual"
                            : `${selectedSetting.rotationFrequency} days`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Rotated:</span>
                        <span>{formatDate(selectedSetting.lastRotated)}</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Claims Tab */}
                <TabsContent value="claims">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Claim Mappings</h3>
                    <Button size="sm" onClick={handleCreateClaim}>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Claim
                    </Button>
                  </div>
                  
                  {isLoadingClaims ? (
                    <div className="text-center py-4">Loading claims...</div>
                  ) : jwtClaims && jwtClaims.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claim Name</TableHead>
                          <TableHead>Source Type</TableHead>
                          <TableHead>Source Path</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jwtClaims.map((claim) => (
                          <TableRow key={claim.id}>
                            <TableCell className="font-medium">{claim.claimName}</TableCell>
                            <TableCell>{claim.sourceType}</TableCell>
                            <TableCell>{claim.sourcePath || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant={claim.isRequired ? "default" : "secondary"}>
                                {claim.isRequired ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditClaim(claim)}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <TrashIcon className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Claim</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the claim "{claim.claimName}"?
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteClaimMutation.mutate(claim.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 border rounded-md">
                      <p className="text-muted-foreground">No claim mappings defined</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add claim mappings to control what data is included in your tokens
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Keys Tab */}
                <TabsContent value="keys">
                  {selectedSetting.useJwks ? (
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-md">
                        <h3 className="text-lg font-medium mb-2">JWKS Configuration</h3>
                        <p className="text-sm mb-4">
                          This JWT setting is configured to use a JWKS (JSON Web Key Set) URL to
                          validate tokens. The signing keys are not stored in the system.
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">JWKS URL:</span>
                          <div className="flex items-center">
                            <span className="mr-2">{selectedSetting.jwksUrl}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(selectedSetting.jwksUrl || "")}
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted p-4 rounded-md">
                        <h3 className="text-lg font-medium mb-2">JWKS Endpoint</h3>
                        <p className="text-sm mb-4">
                          Your application can provide a JWKS endpoint for consumers of your tokens.
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">JWKS Endpoint:</span>
                          <div className="flex items-center">
                            <span className="mr-2">{`/api/jwt-settings/${selectedSetting.id}/jwks.json`}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                copyToClipboard(`/api/jwt-settings/${selectedSetting.id}/jwks.json`)
                              }
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {selectedSetting.signingAlgorithm.startsWith("HS") ? (
                        <div className="space-y-4">
                          <div className="bg-muted p-4 rounded-md">
                            <h3 className="text-lg font-medium mb-2">HMAC Secret Key</h3>
                            <p className="text-sm mb-4">
                              This JWT setting uses an HMAC algorithm with a shared secret key.
                              The key is securely stored in the system.
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Secret Key:</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="ml-2"
                                onClick={() => rotateKeysMutation.mutate(selectedSetting.id)}
                              >
                                <RefreshCwIcon className="h-4 w-4 mr-2" />
                                Rotate Key
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              For security reasons, the secret key is not displayed. You can rotate
                              the key if needed.
                            </p>
                          </div>
                          <div className="bg-muted p-4 rounded-md">
                            <h3 className="text-lg font-medium mb-2">Key Information</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="font-medium">Algorithm:</span>
                                <span>{selectedSetting.signingAlgorithm}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Last Rotated:</span>
                                <span>{formatDate(selectedSetting.lastRotated)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Rotation Policy:</span>
                                <span>
                                  {selectedSetting.rotationFrequency === 0
                                    ? "Manual rotation"
                                    : `${selectedSetting.rotationFrequency} days`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-muted p-4 rounded-md">
                            <h3 className="text-lg font-medium mb-2">Asymmetric Key Pair</h3>
                            <p className="text-sm mb-4">
                              This JWT setting uses an asymmetric algorithm with a public/private key
                              pair. The keys are securely stored in the system.
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Key Pair:</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="ml-2"
                                onClick={() => rotateKeysMutation.mutate(selectedSetting.id)}
                              >
                                <RefreshCwIcon className="h-4 w-4 mr-2" />
                                Rotate Keys
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              For security reasons, the private key is not displayed. You can rotate
                              the keys if needed.
                            </p>
                          </div>
                          <div className="bg-muted p-4 rounded-md">
                            <h3 className="text-lg font-medium mb-2">Key Information</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="font-medium">Algorithm:</span>
                                <span>{selectedSetting.signingAlgorithm}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Has Signing Key:</span>
                                <Badge
                                  variant={selectedSetting.signingKey ? "default" : "secondary"}
                                >
                                  {selectedSetting.signingKey ? "Yes" : "No"}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Has Public Key:</span>
                                <Badge
                                  variant={selectedSetting.publicKey ? "default" : "secondary"}
                                >
                                  {selectedSetting.publicKey ? "Yes" : "No"}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Last Rotated:</span>
                                <span>{formatDate(selectedSetting.lastRotated)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Rotation Policy:</span>
                                <span>
                                  {selectedSetting.rotationFrequency === 0
                                    ? "Manual rotation"
                                    : `${selectedSetting.rotationFrequency} days`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-muted p-4 rounded-md">
                            <h3 className="text-lg font-medium mb-2">JWKS Endpoint</h3>
                            <p className="text-sm mb-4">
                              Your application can provide a JWKS endpoint for consumers of your tokens.
                            </p>
                            <div className="flex justify-between items-center">
                              <span className="font-medium">JWKS Endpoint:</span>
                              <div className="flex items-center">
                                <span className="mr-2">{`/api/jwt-settings/${selectedSetting.id}/jwks.json`}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    copyToClipboard(
                                      `/api/jwt-settings/${selectedSetting.id}/jwks.json`
                                    )
                                  }
                                >
                                  <CopyIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Create Setting Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Create JWT Setting</DialogTitle>
              <DialogDescription>
                Configure a new JSON Web Token (JWT) setting for authentication and authorization
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <Form {...createSettingForm}>
                <form onSubmit={createSettingForm.handleSubmit(onCreateSettingSubmit)} className="space-y-4">
                  <FormField
                    control={createSettingForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter setting name" {...field} />
                        </FormControl>
                        <FormDescription>A unique name for this JWT setting</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createSettingForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter setting description"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Optional description for this JWT setting</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createSettingForm.control}
                    name="issuer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuer</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter issuer (iss claim)"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Identifies the issuer of the JWT
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createSettingForm.control}
                    name="audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audience</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter audience (aud claim)"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Identifies the recipients of the JWT
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createSettingForm.control}
                    name="tokenLifetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Lifetime (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={60}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          How long the token is valid for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createSettingForm.control}
                    name="refreshTokenLifetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Refresh Token Lifetime (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={300}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          How long the refresh token is valid for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createSettingForm.control}
                  name="signingAlgorithm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signing Algorithm</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a signing algorithm" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="RS256">RS256 (RSA + SHA256)</SelectItem>
                          <SelectItem value="RS384">RS384 (RSA + SHA384)</SelectItem>
                          <SelectItem value="RS512">RS512 (RSA + SHA512)</SelectItem>
                          <SelectItem value="HS256">HS256 (HMAC + SHA256)</SelectItem>
                          <SelectItem value="HS384">HS384 (HMAC + SHA384)</SelectItem>
                          <SelectItem value="HS512">HS512 (HMAC + SHA512)</SelectItem>
                          <SelectItem value="ES256">ES256 (ECDSA + SHA256)</SelectItem>
                          <SelectItem value="ES384">ES384 (ECDSA + SHA384)</SelectItem>
                          <SelectItem value="ES512">ES512 (ECDSA + SHA512)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Algorithm used to sign the JWT
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createSettingForm.control}
                  name="useJwks"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Use JWKS for key management
                        </FormLabel>
                        <FormDescription>
                          Use a JWKS (JSON Web Key Set) URL to retrieve keys for token validation
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                {createSettingForm.watch("useJwks") && (
                  <FormField
                    control={createSettingForm.control}
                    name="jwksUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>JWKS URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter JWKS URL"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          URL where the JWKS can be retrieved
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={createSettingForm.control}
                  name="rotationFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Rotation Frequency (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        How often the keys should be rotated (0 = manual rotation only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createSettingForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Enable or disable this JWT setting
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
                    control={createSettingForm.control}
                    name="defaultSettings"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Default</FormLabel>
                          <FormDescription>
                            Make this the default JWT setting
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
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSettingMutation.isPending}>
                    {createSettingMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Edit Setting Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit JWT Setting</DialogTitle>
              <DialogDescription>
                Update the configuration for this JWT setting
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
            <Form {...editSettingForm}>
              <form onSubmit={editSettingForm.handleSubmit(onEditSettingSubmit)} className="space-y-4">
                <FormField
                  control={editSettingForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter setting name" {...field} />
                      </FormControl>
                      <FormDescription>A unique name for this JWT setting</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editSettingForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter setting description"
                          className="resize-none"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>Optional description for this JWT setting</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editSettingForm.control}
                    name="issuer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuer</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter issuer (iss claim)"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Identifies the issuer of the JWT
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editSettingForm.control}
                    name="audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audience</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter audience (aud claim)"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Identifies the recipients of the JWT
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editSettingForm.control}
                    name="tokenLifetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Lifetime (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={60}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          How long the token is valid for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editSettingForm.control}
                    name="refreshTokenLifetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Refresh Token Lifetime (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={300}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          How long the refresh token is valid for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editSettingForm.control}
                  name="signingAlgorithm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signing Algorithm</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a signing algorithm" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="RS256">RS256 (RSA + SHA256)</SelectItem>
                          <SelectItem value="RS384">RS384 (RSA + SHA384)</SelectItem>
                          <SelectItem value="RS512">RS512 (RSA + SHA512)</SelectItem>
                          <SelectItem value="HS256">HS256 (HMAC + SHA256)</SelectItem>
                          <SelectItem value="HS384">HS384 (HMAC + SHA384)</SelectItem>
                          <SelectItem value="HS512">HS512 (HMAC + SHA512)</SelectItem>
                          <SelectItem value="ES256">ES256 (ECDSA + SHA256)</SelectItem>
                          <SelectItem value="ES384">ES384 (ECDSA + SHA384)</SelectItem>
                          <SelectItem value="ES512">ES512 (ECDSA + SHA512)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Algorithm used to sign the JWT
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editSettingForm.control}
                  name="useJwks"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Use JWKS for key management
                        </FormLabel>
                        <FormDescription>
                          Use a JWKS (JSON Web Key Set) URL to retrieve keys for token validation
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                {editSettingForm.watch("useJwks") && (
                  <FormField
                    control={editSettingForm.control}
                    name="jwksUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>JWKS URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter JWKS URL"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          URL where the JWKS can be retrieved
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={editSettingForm.control}
                  name="rotationFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Rotation Frequency (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        How often the keys should be rotated (0 = manual rotation only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editSettingForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Enable or disable this JWT setting
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
                    control={editSettingForm.control}
                    name="defaultSettings"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Default</FormLabel>
                          <FormDescription>
                            Make this the default JWT setting
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
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateSettingMutation.isPending}>
                    {updateSettingMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Claim Dialog */}
        <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {selectedClaim ? "Edit Claim Mapping" : "Create Claim Mapping"}
              </DialogTitle>
              <DialogDescription>
                {selectedClaim
                  ? "Update this claim mapping configuration"
                  : "Configure a new claim to include in your JWT tokens"}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
            <Form {...claimForm}>
              <form onSubmit={claimForm.handleSubmit(onClaimSubmit)} className="space-y-4">
                <FormField
                  control={claimForm.control}
                  name="claimName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Claim Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter claim name" {...field} />
                      </FormControl>
                      <FormDescription>
                        The name of the claim in the JWT (e.g., sub, name, roles)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={claimForm.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a source type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user_property">User Property</SelectItem>
                          <SelectItem value="user_metadata">User Metadata</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                          <SelectItem value="function">Function</SelectItem>
                          <SelectItem value="constant">Constant</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Where the claim value comes from
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={claimForm.control}
                  name="sourcePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Path</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter source path"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        {claimForm.watch("sourceType") === "user_property"
                          ? "The user property to use (e.g., id, username, email)"
                          : claimForm.watch("sourceType") === "user_metadata"
                          ? "The path in user metadata to use (e.g., profile.role)"
                          : claimForm.watch("sourceType") === "function"
                          ? "The name of the function to call"
                          : claimForm.watch("sourceType") === "constant"
                          ? "Leave empty for constants"
                          : "Custom path or expression"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={claimForm.control}
                  name="defaultValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Value</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter default value"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        The default value to use if the source value is not found
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={claimForm.control}
                  name="transform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transform</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter transform expression"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional expression to transform the value (e.g., value.toLowerCase())
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={claimForm.control}
                  name="isRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Required
                        </FormLabel>
                        <FormDescription>
                          If required, token generation will fail if this claim cannot be added
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsClaimDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createClaimMutation.isPending || updateClaimMutation.isPending}
                  >
                    {selectedClaim
                      ? updateClaimMutation.isPending
                        ? "Saving..."
                        : "Save Changes"
                      : createClaimMutation.isPending
                      ? "Creating..."
                      : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Test Token Dialog */}
        <Dialog open={isTestTokenDialogOpen} onOpenChange={setIsTestTokenDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Generate Test Token</DialogTitle>
              <DialogDescription>
                Generate a test JWT token for development and testing purposes
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
            <Form {...testTokenForm}>
              <form onSubmit={testTokenForm.handleSubmit(onTestTokenSubmit)} className="space-y-4">
                <FormField
                  control={testTokenForm.control}
                  name="payload"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Payload</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"sub": "user123", "name": "John Doe", "email": "john.doe@example.com", "roles": ["user", "admin"]}'
                          className="font-mono h-32"
                          value={JSON.stringify(field.value, null, 2)}
                          onChange={(e) => {
                            try {
                              field.onChange(JSON.parse(e.target.value));
                            } catch (error) {
                              // Ignore JSON parse errors during typing
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON object with custom claims to include in the token
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTestTokenDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={generateTestTokenMutation.isPending}>
                    {generateTestTokenMutation.isPending ? "Generating..." : "Generate Token"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            </ScrollArea>
            {testToken && (
              <div className="mt-4 space-y-4">
                <h3 className="text-lg font-medium">Generated Token</h3>
                <div className="bg-muted p-2 rounded-md relative">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                    {testToken.token}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(testToken.token)}
                  >
                    <ClipboardCopyIcon className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="text-lg font-medium">Decoded Payload</h3>
                <div className="bg-muted p-2 rounded-md">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap max-h-64">
                    {JSON.stringify(testToken.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}