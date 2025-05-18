import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Edit, RefreshCw, Eye, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Define schema for the redaction rule form
const redactionRuleSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  pattern: z.string().min(3, 'Pattern must be at least 3 characters'),
  description: z.string().optional(),
  isRegex: z.boolean().default(false),
  isCaseSensitive: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  replacementText: z.string().default('[REDACTED]'),
  phiCategory: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  workspaceId: z.number().optional()
});

type RedactionRule = z.infer<typeof redactionRuleSchema>;

// PHI Categories for select options
const phiCategories = [
  { value: 'NAME', label: 'Patient Name' },
  { value: 'DOB', label: 'Date of Birth' },
  { value: 'SSN', label: 'Social Security Number' },
  { value: 'ADDRESS', label: 'Address' },
  { value: 'PHONE', label: 'Phone Number' },
  { value: 'EMAIL', label: 'Email Address' },
  { value: 'MEDICAL_RECORD', label: 'Medical Record Number' },
  { value: 'HEALTH_PLAN', label: 'Health Plan Beneficiary Number' },
  { value: 'ACCOUNT', label: 'Account Number' },
  { value: 'LICENSE', label: 'License Number' },
  { value: 'VEHICLE', label: 'Vehicle Identifier' },
  { value: 'DEVICE', label: 'Device Identifier' },
  { value: 'URL', label: 'Web URL' },
  { value: 'IP_ADDRESS', label: 'IP Address' },
  { value: 'BIOMETRIC', label: 'Biometric Identifier' },
  { value: 'PHOTO', label: 'Full Face Photo' },
  { value: 'OTHER', label: 'Other Unique Identifier' },
];

