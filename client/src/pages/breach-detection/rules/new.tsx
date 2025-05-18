import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, Shield } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

// Form schema
const formSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters long",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters long",
  }),
  type: z.string({
    required_error: "Please select the rule type",
  }),
  category: z.string({
    required_error: "Please select a category",
  }),
  severity: z.string({
    required_error: "Please select the severity level",
  }),
  definition: z.string()
    .min(2, { message: "Definition is required" })
    .refine(val => {
      try {
        JSON.parse(val);
        return true;
      } catch (e) {
        return false;
      }
    }, { message: "Definition must be valid JSON" }),
  isGlobal: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  metadata: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Helper component for JSON textarea with formatting
interface JsonTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

const JsonTextarea = ({ value, onChange, placeholder }: JsonTextareaProps) => {
  const [error, setError] = useState<string | null>(null);

  const formatJson = () => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e: any) {
      setError("Invalid JSON: " + e.message);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[200px] font-mono text-sm"
        />
        {error && (
          <div className="text-destructive text-sm mt-1">{error}</div>
        )}
      </div>
      <Button 
        type="button" 
        variant="outline" 
        size="sm"
        onClick={formatJson}
      >
        Format JSON
      </Button>
    </div>
  );
};

// Sample rule definitions by type
const sampleDefinitions = {
  signature: {
    timeWindow: 30, // minutes
    signatures: [
      {
        type: "security_event",
        pattern: {
          eventType: "authentication_failure",
          source: "oauth_service"
        },
        threshold: 5
      }
    ]
  },
  behavior: {
    baselineWindow: 24 * 60, // 24 hours in minutes
    deviationThreshold: 3.0, // standard deviations
    behaviorType: "access_pattern",
    minimumSampleSize: 30
  },
  anomaly: {
    algorithmType: "isolation_forest",
    parameters: {
      contamination: 0.05,
      features: ["login_time", "request_count", "ip_address_changes"]
    },
    minimumTrainingSet: 100
  },
  correlation: {
    events: [
      { type: "auth_failure", count: 3 },
      { type: "privilege_escalation", count: 1 }
    ],
    windowMinutes: 15,
    requireSequence: true
  }
};

const CreateBreachRulePage = () => {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Define form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "signature",
      category: "access_control",
      severity: "medium",
      definition: JSON.stringify(sampleDefinitions.signature, null, 2),
      isGlobal: true,
      isEnabled: true,
      metadata: "{}"
    },
  });

  // When rule type changes, update the definition with a sample
  const onRuleTypeChange = (type: string) => {
    form.setValue("type", type);
    const sample = type in sampleDefinitions 
      ? sampleDefinitions[type as keyof typeof sampleDefinitions] 
      : sampleDefinitions.signature;
    form.setValue("definition", JSON.stringify(sample, null, 2));
  };
  
  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Transform form values
      const formattedValues = {
        ...values,
        definition: JSON.parse(values.definition),
        metadata: values.metadata ? JSON.parse(values.metadata) : {},
      };

      const response = await fetch('/api/breach-detection/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedValues),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create breach detection rule');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rule created",
        description: "The breach detection rule has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/overview'] });
      setLocation('/breach-detection/rules');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create rule",
        description: error.message || "An error occurred while creating the rule.",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (values: FormValues) => {
    try {
      // Additional validation for JSON fields
      JSON.parse(values.definition);
      if (values.metadata) {
        JSON.parse(values.metadata);
      }
      createRuleMutation.mutate(values);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid JSON format",
        description: "Please ensure all JSON fields contain valid JSON.",
      });
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild className="mb-6">
          <Link to="/breach-detection/rules">
            Back to Rules
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Create Detection Rule</h1>
        <p className="text-muted-foreground">Add a new rule for automated breach detection</p>
      </div>
      
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>New Breach Detection Rule</CardTitle>
          <CardDescription>
            Configure parameters for automated breach detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic information */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Basic Information</h3>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter a descriptive name" {...field} />
                      </FormControl>
                      <FormDescription>
                        A clear, concise name for this rule
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed description of the rule purpose and detection logic"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a detailed explanation of what this rule detects
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Type</FormLabel>
                        <Select
                          onValueChange={onRuleTypeChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select rule type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="signature">Signature-based</SelectItem>
                            <SelectItem value="behavior">Behavior-based</SelectItem>
                            <SelectItem value="anomaly">Anomaly-based</SelectItem>
                            <SelectItem value="correlation">Correlation-based</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Detection methodology for this rule
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
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
                            <SelectItem value="access_control">Access Control</SelectItem>
                            <SelectItem value="authentication">Authentication</SelectItem>
                            <SelectItem value="authorization">Authorization</SelectItem>
                            <SelectItem value="data_access">Data Access</SelectItem>
                            <SelectItem value="api_usage">API Usage</SelectItem>
                            <SelectItem value="system_integrity">System Integrity</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Category for organizing rules
                        </FormDescription>
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
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Impact level when triggered
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Rule definition */}
              <div className="space-y-6 pt-4">
                <h3 className="text-lg font-medium">Rule Definition</h3>
                
                <FormField
                  control={form.control}
                  name="definition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Definition (JSON)</FormLabel>
                      <FormControl>
                        <JsonTextarea
                          value={field.value}
                          onChange={field.onChange}
                          placeholder='{"timeWindow": 30, "signatures": [{"type": "security_event"}]}'
                        />
                      </FormControl>
                      <FormDescription>
                        Technical definition of the rule logic in JSON format
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="isGlobal"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between p-4 border rounded-md">
                        <div className="space-y-0.5">
                          <FormLabel>Global Rule</FormLabel>
                          <FormDescription>
                            Apply this rule across all workspaces
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
                    name="isEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between p-4 border rounded-md">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Rule</FormLabel>
                          <FormDescription>
                            Begin detection immediately after creation
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
              </div>
              
              {/* Advanced settings */}
              <div className="space-y-6 pt-4">
                <h3 className="text-lg font-medium">Advanced Settings</h3>
                
                <FormField
                  control={form.control}
                  name="metadata"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metadata (JSON, Optional)</FormLabel>
                      <FormControl>
                        <JsonTextarea
                          value={field.value || "{}"}
                          onChange={field.onChange}
                          placeholder='{"owner": "security-team", "tags": ["production", "oauth"]}'
                        />
                      </FormControl>
                      <FormDescription>
                        Additional metadata for organization and filtering
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/breach-detection/rules')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  className="gap-2"
                >
                  {createRuleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Create Rule
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateBreachRulePage;