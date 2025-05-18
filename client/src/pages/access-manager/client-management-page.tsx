import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { 
  Loader2, 
  MoreVertical, 
  Plus, 
  Trash, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  ShieldAlert,
  Key,
  RefreshCw,
  Shield,
  LogOut,
  UserCheck,
  Settings
} from 'lucide-react';

interface OAuthClient {
  id: number;
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  scopes: string[];
  isConfidential: boolean;
  isAutoApprove: boolean;
  isEnabled: boolean;
  userId?: number;
  createdAt: string;
  updatedAt: string;
}

interface ClientCertificate {
  id: number;
  clientId: number;
  certificateThumbprint: string;
  certificateSubject: string;
  certificateIssuer: string;
  certificateSerial: string;
  certificateNotBefore: string;
  certificateNotAfter: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form validation schemas
const createClientSchema = z.object({
  clientName: z.string().min(3, "Client name must be at least 3 characters"),
  redirectUris: z.array(z.object({
    value: z.string().url("Must be a valid URL")
  })).min(1, "At least one redirect URI is required"),
  grantTypes: z.array(z.string()).min(1, "At least one grant type is required"),
  scopes: z.array(z.object({
    value: z.string().min(1, "Scope cannot be empty")
  })).min(1, "At least one scope is required"),
  isConfidential: z.boolean().default(true),
  isAutoApprove: z.boolean().default(false)
});

type CreateClientFormValues = z.infer<typeof createClientSchema>;

const createCertificateSchema = z.object({
  clientId: z.string().uuid("Must be a valid UUID"),
  thumbprint: z.string().min(8, "Certificate thumbprint must be at least 8 characters"),
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  issuer: z.string().min(3, "Issuer must be at least 3 characters"),
  serial: z.string().min(3, "Serial must be at least 3 characters"),
  notBefore: z.string(),
  notAfter: z.string()
});

type CreateCertificateFormValues = z.infer<typeof createCertificateSchema>;

export default function ClientManagementPage() {
  const { toast } = useToast();
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = useState(false);
  const [isCreateCertificateDialogOpen, setIsCreateCertificateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<OAuthClient | null>(null);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newClientSecret, setNewClientSecret] = useState('');
  
  // Create client form
  const createClientForm = useForm<CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      clientName: '',
      redirectUris: [{ value: '' }],
      grantTypes: ['authorization_code'],
      scopes: [{ value: 'profile' }, { value: 'email' }],
      isConfidential: true,
      isAutoApprove: false
    }
  });
  
  // Field arrays for dynamic form fields
  const { fields: redirectUriFields, append: appendRedirectUri, remove: removeRedirectUri } =
    useFieldArray({ name: 'redirectUris', control: createClientForm.control });
  
  const { fields: scopeFields, append: appendScope, remove: removeScope } =
    useFieldArray({ name: 'scopes', control: createClientForm.control });
  
  // Create certificate form
  const createCertificateForm = useForm<CreateCertificateFormValues>({
    resolver: zodResolver(createCertificateSchema),
    defaultValues: {
      clientId: '',
      thumbprint: '',
      subject: '',
      issuer: '',
      serial: '',
      notBefore: new Date().toISOString().split('T')[0],
      notAfter: new Date(Date.now() + 31536000000).toISOString().split('T')[0] // 1 year from now
    }
  });
  
  // Query to fetch all clients
  const { 
    data: clients, 
    isLoading: clientsLoading,
    error: clientsError
  } = useQuery<OAuthClient[]>({
    queryKey: ['/api/access-manager/clients'],
    enabled: false, // Initially disabled until API is fully implemented
  });
  
  // Query to fetch certificates for selected client
  const {
    data: certificates,
    isLoading: certificatesLoading,
    error: certificatesError
  } = useQuery<ClientCertificate[]>({
    queryKey: ['/api/access-manager/clients', selectedClient?.id, 'certificates'],
    enabled: false, // Initially disabled until API is fully implemented
  });
  
  // Mutation to create a new client (placeholder)
  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      // Placeholder for actual API call
      console.log('Creating client with data:', data);
      return { id: 1, ...data, clientId: 'demo-client-id' };
    },
    onSuccess: () => {
      setIsCreateClientDialogOpen(false);
      createClientForm.reset();
      toast({
        title: 'Client created',
        description: 'OAuth client has been created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create client',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Handler to submit create client form
  const handleCreateClient = (values: CreateClientFormValues) => {
    // Transform form data to match API expectations
    const transformedData = {
      clientName: values.clientName,
      redirectUris: values.redirectUris.map(uri => uri.value),
      grantTypes: values.grantTypes,
      scopes: values.scopes.map(scope => scope.value),
      isConfidential: values.isConfidential,
      isAutoApprove: values.isAutoApprove
    };
    
    createClientMutation.mutate(transformedData);
  };
  
  // Helper to format datetime strings
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };
  
  // Sample data for demonstration
  const sampleClients: OAuthClient[] = [
    {
      id: 1,
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      clientName: 'Admin Dashboard',
      redirectUris: ['https://dashboard.example.com/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['profile', 'email', 'admin'],
      isConfidential: true,
      isAutoApprove: true,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      clientId: '550e8400-e29b-41d4-a716-446655440001',
      clientName: 'Mobile App',
      redirectUris: ['com.example.app://callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['profile', 'email', 'read'],
      isConfidential: false,
      isAutoApprove: false,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      clientId: '550e8400-e29b-41d4-a716-446655440002',
      clientName: 'External Service',
      redirectUris: ['https://external-service.example.com/oauth/callback'],
      grantTypes: ['client_credentials'],
      scopes: ['api:read', 'api:write'],
      isConfidential: true,
      isAutoApprove: false,
      isEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  return (
    <div className="container py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OAuth Client Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage API clients, tokens, and mTLS certificates for secure access
          </p>
        </div>
        <Button onClick={() => setIsCreateClientDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>
      
      <Tabs defaultValue="clients">
        <TabsList className="mb-6">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="certificates" onClick={() => setSelectedClient(null)}>Certificates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle>Registered OAuth Clients</CardTitle>
              <CardDescription>
                These clients can access secured APIs using OAuth2 authentication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Grant Types</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {client.isConfidential ? (
                            <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
                          ) : (
                            <Unlock className="h-4 w-4 mr-2 text-muted-foreground" />
                          )}
                          {client.clientName}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{client.clientId}</TableCell>
                      <TableCell>
                        {client.isConfidential ? (
                          <Badge variant="outline">Confidential</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">Public</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {client.grantTypes.map((grant) => (
                            <Badge key={grant} variant="secondary" className="text-xs">
                              {grant}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.isEnabled ? (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-500/90">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-500 hover:bg-gray-500/90">
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem 
                              onClick={() => setSelectedClient(client)}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              {client.isEnabled ? (
                                <>
                                  <ShieldAlert className="mr-2 h-4 w-4" />
                                  Disable Client
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  Enable Client
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {client.isAutoApprove ? (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Disable Auto-Approve
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Enable Auto-Approve
                                </>
                              )}
                            </DropdownMenuItem>
                            {client.isConfidential && (
                              <DropdownMenuItem onClick={() => {
                                setNewClientSecret('e8f8a2d8fb4542f09764c9b61de59c54b11a361fb84cfe76ba3ef83cf3a5cbcf');
                                setSecretDialogOpen(true);
                              }}>
                                <Key className="mr-2 h-4 w-4" />
                                Regenerate Secret
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                createCertificateForm.setValue('clientId', client.clientId);
                                setIsCreateCertificateDialogOpen(true);
                              }}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Add Certificate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-red-500 focus:text-red-500"
                                >
                                  <Trash className="mr-2 h-4 w-4" />
                                  Delete Client
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the client "{client.clientName}" and revoke all its access tokens.
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {selectedClient && (
            <Card className="mt-8">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Client Details: {selectedClient.clientName}</CardTitle>
                    <CardDescription>
                      Client ID: <span className="font-mono">{selectedClient.clientId}</span>
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                  >
                    Close Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Configuration</h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Client Type</Label>
                        <p>{selectedClient.isConfidential ? 'Confidential (with secret)' : 'Public (no secret)'}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Status</Label>
                        <div className="flex items-center mt-1">
                          <Switch 
                            checked={selectedClient.isEnabled}
                            id="client-status"
                          />
                          <Label htmlFor="client-status" className="ml-2">
                            {selectedClient.isEnabled ? 'Enabled' : 'Disabled'}
                          </Label>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Auto-Approve</Label>
                        <div className="flex items-center mt-1">
                          <Switch 
                            checked={selectedClient.isAutoApprove}
                            id="auto-approve"
                          />
                          <Label htmlFor="auto-approve" className="ml-2">
                            {selectedClient.isAutoApprove ? 'Enabled (Skips consent screen)' : 'Disabled (Shows consent screen)'}
                          </Label>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Created At</Label>
                        <p>{formatDate(selectedClient.createdAt)}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Last Updated</Label>
                        <p>{formatDate(selectedClient.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Authentication Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Authorized Redirect URIs</Label>
                        <ul className="mt-1 space-y-1">
                          {selectedClient.redirectUris.map((uri, index) => (
                            <li key={index} className="text-sm font-mono bg-muted p-1 rounded">
                              {uri}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Authorized Grant Types</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedClient.grantTypes.map((grant, index) => (
                            <Badge key={index} variant="secondary">
                              {grant}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Authorized Scopes</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedClient.scopes.map((scope, index) => (
                            <Badge key={index} variant="outline">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Client Certificates (mTLS)</h3>
                  
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-md">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No certificates registered for this client.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => {
                        createCertificateForm.setValue('clientId', selectedClient.clientId);
                        setIsCreateCertificateDialogOpen(true);
                      }}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Register Certificate
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                {selectedClient.isConfidential && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewClientSecret('e8f8a2d8fb4542f09764c9b61de59c54b11a361fb84cfe76ba3ef83cf3a5cbcf');
                      setSecretDialogOpen(true);
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate Secret
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash className="mr-2 h-4 w-4" />
                      Delete Client
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the client "{selectedClient.clientName}" and revoke all its access tokens.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => setSelectedClient(null)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="certificates">
          <Card>
            <CardHeader>
              <CardTitle>mTLS Certificates</CardTitle>
              <CardDescription>
                Mutual TLS certificates provide an additional layer of security for confidential clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 p-6 rounded-lg text-center">
                <div className="flex flex-col items-center justify-center">
                  <Shield className="h-12 w-12 mb-4 text-primary opacity-80" />
                  <h3 className="text-lg font-medium mb-2">Certificate Management</h3>
                  <p className="max-w-md mx-auto text-muted-foreground mb-6">
                    Certificates can be managed from the client details view. Select a client from the Clients tab
                    to view and manage its certificates.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateCertificateDialogOpen(true)}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Register New Certificate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create Client Dialog */}
      <Dialog open={isCreateClientDialogOpen} onOpenChange={setIsCreateClientDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New OAuth Client</DialogTitle>
            <DialogDescription>
              Register a new client application that can access the API using OAuth 2.0
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={createClientForm.handleSubmit(handleCreateClient)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input 
                  id="clientName"
                  placeholder="My Application"
                  {...createClientForm.register('clientName')}
                />
                {createClientForm.formState.errors.clientName && (
                  <p className="text-sm font-medium text-destructive">
                    {createClientForm.formState.errors.clientName.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Client Type</Label>
                <div className="flex items-center space-x-2">
                  <Controller
                    control={createClientForm.control}
                    name="isConfidential"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="client-type"
                      />
                    )}
                  />
                  <Label htmlFor="client-type">
                    {createClientForm.watch('isConfidential') 
                      ? 'Confidential (with client secret)' 
                      : 'Public (no client secret)'}
                  </Label>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Redirect URIs</Label>
              <div className="space-y-2">
                {redirectUriFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder="https://example.com/callback"
                      {...createClientForm.register(`redirectUris.${index}.value`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRedirectUri(index)}
                      disabled={redirectUriFields.length === 1}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {createClientForm.formState.errors.redirectUris && (
                  <p className="text-sm font-medium text-destructive">
                    {typeof createClientForm.formState.errors.redirectUris === 'string'
                      ? String(createClientForm.formState.errors.redirectUris || '')
                      : 'Please enter at least one valid redirect URI'}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendRedirectUri({ value: '' })}
                className="mt-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Redirect URI
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Authorized Grant Types</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Controller
                    control={createClientForm.control}
                    name="grantTypes"
                    render={({ field }) => (
                      <Checkbox
                        id="grant-auth-code"
                        checked={field.value.includes('authorization_code')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange([...field.value, 'authorization_code']);
                          } else {
                            field.onChange(field.value.filter(val => val !== 'authorization_code'));
                          }
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="grant-auth-code">Authorization Code</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Controller
                    control={createClientForm.control}
                    name="grantTypes"
                    render={({ field }) => (
                      <Checkbox
                        id="grant-client-creds"
                        checked={field.value.includes('client_credentials')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange([...field.value, 'client_credentials']);
                          } else {
                            field.onChange(field.value.filter(val => val !== 'client_credentials'));
                          }
                        }}
                        disabled={!createClientForm.watch('isConfidential')}
                      />
                    )}
                  />
                  <Label htmlFor="grant-client-creds" className={!createClientForm.watch('isConfidential') ? 'text-muted-foreground' : ''}>
                    Client Credentials
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Controller
                    control={createClientForm.control}
                    name="grantTypes"
                    render={({ field }) => (
                      <Checkbox
                        id="grant-refresh"
                        checked={field.value.includes('refresh_token')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange([...field.value, 'refresh_token']);
                          } else {
                            field.onChange(field.value.filter(val => val !== 'refresh_token'));
                          }
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="grant-refresh">Refresh Token</Label>
                </div>
              </div>
              {createClientForm.formState.errors.grantTypes && (
                <p className="text-sm font-medium text-destructive">
                  Please select at least one grant type
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Authorized Scopes</Label>
              <div className="space-y-2">
                {scopeFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Enter scope"
                      {...createClientForm.register(`scopes.${index}.value`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeScope(index)}
                      disabled={scopeFields.length === 1}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {createClientForm.formState.errors.scopes && (
                  <p className="text-sm font-medium text-destructive">
                    {typeof createClientForm.formState.errors.scopes === 'string'
                      ? String(createClientForm.formState.errors.scopes || '')
                      : 'Please enter at least one scope'}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendScope({ value: '' })}
                className="mt-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Scope
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Controller
                  control={createClientForm.control}
                  name="isAutoApprove"
                  render={({ field }) => (
                    <Checkbox
                      id="auto-approve"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="auto-approve">
                  Auto-approve consent (skips user approval screen)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Only enable for trusted first-party applications
              </p>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateClientDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createClientMutation.isPending}
              >
                {createClientMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Create Certificate Dialog */}
      <Dialog open={isCreateCertificateDialogOpen} onOpenChange={setIsCreateCertificateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Client Certificate</DialogTitle>
            <DialogDescription>
              Register a new client certificate for mTLS authentication
            </DialogDescription>
          </DialogHeader>
          
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client</Label>
              <Select disabled={!!selectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {sampleClients.map((client) => (
                    <SelectItem key={client.clientId} value={client.clientId}>
                      {client.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="thumbprint">Certificate Thumbprint</Label>
              <Input 
                id="thumbprint"
                placeholder="SHA-1 or SHA-256 thumbprint"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input 
                id="subject"
                placeholder="CN=example.com, O=Example Inc"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="issuer">Issuer</Label>
              <Input 
                id="issuer"
                placeholder="CN=Example CA"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input 
                id="serial"
                placeholder="00:11:22:33:44:55"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="notBefore">Valid From</Label>
                <Input 
                  id="notBefore"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notAfter">Valid Until</Label>
                <Input 
                  id="notAfter"
                  type="date"
                  defaultValue={new Date(Date.now() + 31536000000).toISOString().split('T')[0]}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateCertificateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button">
                Register Certificate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Client Secret Dialog */}
      <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Secret Generated</DialogTitle>
            <DialogDescription>
              Save this client secret immediately. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md overflow-x-auto">
            <code className="font-mono text-sm break-all">{newClientSecret}</code>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecretDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}