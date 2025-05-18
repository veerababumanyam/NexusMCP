import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, FileText, Trash, Upload, Plus, Download, ExternalLink, RefreshCw, CircleCheck, CircleX } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

// Define the interface for file storage integrations
interface FileStorageIntegration {
  id: number;
  name: string;
  description: string | null;
  provider: "sharepoint" | "box" | "dropbox" | "google_drive" | "onedrive";
  tenantId: string | null;
  driveId: string | null;
  siteId: string | null;
  rootFolderId: string | null;
  authType: string;
  authConfig: Record<string, any>;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  isActive: boolean;
  defaultIntegration: boolean;
  connectionStatus: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
  updatedBy: number | null;
}

// Define the interface for file metadata
interface FileMetadata {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  folder?: boolean;
  path: string;
  parentId?: string;
  downloadUrl?: string;
  webViewUrl?: string;
  thumbnailUrl?: string;
  createdTime?: Date;
  modifiedTime?: Date;
  createdBy?: string;
  modifiedBy?: string;
}

// Define the form schema for creating/updating an integration
const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  description: z.string().optional(),
  provider: z.enum(["sharepoint", "box", "dropbox", "google_drive", "onedrive"], {
    message: "Please select a provider.",
  }),
  authType: z.enum(["oauth2", "api_key", "service_account"], {
    message: "Please select an authentication type.",
  }),
  tenantId: z.string().optional(),
  driveId: z.string().optional(),
  siteId: z.string().optional(),
  rootFolderId: z.string().optional(),
  authConfig: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true),
  defaultIntegration: z.boolean().default(false),
});

