import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Link, useLocation } from 'wouter';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  ChevronLeft,
  PackagePlus,
  AlertCircle,
  Loader2,
  X,
  Tag,
  Plus
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Form schema with validation
const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  shortDescription: z.string().max(150, 'Short description must not exceed 150 characters').optional(),
  categoryId: z.string().min(1, 'Category is required'),
  publisherId: z.string().min(1, 'Publisher is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in format x.y.z (semver)'),
  iconUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  bannerUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  websiteUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  repositoryUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  documentationUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  supportUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  licenseName: z.string().optional(),
  licenseUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  packageType: z.string().default('npm'),
  packageName: z.string().optional(),
  requiredPermissions: z.any().optional(),
  capabilities: z.any().optional(),
  tags: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

export default function SubmitConnectorPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      shortDescription: '',
      version: '1.0.0',
      packageType: 'npm',
      iconUrl: '',
      bannerUrl: '',
      websiteUrl: '',
      repositoryUrl: '',
      documentationUrl: '',
      supportUrl: '',
      licenseName: '',
      licenseUrl: '',
      tags: [],
    },
  });
  
  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();
  };
  
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'name') {
        const nameValue = value.name as string;
        if (nameValue) {
          form.setValue('slug', generateSlug(nameValue));
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);
  
  // Fetch categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/marketplace/categories'],
    queryFn: async () => {
      const response = await fetch('/api/marketplace/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      return await response.json();
    }
  });
  
  // Fetch publishers
  const { data: publishers, isLoading: isLoadingPublishers } = useQuery({
    queryKey: ['/api/marketplace/publishers'],
    queryFn: async () => {
      const response = await fetch('/api/marketplace/publishers');
      if (!response.ok) {
        throw new Error('Failed to fetch publishers');
      }
      return await response.json();
    }
  });
  
  // Fetch tags
  const { data: availableTags, isLoading: isLoadingTags } = useQuery({
    queryKey: ['/api/marketplace/tags'],
    queryFn: async () => {
      const response = await fetch('/api/marketplace/tags');
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      return await response.json();
    }
  });
  
  // Tags input state
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  
  // Add tag handler
  const handleAddTag = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      const newTags = [...selectedTags, tagId];
      setSelectedTags(newTags);
      form.setValue('tags', newTags);
    }
    setTagInput('');
  };
  
  // Remove tag handler
  const handleRemoveTag = (tagId: string) => {
    const newTags = selectedTags.filter(id => id !== tagId);
    setSelectedTags(newTags);
    form.setValue('tags', newTags);
  };
  
  // Filter tags based on input
  const filteredTags = React.useMemo(() => {
    if (!availableTags) return [];
    if (!tagInput.trim()) return availableTags;
    
    return availableTags.filter((tag: { id: number; name: string }) => 
      tag.name.toLowerCase().includes(tagInput.toLowerCase()) &&
      !selectedTags.includes(tag.id.toString())
    );
  }, [availableTags, tagInput, selectedTags]);
  
  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest('POST', '/api/marketplace/connectors', data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connector submitted successfully",
        description: "Your connector has been submitted for review.",
        variant: "default",
      });
      
      // Invalidate connector queries
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/connectors'] });
      
      // Navigate to new connector
      navigate(`/marketplace/connectors/${data.slug}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message || "There was an error submitting your connector.",
        variant: "destructive",
      });
    }
  });
  
  // Form submission handler
  const onSubmit = (values: FormValues) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to submit a connector",
        variant: "destructive"
      });
      return;
    }
    
    // Convert empty strings to undefined
    Object.keys(values).forEach(key => {
      const k = key as keyof FormValues;
      if (values[k] === '') {
        (values[k] as any) = undefined;
      }
    });
    
    // Submit form
    submitMutation.mutate(values);
  };
  
  // Check if user is authenticated
  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be signed in to submit a new connector.
          </AlertDescription>
        </Alert>
        
        <Button asChild variant="default">
          <Link href="/auth">Sign In</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/marketplace" className="text-sm font-medium text-blue-600 flex items-center hover:underline">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Marketplace
        </Link>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Submit a New Connector</h1>
          <p className="text-muted-foreground">
            Share your connector with the community to extend platform functionality
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PackagePlus className="h-5 w-5 mr-2" />
            Connector Information
          </CardTitle>
          <CardDescription>
            Provide details about your connector to help users discover and use it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium">Basic Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Connector Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="My Awesome Connector" {...field} />
                        </FormControl>
                        <FormDescription>
                          A unique and descriptive name for your connector
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Connector Slug *</FormLabel>
                        <FormControl>
                          <Input placeholder="my-awesome-connector" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL-friendly identifier (auto-generated from name)
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
                        <FormLabel>Full Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe what your connector does and why it's useful..." 
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          A detailed description of your connector's functionality and benefits
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="shortDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Description</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="A brief summary of your connector (150 chars max)" 
                            {...field}
                            maxLength={150}
                          />
                        </FormControl>
                        <FormDescription>
                          A concise description for cards and previews (max 150 characters)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator className="md:col-span-2 my-4" />
                
                {/* Classification */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium">Classification</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isLoadingCategories}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories?.map((category: { id: number; name: string }) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The primary category your connector belongs to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="publisherId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Publisher *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isLoadingPublishers}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a publisher" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {publishers?.map((publisher: { id: number; name: string }) => (
                                <SelectItem key={publisher.id} value={publisher.id.toString()}>
                                  {publisher.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The organization or individual publishing this connector
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <div className="space-y-2">
                      {/* Selected Tags */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedTags.map(tagId => {
                          const tag = availableTags?.find((t: { id: number; name: string }) => t.id.toString() === tagId);
                          return tag ? (
                            <Badge 
                              key={tag.id} 
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              <Tag className="h-3 w-3" />
                              {tag.name}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 ml-1"
                                onClick={() => handleRemoveTag(tagId)}
                              >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      
                      {/* Tag Search Input */}
                      <div className="flex gap-2">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          placeholder="Search for tags..."
                          className="flex-1"
                          disabled={isLoadingTags}
                        />
                      </div>
                      
                      {/* Tag Suggestions */}
                      {tagInput.trim() && (
                        <div className="mt-1 border rounded-md max-h-32 overflow-y-auto">
                          {filteredTags.length > 0 ? (
                            <div className="p-1">
                              {filteredTags.slice(0, 5).map((tag: { id: number; name: string }) => (
                                <Button
                                  key={tag.id}
                                  variant="ghost"
                                  className="w-full justify-start text-sm"
                                  onClick={() => handleAddTag(tag.id.toString())}
                                >
                                  <Plus className="h-3 w-3 mr-2" />
                                  {tag.name}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground p-2">
                              No matching tags found
                            </p>
                          )}
                        </div>
                      )}
                      
                      <FormDescription>
                        Add tags to help users discover your connector
                      </FormDescription>
                    </div>
                  </FormItem>
                </div>
                
                <Separator className="md:col-span-2 my-4" />
                
                {/* Version Information */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium">Version Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Version *</FormLabel>
                          <FormControl>
                            <Input placeholder="1.0.0" {...field} />
                          </FormControl>
                          <FormDescription>
                            Semantic version (x.y.z)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="packageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Package Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select package type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="npm">NPM Package</SelectItem>
                              <SelectItem value="docker">Docker Image</SelectItem>
                              <SelectItem value="binary">Binary</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            How your connector is packaged
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="packageName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Package Name</FormLabel>
                        <FormControl>
                          <Input placeholder="my-connector-package" {...field} />
                        </FormControl>
                        <FormDescription>
                          The name of the package as it appears in the registry
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator className="md:col-span-2 my-4" />
                
                {/* Resources */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-medium">Resources & Links</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="iconUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Icon URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/icon.png" {...field} />
                          </FormControl>
                          <FormDescription>
                            URL to an icon image (SVG, PNG recommended)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="bannerUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banner URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/banner.png" {...field} />
                          </FormControl>
                          <FormDescription>
                            URL to a banner image for the details page
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Homepage or official website
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="repositoryUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repository</FormLabel>
                          <FormControl>
                            <Input placeholder="https://github.com/example/repo" {...field} />
                          </FormControl>
                          <FormDescription>
                            Source code repository URL
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="documentationUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Documentation</FormLabel>
                          <FormControl>
                            <Input placeholder="https://docs.example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            URL to documentation site
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
                          <FormLabel>Support</FormLabel>
                          <FormControl>
                            <Input placeholder="https://support.example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            URL for support requests
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="licenseName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Name</FormLabel>
                          <FormControl>
                            <Input placeholder="MIT, Apache 2.0, etc." {...field} />
                          </FormControl>
                          <FormDescription>
                            Name of the license
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="licenseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://opensource.org/licenses/MIT" {...field} />
                          </FormControl>
                          <FormDescription>
                            URL to the license text
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2 pt-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Submission Information</AlertTitle>
                    <AlertDescription>
                      Your connector will be reviewed by our team before being published to the marketplace.
                      You can check the status of your submission in your account dashboard.
                    </AlertDescription>
                  </Alert>
                </div>
                
                <div className="md:col-span-2 flex justify-end">
                  <Button 
                    type="submit" 
                    size="lg"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Submit Connector
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}