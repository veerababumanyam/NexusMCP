import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

// Form validation schema
const apiKeyFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.date().optional().nullable(),
});

type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>;

interface ApiKey {
  id: number;
  name: string;
  scopes: string[];
  userId: number;
  workspaceId?: number;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  isActive: boolean;
}

interface ApiKeyResponse extends ApiKey {
  key: string;
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  
  // Form for creating new API key
  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      name: "",
      scopes: [],
      expiresAt: null,
    },
  });

  // Query to get all API keys
  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
    enabled: !!user,
  });
  
  // Mutation to create a new API key
  const createApiKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyFormValues) => {
      const response = await apiRequest("POST", "/api/api-keys", data);
      return await response.json() as ApiKeyResponse;
    },
    onSuccess: (data) => {
      setNewApiKey(data.key);
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to deactivate an API key
  const deactivateApiKeyMutation = useMutation({
    mutationFn: async (keyId: number) => {
      await apiRequest("DELETE", `/api/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "API key deactivated",
        description: "The API key has been successfully deactivated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to deactivate API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle API key creation form submission
  const onSubmit = (data: ApiKeyFormValues) => {
    createApiKeyMutation.mutate(data);
  };
  
  // Handle deactivation of an API key
  const handleDeactivate = (keyId: number) => {
    if (confirm("Are you sure you want to deactivate this API key? This action cannot be undone.")) {
      deactivateApiKeyMutation.mutate(keyId);
    }
  };
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "PPpp");
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">
            Manage your API keys for programmatic access to the platform
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>Create API Key</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to authenticate your applications. API keys give access to your account, so keep them secure.
              </DialogDescription>
            </DialogHeader>
            
            {newApiKey ? (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <div className="font-mono text-sm break-all">{newApiKey}</div>
                </div>
                <p className="text-sm text-yellow-600 dark:text-yellow-500 font-semibold">
                  This key will only be displayed once. Copy it now and store it securely!
                </p>
                <DialogFooter>
                  <Button 
                    onClick={() => {
                      navigator.clipboard.writeText(newApiKey);
                      toast({
                        title: "Copied to clipboard",
                        description: "API key has been copied to your clipboard",
                      });
                    }}
                    variant="outline"
                    className="mr-2"
                  >
                    Copy to Clipboard
                  </Button>
                  <Button 
                    onClick={() => {
                      setNewApiKey(null);
                      setIsCreateOpen(false);
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My API Key" {...field} />
                        </FormControl>
                        <FormDescription>
                          A descriptive name to help you identify this key
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button type="submit" disabled={createApiKeyMutation.isPending}>
                      {createApiKeyMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create API Key
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            API keys are used to authenticate your applications with the NexusMCP platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !apiKeys || apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                You don't have any API keys yet.
              </p>
              <Button 
                onClick={() => setIsCreateOpen(true)} 
                variant="outline" 
                className="mt-4"
              >
                Create your first API key
              </Button>
            </div>
          ) : (
            <Table>
              <TableCaption>A list of your API keys</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell>{formatDate(key.lastUsedAt)}</TableCell>
                    <TableCell>{key.expiresAt ? formatDate(key.expiresAt) : "Never"}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${key.isActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"}`}>
                        {key.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {key.isActive && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeactivate(key.id)}
                          disabled={deactivateApiKeyMutation.isPending}
                        >
                          {deactivateApiKeyMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Note:</strong> API keys give full access to your account. Keep them secure and never share them publicly.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}