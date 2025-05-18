import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

// Form schema
const formSchema = z.object({
  title: z.string().min(5, {
    message: "Title must be at least 5 characters long",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters long",
  }),
  detectionType: z.string({
    required_error: "Please select the detection type",
  }),
  severity: z.string({
    required_error: "Please select the severity level",
  }),
  source: z.string({
    required_error: "Please select the source",
  }),
  affectedResources: z.string().optional(),
  evidence: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const CreateBreachPage = () => {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Define form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      detectionType: "manual",
      severity: "medium",
      source: "manual",
      affectedResources: "",
      evidence: ""
    },
  });
  
  // Create breach mutation
  const createBreachMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Parse and transform form values
      const formattedValues = {
        ...values,
        affectedResources: values.affectedResources ? values.affectedResources.split(',').map(r => r.trim()) : [],
        evidence: values.evidence ? JSON.parse(values.evidence) : {},
      };

      const response = await fetch('/api/breach-detection/breaches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedValues),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create breach detection');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Breach created",
        description: "The breach detection has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/overview'] });
      setLocation('/breach-detection');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create breach",
        description: error.message || "An error occurred while creating the breach detection.",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (values: FormValues) => {
    try {
      // Validate JSON format for evidence if provided
      if (values.evidence) {
        JSON.parse(values.evidence);
      }
      createBreachMutation.mutate(values);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid JSON format",
        description: "The evidence field must contain valid JSON.",
      });
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild className="mb-6">
          <Link to="/breach-detection">
            Back to Breach Detection
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Create New Breach Detection</h1>
        <p className="text-muted-foreground">Manually create a new security breach detection record</p>
      </div>
      
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>New Breach Detection</CardTitle>
          <CardDescription>
            Enter the details for the security breach detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a descriptive title" {...field} />
                    </FormControl>
                    <FormDescription>
                      A clear, concise name for the security breach
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="detectionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detection Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select detection type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="behavior">Behavior-based</SelectItem>
                          <SelectItem value="signature">Signature-based</SelectItem>
                          <SelectItem value="anomaly">Anomaly-based</SelectItem>
                          <SelectItem value="correlation">Correlation-based</SelectItem>
                          <SelectItem value="manual">Manual detection</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The method used to detect the breach
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
                            <SelectValue placeholder="Select severity level" />
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
                        Impact level of the security breach
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select breach source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual entry</SelectItem>
                        <SelectItem value="oauth_event">OAuth event</SelectItem>
                        <SelectItem value="system_scan">System scan</SelectItem>
                        <SelectItem value="log_analysis">Log analysis</SelectItem>
                        <SelectItem value="threat_intel">Threat intelligence</SelectItem>
                        <SelectItem value="security_alert">Security alert</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How the breach was identified
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
                        placeholder="Detailed description of the breach"
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a detailed explanation of the security breach
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="affectedResources"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Affected Resources</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="client-id-123, workspace-1, api-key-456"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of resources affected by this breach
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="evidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evidence (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"ip_address": "192.168.1.1", "attempt_count": 5, "timestamp": "2023-04-15T12:30:45Z"}'
                        className="min-h-[150px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Technical evidence in JSON format (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/breach-detection')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBreachMutation.isPending}
                  className="gap-2"
                >
                  {createBreachMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4" />
                      Create Breach
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

export default CreateBreachPage;