// Severity options for select
const severityOptions = [
  { value: 'LOW', label: 'Low', color: 'bg-blue-100 text-blue-800' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'CRITICAL', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

export function PhiRedactionRuleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<RedactionRule | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Define the form for creating/editing rules
  const form = useForm<RedactionRule>({
    resolver: zodResolver(redactionRuleSchema),
    defaultValues: {
      name: '',
      pattern: '',
      description: '',
      isRegex: false,
      isCaseSensitive: false,
      isEnabled: true,
      replacementText: '[REDACTED]',
      phiCategory: 'OTHER',
      severity: 'MEDIUM',
      workspaceId: 1 // Default workspace ID for simplicity
    }
  });

  // Reset form when dialog closes
  const resetForm = () => {
    form.reset();
    setCurrentRule(null);
  };

  // Query to fetch all redaction rules
  const { data: rules, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/healthcare/phi/redaction-rules'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/healthcare/phi/redaction-rules');
      const data = await response.json();
      return data as RedactionRule[];
    }
  });

  // Mutation to create a new rule
  const createRuleMutation = useMutation({
    mutationFn: async (rule: RedactionRule) => {
      const response = await apiRequest('POST', '/api/healthcare/phi/redaction-rules', rule);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Rule Created',
        description: 'PHI redaction rule has been created successfully',
      });
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/healthcare/phi/redaction-rules'] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Failed to Create Rule',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  });

  // Mutation to update an existing rule
  const updateRuleMutation = useMutation({
    mutationFn: async (rule: RedactionRule) => {
      const response = await apiRequest('PUT', `/api/healthcare/phi/redaction-rules/${rule.workspaceId}`, rule);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Rule Updated',
        description: 'PHI redaction rule has been updated successfully',
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/healthcare/phi/redaction-rules'] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Failed to Update Rule',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  });

  // Mutation to delete a rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      const response = await apiRequest('DELETE', `/api/healthcare/phi/redaction-rules/${ruleId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Rule Deleted',
        description: 'PHI redaction rule has been deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/healthcare/phi/redaction-rules'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to Delete Rule',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  });

  // Mutation to toggle rule enabled status
  const toggleRuleStatusMutation = useMutation({
    mutationFn: async ({ ruleId, isEnabled }: { ruleId: number, isEnabled: boolean }) => {
      const response = await apiRequest('PATCH', `/api/healthcare/phi/redaction-rules/${ruleId}/status`, {
        isEnabled
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Rule Status Updated',
        description: 'PHI redaction rule status has been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/healthcare/phi/redaction-rules'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to Update Rule Status',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  });

  // Test redaction with the selected rule
  const testRedaction = async () => {
    if (!currentRule || !testInput) return;

    try {
      const response = await apiRequest('POST', '/api/healthcare/phi/test-redaction', {
        text: testInput,
        ruleId: currentRule.workspaceId
      });

      const result = await response.json();
      setTestResult(result.redactedText);
    } catch (error) {
      toast({
        title: 'Redaction Test Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  // Handle form submission for create/edit
  const onSubmit = (data: RedactionRule) => {
    if (currentRule && currentRule.workspaceId) {
      // Update existing rule
      updateRuleMutation.mutate({
        ...data,
        workspaceId: currentRule.workspaceId
      });
    } else {
      // Create new rule
      createRuleMutation.mutate(data);
    }
  };

  // Open edit dialog with current rule data
  const handleEditRule = (rule: RedactionRule) => {
    setCurrentRule(rule);
    form.reset({
      name: rule.name,
      pattern: rule.pattern,
      description: rule.description || '',
      isRegex: rule.isRegex,
      isCaseSensitive: rule.isCaseSensitive,
      isEnabled: rule.isEnabled,
      replacementText: rule.replacementText,
      phiCategory: rule.phiCategory,
      severity: rule.severity,
      workspaceId: rule.workspaceId
    });
    setIsEditDialogOpen(true);
  };

  // Filter rules based on active tab
  const filteredRules = rules?.filter(rule => {
    if (activeTab === 'all') return true;
    if (activeTab === 'enabled') return rule.isEnabled;
    if (activeTab === 'disabled') return !rule.isEnabled;
    if (activeTab === 'regex') return rule.isRegex;
    return true;
  });

  // Get badge color for severity levels
  const getSeverityBadgeClass = (severity: string) => {
    const option = severityOptions.find(opt => opt.value === severity);
    return option?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">PHI Redaction Rules</h2>
          <p className="text-muted-foreground">
            Manage automated PHI detection and redaction patterns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-[400px]">
          <TabsTrigger value="all">All Rules</TabsTrigger>
          <TabsTrigger value="enabled">Enabled</TabsTrigger>
          <TabsTrigger value="disabled">Disabled</TabsTrigger>
          <TabsTrigger value="regex">Regex</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === 'all' ? 'All Redaction Rules' : 
                 activeTab === 'enabled' ? 'Enabled Rules' : 
                 activeTab === 'disabled' ? 'Disabled Rules' : 
                 'Regex Rules'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'all' ? 'View and manage all PHI redaction rules' : 
                 activeTab === 'enabled' ? 'Currently active rules applied to PHI data' : 
                 activeTab === 'disabled' ? 'Inactive rules not currently applied' : 
                 'Rules using regular expression patterns'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : isError ? (
                <div className="flex justify-center items-center h-32 text-destructive">
                  <AlertTriangle className="h-8 w-8 mr-2" />
                  <p>Failed to load redaction rules</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Pattern</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRules && filteredRules.length > 0 ? (
                        filteredRules.map((rule) => (
                          <TableRow key={rule.workspaceId}>
                            <TableCell>
                              <Switch
                                checked={rule.isEnabled}
                                onCheckedChange={(checked) => 
                                  toggleRuleStatusMutation.mutate({ 
                                    ruleId: rule.workspaceId as number, 
                                    isEnabled: checked 
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">{rule.name}</TableCell>
                            <TableCell className="font-mono text-sm truncate max-w-[200px]">
                              {rule.pattern}
                            </TableCell>
                            <TableCell>
                              {phiCategories.find(cat => cat.value === rule.phiCategory)?.label || rule.phiCategory}
                            </TableCell>
                            <TableCell>
                              <Badge className={getSeverityBadgeClass(rule.severity)}>
                                {rule.severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {rule.isRegex ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  Regex
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  String
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleEditRule(rule)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => {
                                        setCurrentRule(rule);
                                        setTestInput('');
                                        setTestResult('');
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Test Redaction Rule</DialogTitle>
                                      <DialogDescription>
                                        Enter text to test how this rule redacts PHI
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="flex flex-col gap-2">
                                        <Label htmlFor="test-input">Test Text</Label>
                                        <Textarea
                                          id="test-input"
                                          value={testInput}
                                          onChange={(e) => setTestInput(e.target.value)}
                                          placeholder="Enter text that may contain PHI to test redaction..."
                                          rows={4}
                                        />
                                      </div>
                                      
                                      <Button onClick={testRedaction} className="w-full">
                                        <Shield className="mr-2 h-4 w-4" />
                                        Apply Redaction
                                      </Button>
                                      
                                      {testResult && (
                                        <div className="mt-4">
                                          <Label>Redacted Result:</Label>
                                          <div className="mt-2 p-3 bg-muted rounded-md whitespace-pre-wrap font-mono text-sm">
                                            {testResult}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this rule?')) {
                                      deleteRuleMutation.mutate(rule.workspaceId as number);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center">
                            No redaction rules found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create PHI Redaction Rule</DialogTitle>
            <DialogDescription>
              Define a new pattern for automatically detecting and redacting PHI
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Social Security Number Pattern" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pattern</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., \d{3}-\d{2}-\d{4}" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phiCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PHI Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {phiCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Severity</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select severity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {severityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this rule detects and why"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="replacementText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Replacement Text</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., [REDACTED]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isRegex"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Regular Expression</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Use pattern as regular expression
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isCaseSensitive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Case Sensitive</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Match exact case in pattern
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Enable Rule
                      </FormLabel>
                      <FormDescription>
                        Activate this rule for PHI redaction
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createRuleMutation.isPending}>
                  {createRuleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Rule
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit PHI Redaction Rule</DialogTitle>
            <DialogDescription>
              Modify pattern for detecting and redacting PHI
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Social Security Number Pattern" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pattern</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., \d{3}-\d{2}-\d{4}" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phiCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PHI Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {phiCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Severity</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select severity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {severityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this rule detects and why"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="replacementText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Replacement Text</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., [REDACTED]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isRegex"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Regular Expression</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Use pattern as regular expression
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isCaseSensitive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Case Sensitive</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Match exact case in pattern
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Enable Rule
                      </FormLabel>
                      <FormDescription>
                        Activate this rule for PHI redaction
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRuleMutation.isPending}>
                  {updateRuleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Rule
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}