export default function FileStoragePage() {
  const [activeTab, setActiveTab] = useState("integrations");
  const [selectedIntegration, setSelectedIntegration] = useState<FileStorageIntegration | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  // Form for adding/editing an integration
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      provider: undefined,
      authType: undefined,
      isActive: true,
      defaultIntegration: false,
    },
  });

  // Query to fetch all integrations
  const { data: integrations, isLoading: isLoadingIntegrations } = useQuery({
    queryKey: ["/api/file-storage/integrations"],
    queryFn: async () => {
      const response = await fetch("/api/file-storage/integrations");
      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }
      return response.json() as Promise<FileStorageIntegration[]>;
    },
  });

  // Query to fetch files in the current folder
  const { data: files, isLoading: isLoadingFiles } = useQuery({
    queryKey: ["/api/file-storage/files", selectedIntegration?.id, currentFolder],
    queryFn: async () => {
      if (!selectedIntegration) return null;
      const url = `/api/file-storage/integrations/${selectedIntegration.id}/files${currentFolder ? `?folderId=${currentFolder}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      return response.json() as Promise<FileMetadata[]>;
    },
    enabled: !!selectedIntegration,
  });

  // Mutation to create a new integration
  const createIntegrationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await fetch("/api/file-storage/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create integration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-storage/integrations"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Integration created",
        description: "File storage integration has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to update an integration
  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FileStorageIntegration> }) => {
      const response = await fetch(`/api/file-storage/integrations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update integration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-storage/integrations"] });
      toast({
        title: "Integration updated",
        description: "File storage integration has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete an integration
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/file-storage/integrations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete integration");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-storage/integrations"] });
      setIsDeleteDialogOpen(false);
      setSelectedIntegration(null);
      toast({
        title: "Integration deleted",
        description: "File storage integration has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to test the connection
  const testConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/file-storage/integrations/${id}/test`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to test connection");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection successful" : "Connection failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/file-storage/integrations"] });
    },
    onError: (error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to create a new folder
  const createFolderMutation = useMutation({
    mutationFn: async ({ integrationId, parentFolderId, folderName }: { integrationId: number; parentFolderId: string; folderName: string }) => {
      const response = await fetch(`/api/file-storage/integrations/${integrationId}/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parentFolderId, folderName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-storage/files", selectedIntegration?.id, currentFolder] });
      setIsNewFolderDialogOpen(false);
      setNewFolderName("");
      toast({
        title: "Folder created",
        description: "New folder has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create folder",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to upload a file
  const uploadFileMutation = useMutation({
    mutationFn: async ({ integrationId, folderPath, file }: { integrationId: number; folderPath: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folderPath", folderPath);

      const response = await fetch(`/api/file-storage/integrations/${integrationId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload file");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-storage/files", selectedIntegration?.id, currentFolder] });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      toast({
        title: "File uploaded",
        description: "File has been uploaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to upload file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a file
  const deleteFileMutation = useMutation({
    mutationFn: async ({ integrationId, fileId }: { integrationId: number; fileId: string }) => {
      const response = await fetch(`/api/file-storage/integrations/${integrationId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete file");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/file-storage/files", selectedIntegration?.id, currentFolder] });
      toast({
        title: "File deleted",
        description: "File has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler for form submission
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createIntegrationMutation.mutate(values);
  };

  // Handler for entering a folder
  const handleFolderClick = (folder: FileMetadata) => {
    setCurrentFolder(folder.id);
    setFolderPath([...folderPath, folder.name]);
  };

  // Handler for going back to a parent folder
  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      // Root folder
      setCurrentFolder(null);
      setFolderPath([]);
    } else {
      // Navigate to specific folder in the path
      setFolderPath(folderPath.slice(0, index + 1));
      // You would need to have the folder IDs stored alongside names to properly navigate
      // For now, we'll just go back to the root as an example
      setCurrentFolder(null);
    }
  };

  // Handler for creating a new folder
  const handleCreateFolder = () => {
    if (!selectedIntegration) return;
    createFolderMutation.mutate({
      integrationId: selectedIntegration.id,
      parentFolderId: currentFolder || selectedIntegration.rootFolderId || "/",
      folderName: newFolderName,
    });
  };

  // Handler for uploading a file
  const handleFileUpload = () => {
    if (!selectedIntegration || !uploadFile) return;
    uploadFileMutation.mutate({
      integrationId: selectedIntegration.id,
      folderPath: currentFolder || selectedIntegration.rootFolderId || "/",
      file: uploadFile,
    });
  };

  // Get the display name for a provider
  const getProviderDisplayName = (provider: string) => {
    const providers: Record<string, string> = {
      sharepoint: "SharePoint",
      box: "Box",
      dropbox: "Dropbox Business",
      google_drive: "Google Drive",
      onedrive: "OneDrive for Business",
    };
    return providers[provider] || provider;
  };

  // Format file size
  const formatFileSize = (size?: number) => {
    if (!size) return "Unknown";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <PageContainer
      title="Enterprise File Storage"
      description="Connect and manage enterprise file storage solutions"
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/integrations">Integrations</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/integrations/file-storage">File Storage</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="grid gap-4">
        <Tabs defaultValue="integrations" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="browser" disabled={!selectedIntegration}>File Browser</TabsTrigger>
              <TabsTrigger value="logs" disabled={!selectedIntegration}>Activity Logs</TabsTrigger>
            </TabsList>

            {activeTab === "integrations" && (
              <Button onClick={() => setIsAddDialogOpen(true)}>Add Integration</Button>
            )}

            {activeTab === "browser" && selectedIntegration && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsNewFolderDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" /> New Folder
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(true)}
                >
                  <Upload className="mr-2 h-4 w-4" /> Upload File
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/file-storage/files", selectedIntegration?.id, currentFolder] });
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="integrations" className="mt-4">
            <div className="grid gap-4">
              {isLoadingIntegrations ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Skeleton className="h-10 w-full" />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integrations && integrations.length > 0 ? (
                    integrations.map((integration) => (
                      <Card
                        key={integration.id}
                        className={`cursor-pointer hover:shadow-md transition-shadow ${selectedIntegration?.id === integration.id ? "border-primary" : ""}`}
                        onClick={() => {
                          setSelectedIntegration(integration);
                          setCurrentFolder(null);
                          setFolderPath([]);
                          setActiveTab("browser");
                        }}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{integration.name}</CardTitle>
                              <CardDescription>{getProviderDisplayName(integration.provider)}</CardDescription>
                            </div>
                            <Badge variant={integration.isActive ? "default" : "outline"}>
                              {integration.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm space-y-2">
                            <div className="text-muted-foreground">
                              {integration.description || "No description provided"}
                            </div>
                            <div className="flex items-center">
                              <div className="text-xs mr-2">Connection Status:</div>
                              <Badge variant={integration.connectionStatus === "connected" ? "default" : "destructive"}>
                                {integration.connectionStatus || "Unknown"}
                              </Badge>
                            </div>
                            {integration.lastSyncedAt && (
                              <div className="text-xs text-muted-foreground">
                                Last Synced: {format(new Date(integration.lastSyncedAt), "MMM d, yyyy h:mm a")}
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            testConnectionMutation.mutate(integration.id);
                          }}>
                            Test Connection
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            setIsDeleteDialogOpen(true);
                            setSelectedIntegration(integration);
                          }}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <Card className="col-span-full">
                      <CardHeader>
                        <CardTitle>No Integrations</CardTitle>
                        <CardDescription>You haven't added any file storage integrations yet.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">
                          Add a new integration to connect with enterprise file storage solutions like SharePoint, Box, Dropbox Business, Google Drive, and OneDrive for Business.
                        </p>
                      </CardContent>
                      <CardFooter>
                        <Button onClick={() => setIsAddDialogOpen(true)}>Add Integration</Button>
                      </CardFooter>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="browser" className="mt-4">
            {selectedIntegration ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>{selectedIntegration.name}</CardTitle>
                        <CardDescription>{getProviderDisplayName(selectedIntegration.provider)}</CardDescription>
                      </div>
                      <Badge variant={selectedIntegration.connectionStatus === "connected" ? "default" : "destructive"}>
                        {selectedIntegration.connectionStatus || "Unknown"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2 pb-4">
                      <Breadcrumb>
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <BreadcrumbLink onClick={() => handleBreadcrumbClick(0)}>Root</BreadcrumbLink>
                          </BreadcrumbItem>
                          {folderPath.map((folder, i) => (
                            <>
                              <BreadcrumbSeparator />
                              <BreadcrumbItem key={i}>
                                <BreadcrumbLink onClick={() => handleBreadcrumbClick(i)}>{folder}</BreadcrumbLink>
                              </BreadcrumbItem>
                            </>
                          ))}
                        </BreadcrumbList>
                      </Breadcrumb>
                    </div>

                    {isLoadingFiles ? (
                      <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center p-2 border rounded">
                            <Skeleton className="h-6 w-6 mr-2" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {files && files.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Modified</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {files.map((file) => (
                                <TableRow key={file.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center">
                                      {file.folder ? (
                                        <Folder className="mr-2 h-4 w-4 text-blue-500" />
                                      ) : (
                                        <FileText className="mr-2 h-4 w-4 text-gray-500" />
                                      )}
                                      <span 
                                        className={file.folder ? "cursor-pointer hover:underline text-blue-600" : ""}
                                        onClick={() => file.folder && handleFolderClick(file)}
                                      >
                                        {file.name}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{file.folder ? "Folder" : (file.mimeType || "Unknown")}</TableCell>
                                  <TableCell>{file.folder ? "-" : formatFileSize(file.size)}</TableCell>
                                  <TableCell>
                                    {file.modifiedTime 
                                      ? format(new Date(file.modifiedTime), "MMM d, yyyy h:mm a") 
                                      : "Unknown"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end space-x-2">
                                      {!file.folder && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button size="icon" variant="ghost" onClick={() => {
                                                if (file.downloadUrl) {
                                                  window.open(`/api/file-storage/integrations/${selectedIntegration.id}/files/${file.id}/download`, "_blank");
                                                }
                                              }}>
                                                <Download className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Download</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}

                                      {!file.folder && file.webViewUrl && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button size="icon" variant="ghost" onClick={() => {
                                                if (file.webViewUrl) {
                                                  window.open(file.webViewUrl, "_blank");
                                                }
                                              }}>
                                                <ExternalLink className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>View Online</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button size="icon" variant="ghost" onClick={() => {
                                              if (selectedIntegration) {
                                                deleteFileMutation.mutate({
                                                  integrationId: selectedIntegration.id,
                                                  fileId: file.id,
                                                });
                                              }
                                            }}>
                                              <Trash className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Delete</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No files or folders found in this directory.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Integration Selected</CardTitle>
                  <CardDescription>Select an integration to browse files</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Please select an integration from the Integrations tab to browse files and folders.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            {selectedIntegration ? (
              <Card>
                <CardHeader>
                  <CardTitle>Activity Logs</CardTitle>
                  <CardDescription>File operations for {selectedIntegration.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <div className="bg-background px-2 text-xs text-muted-foreground">
                        This feature will show audit logs for file operations
                      </div>
                    </div>
                  </div>
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Activity logs for file operations will be displayed here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Integration Selected</CardTitle>
                  <CardDescription>Select an integration to view activity logs</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Please select an integration from the Integrations tab to view activity logs.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Integration Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Add File Storage Integration</DialogTitle>
              <DialogDescription>
                Connect to enterprise file storage providers like SharePoint, Box, Dropbox Business, Google Drive, and OneDrive for Business.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enterprise SharePoint" {...field} />
                      </FormControl>
                      <FormDescription>
                        A name to identify this integration.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Corporate document storage" {...field} />
                      </FormControl>
                      <FormDescription>
                        A brief description of this integration.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sharepoint">SharePoint</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
                          <SelectItem value="dropbox">Dropbox Business</SelectItem>
                          <SelectItem value="google_drive">Google Drive</SelectItem>
                          <SelectItem value="onedrive">OneDrive for Business</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the file storage provider to connect with.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="authType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select authentication type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                          <SelectItem value="api_key">API Key</SelectItem>
                          <SelectItem value="service_account">Service Account</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose how to authenticate with the provider.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("provider") === "sharepoint" && (
                  <>
                    <FormField
                      control={form.control}
                      name="tenantId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant ID</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            The Microsoft 365 tenant ID.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="siteId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site ID</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            The SharePoint site ID.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {form.watch("provider") === "onedrive" && (
                  <FormField
                    control={form.control}
                    name="driveId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drive ID</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          The OneDrive drive ID.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Enable or disable this integration.
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
                  name="defaultIntegration"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Default Integration</FormLabel>
                        <FormDescription>
                          Set as the default file storage integration.
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

                <DialogFooter>
                  <Button type="submit" disabled={createIntegrationMutation.isPending}>
                    {createIntegrationMutation.isPending && (
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    Add Integration
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the integration "{selectedIntegration?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedIntegration) {
                    deleteIntegrationMutation.mutate(selectedIntegration.id);
                  }
                }}
                disabled={deleteIntegrationMutation.isPending}
              >
                {deleteIntegrationMutation.isPending && (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Folder Dialog */}
        <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Enter a name for the new folder.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="folderName">Folder Name</Label>
                <Input
                  id="folderName"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New Folder"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsNewFolderDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName || createFolderMutation.isPending}
              >
                {createFolderMutation.isPending && (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                Create Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload File Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
              <DialogDescription>
                Select a file to upload to the current folder.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
              {uploadFile && (
                <div className="text-sm">
                  <p className="font-medium">Selected File:</p>
                  <p>{uploadFile.name} ({formatFileSize(uploadFile.size)})</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsUploadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFileUpload}
                disabled={!uploadFile || uploadFileMutation.isPending}
              >
                {uploadFileMutation.isPending && (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}