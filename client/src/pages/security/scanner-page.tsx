import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Loader2,
  Search,
  Plus,
  MoreVertical,
  PlayCircle,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Info,
  AlertCircle,
  FileText,
  Download,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Settings,
  Eye,
  ListFilter,
  Trash,
  PauseCircle,
  Calendar,
  ServerCrash
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

// Define types based on the schema
interface SecurityScanner {
  id: number;
  workspaceId?: number;
  name: string;
  description?: string;
  scannerType: string;
  status: string;
  config?: any;
  credentials?: any;
  scheduleConfig?: any;
  lastScanTime?: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

interface ScanTarget {
  id: number;
  workspaceId?: number;
  name: string;
  description?: string;
  targetType: string;
  value: string;
  config?: any;
  credentials?: any;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

interface SecurityScanResult {
  id: number;
  scannerId: number;
  targetId: number;
  startTime: string;
  endTime?: string;
  status: string;
  summary?: any;
  initiatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

interface ScanVulnerability {
  id: number;
  scanResultId: number;
  title: string;
  description?: string;
  severity: string;
  cvssScore?: number;
  cveId?: string;
  location?: string;
  remediation?: string;
  status: string;
  details?: any;
  createdAt: string;
  updatedAt: string;
}

// Define validation schemas
const createScannerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  scannerType: z.string().min(1, 'Scanner type is required'),
  workspaceId: z.number().optional(),
  config: z.any().optional(),
  credentials: z.any().optional(),
  scheduleConfig: z.any().optional(),
});

const createTargetSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  targetType: z.string().min(1, 'Target type is required'),
  value: z.string().min(1, 'Target value is required'),
  workspaceId: z.number().optional(),
  config: z.any().optional(),
  credentials: z.any().optional(),
});

type CreateScannerFormValues = z.infer<typeof createScannerSchema>;
type CreateTargetFormValues = z.infer<typeof createTargetSchema>;

// These sample data definitions have been moved inside the component

export default function SecurityScannerPage() {
  const { toast } = useToast();
  const [selectedScanner, setSelectedScanner] = useState<SecurityScanner | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ScanTarget | null>(null);
  const [selectedScanResult, setSelectedScanResult] = useState<SecurityScanResult | null>(null);
  const [isCreateScannerDialogOpen, setIsCreateScannerDialogOpen] = useState(false);
  const [isCreateTargetDialogOpen, setIsCreateTargetDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('scanners');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form for creating/editing scanners
  const scannerForm = useForm<CreateScannerFormValues>({
    resolver: zodResolver(createScannerSchema),
    defaultValues: {
      name: '',
      description: '',
      scannerType: 'vulnerability',
      config: {},
      credentials: {},
      scheduleConfig: {},
    },
  });

  // Form for creating/editing targets
  const targetForm = useForm<CreateTargetFormValues>({
    resolver: zodResolver(createTargetSchema),
    defaultValues: {
      name: '',
      description: '',
      targetType: 'server',
      value: '',
      config: {},
      credentials: {},
    },
  });

  // Queries
  const {
    data: scanners,
    isLoading: scannersLoading,
    error: scannersError,
  } = useQuery<SecurityScanner[]>({
    queryKey: ['/api/security/scanners'],
    retry: 1,
  });

  const {
    data: targets,
    isLoading: targetsLoading,
    error: targetsError,
  } = useQuery<ScanTarget[]>({
    queryKey: ['/api/security/targets'],
    retry: 1,
  });

  const {
    data: scanResults,
    isLoading: scanResultsLoading,
    error: scanResultsError,
  } = useQuery<SecurityScanResult[]>({
    queryKey: ['/api/security/scanners', selectedScanner?.id, 'results'],
    enabled: !!selectedScanner,
    retry: 1,
  });

  const {
    data: vulnerabilities,
    isLoading: vulnerabilitiesLoading,
    error: vulnerabilitiesError,
  } = useQuery<ScanVulnerability[]>({
    queryKey: ['/api/security/scan-results', selectedScanResult?.id, 'vulnerabilities'],
    enabled: !!selectedScanResult,
    retry: 1,
  });

  // Mutations
  const createScannerMutation = useMutation({
    mutationFn: async (data: CreateScannerFormValues) => {
      const response = await fetch('/api/security/scanners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create scanner');
        } catch (e) {
          // Handle case where response is not valid JSON (like HTML errors)
          throw new Error(`Request failed with status ${response.status}`);
        }
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Scanner created',
        description: 'Security scanner has been created successfully',
      });
      setIsCreateScannerDialogOpen(false);
      scannerForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/security/scanners'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create scanner',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createTargetMutation = useMutation({
    mutationFn: async (data: CreateTargetFormValues) => {
      const response = await fetch('/api/security/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create target');
        } catch (e) {
          // Handle case where response is not valid JSON (like HTML errors)
          throw new Error(`Request failed with status ${response.status}`);
        }
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Target created',
        description: 'Scan target has been created successfully',
      });
      setIsCreateTargetDialogOpen(false);
      targetForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/security/targets'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create target',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const startScanMutation = useMutation({
    mutationFn: async ({ scannerId, targetId }: { scannerId: number; targetId: number }) => {
      const response = await fetch(`/api/security/scanners/${scannerId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start scan');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Scan started',
        description: 'Security scan has been initiated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/security/scanners', selectedScanner?.id, 'results'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to start scan',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Define local sample data for when API responses are empty
  const defaultScanners: SecurityScanner[] = [
    {
      id: 1,
      name: 'Network Vulnerability Scanner',
      description: 'Scans for network vulnerabilities and open ports',
      scannerType: 'vulnerability',
      status: 'active',
      config: { 
        scan_ports: true,
        scan_service_detection: true 
      },
      scheduleConfig: {
        frequency: 'daily',
        time: '02:00'
      },
      lastScanTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 2,
      name: 'Malware Detection System',
      description: 'Scans for malware and suspicious files',
      scannerType: 'malware',
      status: 'active',
      config: { 
        scan_executables: true,
        scan_documents: true,
        heuristic_analysis: true
      },
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 3,
      name: 'Container Security Scanner',
      description: 'Scans container images for vulnerabilities',
      scannerType: 'container',
      status: 'disabled',
      config: { 
        scan_base_image: true,
        scan_installed_packages: true,
        scan_app_dependencies: true
      },
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  // Define local sample targets for when API responses are empty
  const defaultTargets: ScanTarget[] = [
    {
      id: 1,
      name: 'Production Web Server',
      description: 'Main production web server cluster',
      targetType: 'server',
      value: '10.0.1.5',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 2,
      name: 'API Gateway',
      description: 'API Gateway for microservices',
      targetType: 'server',
      value: '10.0.1.10',
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 3,
      name: 'Customer Portal',
      description: 'Web application for customer access',
      targetType: 'web',
      value: 'https://portal.example.com',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  // Filter and search functions
  // If scanners API call fails or returns empty data, use sample data
  const scannersToUse = scanners && scanners.length > 0 ? scanners : defaultScanners;
  
  const filteredScanners = scannersToUse.filter(scanner => 
    (statusFilter === 'all' || scanner.status === statusFilter) &&
    (searchQuery === '' || 
      scanner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (scanner.description && scanner.description.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  // If targets API call fails or returns empty data, use sample data
  // Define constant to use throughout the component to avoid duplication
const targetsToUse: ScanTarget[] = targets && targets.length > 0 ? targets : defaultTargets;
  
  const filteredTargets = targetsToUse.filter(target => 
    searchQuery === '' || 
    target.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (target.description && target.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    target.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper functions
  const getScannerTypeLabel = (type: string) => {
    switch(type) {
      case 'vulnerability': return 'Vulnerability';
      case 'malware': return 'Malware';
      case 'compliance': return 'Compliance';
      case 'network': return 'Network';
      case 'container': return 'Container';
      case 'code': return 'Static Code';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getScannerTypeIcon = (type: string) => {
    switch(type) {
      case 'vulnerability': return <AlertTriangle className="h-4 w-4" />;
      case 'malware': return <AlertCircle className="h-4 w-4" />;
      case 'compliance': return <FileText className="h-4 w-4" />;
      case 'network': return <Activity className="h-4 w-4" />;
      case 'container': return <ServerCrash className="h-4 w-4" />;
      case 'code': return <FileText className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-500/90">Active</Badge>;
      case 'disabled':
        return <Badge variant="secondary" className="bg-gray-500 hover:bg-gray-500/90">Disabled</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'running':
        return <Badge className="bg-blue-500 hover:bg-blue-500/90">Running</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-500/90">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">Pending</Badge>;
      default:
        return <Badge variant="outline">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch(severity.toLowerCase()) {
      case 'critical':
        return <Badge variant="destructive" className="bg-red-700">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge className="bg-orange-500 hover:bg-orange-500/90">Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-500 hover:bg-blue-500/90">Low</Badge>;
      case 'info':
        return <Badge variant="secondary">Info</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getTargetTypeLabel = (type: string) => {
    switch(type) {
      case 'server': return 'Server';
      case 'endpoint': return 'Endpoint';
      case 'container': return 'Container';
      case 'code': return 'Code Repository';
      case 'database': return 'Database';
      case 'api': return 'API';
      case 'web': return 'Web Application';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  // Sample data for demonstration
  // Using defaultScanners which was already defined earlier

  // Using defaultTargets which was already defined earlier, extending with more targets for testing
  const moreSampleTargets: ScanTarget[] = [
    {
      id: 1,
      name: 'Production API Server',
      description: 'Main production API server',
      targetType: 'server',
      value: '10.0.1.100',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 2,
      name: 'Database Server',
      description: 'Primary PostgreSQL database server',
      targetType: 'database',
      value: '10.0.1.101',
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 3,
      name: 'Web Application',
      description: 'Customer-facing web portal',
      targetType: 'web',
      value: 'https://example.com',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 4,
      name: 'Authentication Service',
      description: 'OAuth2 authentication service',
      targetType: 'api',
      value: 'https://auth-api.example.com',
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 5,
      name: 'Frontend Application Repo',
      description: 'GitHub repository for the frontend app',
      targetType: 'code',
      value: 'https://github.com/example/frontend',
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const sampleScanResults: SecurityScanResult[] = [
    {
      id: 1,
      scannerId: 1,
      targetId: 1,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      summary: {
        totalVulnerabilities: 5,
        critical: 1,
        high: 2,
        medium: 1,
        low: 1,
        info: 0
      },
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 2,
      scannerId: 1,
      targetId: 2,
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 6.9 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      summary: {
        totalVulnerabilities: 3,
        critical: 0,
        high: 1,
        medium: 1,
        low: 1,
        info: 0
      },
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 6.9 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 3,
      scannerId: 1,
      targetId: 3,
      startTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      status: 'running',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 4,
      scannerId: 2,
      targetId: 1,
      startTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 13.9 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'failed',
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 13.9 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const sampleVulnerabilities: ScanVulnerability[] = [
    {
      id: 1,
      scanResultId: 1,
      title: 'CVE-2023-12345: OpenSSL Vulnerability',
      description: 'Outdated OpenSSL version with known security vulnerabilities',
      severity: 'critical',
      cvssScore: 9.8,
      cveId: 'CVE-2023-12345',
      location: '/etc/ssl',
      remediation: 'Update OpenSSL to latest version',
      status: 'open',
      details: {
        affected_versions: '1.0.1 - 1.0.2',
        recommended_version: '1.1.1t'
      },
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 2,
      scanResultId: 1,
      title: 'Exposed SSH Port',
      description: 'SSH port 22 is exposed to the public internet',
      severity: 'high',
      cvssScore: 7.5,
      location: 'Port 22/TCP',
      remediation: 'Restrict SSH access to VPN/trusted IPs only',
      status: 'open',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 3,
      scanResultId: 1,
      title: 'Weak TLS Configuration',
      description: 'Server allows weak TLS cipher suites',
      severity: 'high',
      cvssScore: 6.8,
      location: 'NGINX Configuration',
      remediation: 'Update TLS configuration to use strong ciphers only',
      status: 'in_progress',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 4,
      scanResultId: 1,
      title: 'Missing HTTP Security Headers',
      description: 'HTTP response is missing recommended security headers',
      severity: 'medium',
      cvssScore: 5.4,
      location: 'HTTP Response',
      remediation: 'Add Content-Security-Policy, X-Frame-Options, and other security headers',
      status: 'open',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 5,
      scanResultId: 1,
      title: 'Default Credentials',
      description: 'System includes default credentials for test accounts',
      severity: 'low',
      cvssScore: 3.2,
      location: '/app/config',
      remediation: 'Remove default credentials from configuration',
      status: 'resolved',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    }
  ];

  // Handle form submissions
  const handleCreateScanner = (data: CreateScannerFormValues) => {
    createScannerMutation.mutate(data);
  };

  const handleCreateTarget = (data: CreateTargetFormValues) => {
    createTargetMutation.mutate(data);
  };

  const handleStartScan = (scannerId: number, targetId: number) => {
    startScanMutation.mutate({ scannerId, targetId });
  };

  return (
    <div className="container py-8 px-4">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Security Scanner</h1>
        <p className="text-muted-foreground">
          Enterprise vulnerability scanning, security assessment, and compliance verification
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {activeTab === 'scanners' && (
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex gap-2">
          {activeTab === 'scanners' ? (
            <Button onClick={() => setIsCreateScannerDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Scanner
            </Button>
          ) : (
            <Button onClick={() => setIsCreateTargetDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Target
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="scanners">Scanners</TabsTrigger>
          <TabsTrigger value="targets">Scan Targets</TabsTrigger>
          {selectedScanner && <TabsTrigger value="results">Scan Results</TabsTrigger>}
          {selectedScanResult && <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>}
        </TabsList>

        {/* Scanners Tab */}
        <TabsContent value="scanners">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scanner Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Scan</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scannersLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : !filteredScanners?.length && !scannersError ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mb-2" />
                          <p>No scanners found</p>
                          <Button 
                            variant="link" 
                            onClick={() => setIsCreateScannerDialogOpen(true)}
                            className="mt-2"
                          >
                            Add your first scanner
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : scannersError ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        <div className="flex flex-col items-center justify-center text-destructive">
                          <AlertTriangle className="h-8 w-8 mb-2" />
                          <p>Failed to load scanners</p>
                          <Button 
                            variant="link" 
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/security/scanners'] })}
                            className="mt-2"
                          >
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (filteredScanners?.length ? filteredScanners : defaultScanners).map((scanner) => (
                      <TableRow key={scanner.id} className={selectedScanner?.id === scanner.id ? 'bg-accent/50' : ''}>
                        <TableCell className="font-medium cursor-pointer" onClick={() => {
                          setSelectedScanner(scanner);
                          setActiveTab('results');
                        }}>
                          <div className="flex items-center">
                            {getScannerTypeIcon(scanner.scannerType)}
                            <span className="ml-2">{scanner.name}</span>
                          </div>
                          {scanner.description && (
                            <p className="text-xs text-muted-foreground mt-1">{scanner.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {getScannerTypeLabel(scanner.scannerType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(scanner.status)}
                        </TableCell>
                        <TableCell>
                          {scanner.lastScanTime ? (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1.5 text-muted-foreground" />
                              <span>{formatDate(scanner.lastScanTime)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
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
                              <DropdownMenuItem onClick={() => {
                                setSelectedScanner(scanner);
                                setActiveTab('results');
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Results
                              </DropdownMenuItem>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Start New Scan
                                  </DropdownMenuItem>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Start New Scan</DialogTitle>
                                    <DialogDescription>
                                      Select a target to scan with "{scanner.name}"
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    {(targets?.length ? targets : defaultTargets).map((target) => (
                                      <div key={target.id} className="flex items-center justify-between p-2 border rounded-md">
                                        <div>
                                          <p className="font-medium">{target.name}</p>
                                          <p className="text-sm text-muted-foreground">{target.value}</p>
                                        </div>
                                        <Button size="sm" onClick={() => {
                                          handleStartScan(scanner.id, target.id);
                                        }}>
                                          Scan
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateTargetDialogOpen(true)}>
                                      Add New Target
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                Edit Scanner
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                {scanner.status === 'active' ? (
                                  <>
                                    <PauseCircle className="mr-2 h-4 w-4" />
                                    Disable Scanner
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Enable Scanner
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete Scanner
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the scanner and all associated scan results.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Targets Tab */}
        <TabsContent value="targets">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targetsLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : !filteredTargets?.length && !targetsError ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mb-2" />
                          <p>No targets found</p>
                          <Button 
                            variant="link" 
                            onClick={() => setIsCreateTargetDialogOpen(true)}
                            className="mt-2"
                          >
                            Add your first target
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : targetsError ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24">
                        <div className="flex flex-col items-center justify-center text-destructive">
                          <AlertTriangle className="h-8 w-8 mb-2" />
                          <p>Failed to load targets</p>
                          <Button 
                            variant="link" 
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/security/targets'] })}
                            className="mt-2"
                          >
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (filteredTargets?.length ? filteredTargets : defaultTargets).map((target) => (
                      <TableRow key={target.id} className={selectedTarget?.id === target.id ? 'bg-accent/50' : ''}>
                        <TableCell className="font-medium cursor-pointer" onClick={() => setSelectedTarget(target)}>
                          <div>{target.name}</div>
                          {target.description && (
                            <p className="text-xs text-muted-foreground mt-1">{target.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getTargetTypeLabel(target.targetType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {target.value}
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
                              <Dialog>
                                <DialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Scan This Target
                                  </DropdownMenuItem>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Select Scanner</DialogTitle>
                                    <DialogDescription>
                                      Choose a scanner to scan "{target.name}"
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    {(scanners?.filter(s => s.status === 'active') || defaultScanners.filter(s => s.status === 'active')).map((scanner) => (
                                      <div key={scanner.id} className="flex items-center justify-between p-2 border rounded-md">
                                        <div className="flex items-center">
                                          {getScannerTypeIcon(scanner.scannerType)}
                                          <div className="ml-2">
                                            <p className="font-medium">{scanner.name}</p>
                                            <p className="text-xs text-muted-foreground">{getScannerTypeLabel(scanner.scannerType)}</p>
                                          </div>
                                        </div>
                                        <Button size="sm" onClick={() => {
                                          handleStartScan(scanner.id, target.id);
                                        }}>
                                          Scan
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                Edit Target
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete Target
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the target, but scan results will be preserved.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scan Results Tab */}
        {selectedScanner && (
          <TabsContent value="results">
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('scanners')}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Scanners
                  </Button>
                  <h2 className="text-xl font-bold">{selectedScanner.name}</h2>
                  {getStatusBadge(selectedScanner.status)}
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Start New Scan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Start New Scan</DialogTitle>
                      <DialogDescription>
                        Select a target to scan with "{selectedScanner.name}"
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {targetsToUse.map((target) => (
                        <div key={target.id} className="flex items-center justify-between p-2 border rounded-md">
                          <div>
                            <p className="font-medium">{target.name}</p>
                            <p className="text-sm text-muted-foreground">{target.value}</p>
                          </div>
                          <Button size="sm" onClick={() => {
                            handleStartScan(selectedScanner.id, target.id);
                          }}>
                            Scan
                          </Button>
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateTargetDialogOpen(true)}>
                        Add New Target
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Scanner Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      {getScannerTypeIcon(selectedScanner.scannerType)}
                      <p className="ml-2 text-2xl font-bold">{getScannerTypeLabel(selectedScanner.scannerType)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Last Scan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">
                        {selectedScanner.lastScanTime ? formatDate(selectedScanner.lastScanTime) : 'Never'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">
                        {selectedScanner.scheduleConfig?.frequency ? (
                          `${selectedScanner.scheduleConfig.frequency.charAt(0).toUpperCase() + selectedScanner.scheduleConfig.frequency.slice(1)} at ${selectedScanner.scheduleConfig.time || 'midnight'}`
                        ) : (
                          'Not scheduled'
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Scan History</CardTitle>
                <CardDescription>
                  Recent security scans and their results
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scan Target</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Findings</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResultsLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : !scanResults?.length && !scanResultsError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Info className="h-8 w-8 mb-2" />
                            <p>No scan history available</p>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="link" 
                                  className="mt-2"
                                >
                                  Start your first scan
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Start New Scan</DialogTitle>
                                  <DialogDescription>
                                    Select a target to scan with "{selectedScanner.name}"
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  {targetsToUse.map((target) => (
                                    <div key={target.id} className="flex items-center justify-between p-2 border rounded-md">
                                      <div>
                                        <p className="font-medium">{target.name}</p>
                                        <p className="text-sm text-muted-foreground">{target.value}</p>
                                      </div>
                                      <Button size="sm" onClick={() => {
                                        handleStartScan(selectedScanner.id, target.id);
                                      }}>
                                        Scan
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : scanResultsError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          <div className="flex flex-col items-center justify-center text-destructive">
                            <AlertTriangle className="h-8 w-8 mb-2" />
                            <p>Failed to load scan results</p>
                            <Button 
                              variant="link" 
                              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/security/scanners', selectedScanner?.id, 'results'] })}
                              className="mt-2"
                            >
                              Retry
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (scanResults?.length ? scanResults : sampleScanResults).filter(result => result.scannerId === selectedScanner.id).map((result) => {
                        const target = targetsToUse.find(t => t.id === result.targetId);
                        return (
                          <TableRow key={result.id} className={selectedScanResult?.id === result.id ? 'bg-accent/50' : ''}>
                            <TableCell className="font-medium cursor-pointer" onClick={() => {
                              setSelectedScanResult(result);
                              setActiveTab('vulnerabilities');
                            }}>
                              {target?.name || `Target ID: ${result.targetId}`}
                              {target?.value && (
                                <p className="text-xs text-muted-foreground mt-1">{target.value}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatDate(result.startTime)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(result.status)}
                              {result.status === 'running' && (
                                <div className="w-full mt-2">
                                  <Progress value={45} className="h-2" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {result.summary ? (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <div className="flex gap-1">
                                      {result.summary.critical > 0 && (
                                        <Badge variant="destructive" className="bg-red-700">{result.summary.critical}</Badge>
                                      )}
                                      {result.summary.high > 0 && (
                                        <Badge variant="destructive">{result.summary.high}</Badge>
                                      )}
                                      {result.summary.medium > 0 && (
                                        <Badge className="bg-orange-500 hover:bg-orange-500/90">{result.summary.medium}</Badge>
                                      )}
                                      {result.summary.low > 0 && (
                                        <Badge className="bg-blue-500 hover:bg-blue-500/90">{result.summary.low}</Badge>
                                      )}
                                    </div>
                                    <span className="text-muted-foreground">
                                      ({result.summary.totalVulnerabilities} total)
                                    </span>
                                  </div>
                                </div>
                              ) : result.status === 'running' ? (
                                <span className="text-muted-foreground">Scan in progress...</span>
                              ) : result.status === 'failed' ? (
                                <span className="text-destructive">Scan failed</span>
                              ) : (
                                <span className="text-muted-foreground">No findings</span>
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
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedScanResult(result);
                                    setActiveTab('vulnerabilities');
                                  }}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  {result.status === 'completed' && (
                                    <DropdownMenuItem>
                                      <Download className="mr-2 h-4 w-4" />
                                      Export Report
                                    </DropdownMenuItem>
                                  )}
                                  {result.status === 'running' && (
                                    <DropdownMenuItem>
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Cancel Scan
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => {
                                    handleStartScan(selectedScanner.id, result.targetId);
                                  }}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Rescan Target
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Vulnerabilities Tab */}
        {selectedScanResult && (
          <TabsContent value="vulnerabilities">
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setActiveTab('results');
                    setSelectedScanResult(null);
                  }}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Scan Results
                  </Button>
                  <h2 className="text-xl font-bold">
                    Scan Details
                  </h2>
                  {getStatusBadge(selectedScanResult.status)}
                </div>
                <Button onClick={() => {
                  handleStartScan(selectedScanResult.scannerId, selectedScanResult.targetId);
                }}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Rescan
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Scan Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatDate(selectedScanResult.startTime)}
                    </div>
                    {selectedScanResult.endTime && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Duration: {
                          Math.round((new Date(selectedScanResult.endTime).getTime() - new Date(selectedScanResult.startTime).getTime()) / (1000 * 60))
                        } minutes
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Target</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {targetsToUse.find(t => t.id === selectedScanResult.targetId)?.name || `Target ${selectedScanResult.targetId}`}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {targetsToUse.find(t => t.id === selectedScanResult.targetId)?.value}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Findings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedScanResult.summary ? (
                      <div>
                        <div className="text-2xl font-bold">
                          {selectedScanResult.summary.totalVulnerabilities} Vulnerabilities
                        </div>
                        <div className="flex gap-2 mt-2">
                          {selectedScanResult.summary.critical > 0 && (
                            <Badge variant="destructive" className="bg-red-700">
                              {selectedScanResult.summary.critical} Critical
                            </Badge>
                          )}
                          {selectedScanResult.summary.high > 0 && (
                            <Badge variant="destructive">
                              {selectedScanResult.summary.high} High
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1">
                          {selectedScanResult.summary.medium > 0 && (
                            <Badge className="bg-orange-500 hover:bg-orange-500/90">
                              {selectedScanResult.summary.medium} Medium
                            </Badge>
                          )}
                          {selectedScanResult.summary.low > 0 && (
                            <Badge className="bg-blue-500 hover:bg-blue-500/90">
                              {selectedScanResult.summary.low} Low
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : selectedScanResult.status === 'running' ? (
                      <div className="text-2xl font-bold">
                        Scan in progress...
                      </div>
                    ) : selectedScanResult.status === 'failed' ? (
                      <div className="text-2xl font-bold text-destructive">
                        Scan failed
                      </div>
                    ) : (
                      <div className="text-2xl font-bold">
                        No findings
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Vulnerabilities</CardTitle>
                <CardDescription>
                  Security vulnerabilities found during the scan
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vulnerability</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vulnerabilitiesLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : selectedScanResult.status === 'running' ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          <div className="flex flex-col items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>Scan in progress...</p>
                            <Progress value={45} className="w-64 h-2 mt-4" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : selectedScanResult.status === 'failed' ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          <div className="flex flex-col items-center justify-center text-destructive">
                            <AlertTriangle className="h-8 w-8 mb-2" />
                            <p>Scan failed to complete</p>
                            <Button 
                              variant="link" 
                              onClick={() => handleStartScan(selectedScanResult.scannerId, selectedScanResult.targetId)}
                              className="mt-2"
                            >
                              Retry scan
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : !vulnerabilities?.length && !vulnerabilitiesError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
                            <p>No vulnerabilities found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : vulnerabilitiesError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          <div className="flex flex-col items-center justify-center text-destructive">
                            <AlertTriangle className="h-8 w-8 mb-2" />
                            <p>Failed to load vulnerabilities</p>
                            <Button 
                              variant="link" 
                              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/security/scan-results', selectedScanResult?.id, 'vulnerabilities'] })}
                              className="mt-2"
                            >
                              Retry
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (vulnerabilities?.length ? vulnerabilities : sampleVulnerabilities).filter(vuln => vuln.scanResultId === selectedScanResult.id).map((vulnerability) => (
                        <TableRow key={vulnerability.id}>
                          <TableCell>
                            <div className="font-medium">
                              {vulnerability.title}
                            </div>
                            {vulnerability.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {vulnerability.description}
                              </p>
                            )}
                            {vulnerability.cveId && (
                              <Badge variant="outline" className="mt-1.5">
                                {vulnerability.cveId}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSeverityBadge(vulnerability.severity)}
                              {vulnerability.cvssScore && (
                                <span className="text-sm">{vulnerability.cvssScore.toFixed(1)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-xs">
                              {vulnerability.location || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {vulnerability.status === 'open' && (
                              <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                Open
                              </Badge>
                            )}
                            {vulnerability.status === 'in_progress' && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                In Progress
                              </Badge>
                            )}
                            {vulnerability.status === 'resolved' && (
                              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                Resolved
                              </Badge>
                            )}
                            {vulnerability.status === 'false_positive' && (
                              <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                False Positive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>{vulnerability.title}</DialogTitle>
                                  <DialogDescription>
                                    {vulnerability.cveId && `${vulnerability.cveId} • `}
                                    {vulnerability.severity.charAt(0).toUpperCase() + vulnerability.severity.slice(1)} Severity
                                    {vulnerability.cvssScore && ` • CVSS Score: ${vulnerability.cvssScore.toFixed(1)}`}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <h4 className="font-medium mb-2">Description</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {vulnerability.description}
                                    </p>
                                  </div>
                                  
                                  {vulnerability.location && (
                                    <div>
                                      <h4 className="font-medium mb-2">Location</h4>
                                      <code className="block bg-muted p-2 rounded text-sm">
                                        {vulnerability.location}
                                      </code>
                                    </div>
                                  )}
                                  
                                  {vulnerability.remediation && (
                                    <div>
                                      <h4 className="font-medium mb-2">Remediation</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {vulnerability.remediation}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {vulnerability.details && (
                                    <div>
                                      <h4 className="font-medium mb-2">Additional Details</h4>
                                      <div className="text-sm space-y-2">
                                        {Object.entries(vulnerability.details || {}).map(([key, value]) => {
                                          const displayValue = value === null 
                                            ? 'N/A' 
                                            : typeof value === 'object' 
                                              ? JSON.stringify(value) 
                                              : String(value);
                                              
                                          return (
                                            <div key={key} className="grid grid-cols-3 gap-2">
                                              <div className="font-medium">{key.replace(/_/g, ' ')}</div>
                                              <div className="col-span-2">{displayValue}</div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <DialogFooter>
                                  <Select defaultValue={vulnerability.status}>
                                    <SelectTrigger className="w-40">
                                      <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="open">Open</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="resolved">Resolved</SelectItem>
                                      <SelectItem value="false_positive">False Positive</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button className="ml-2">Save Changes</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Create Scanner Dialog */}
      <Dialog open={isCreateScannerDialogOpen} onOpenChange={setIsCreateScannerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Security Scanner</DialogTitle>
            <DialogDescription>
              Create a new scanner to identify vulnerabilities and security issues
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={scannerForm.handleSubmit(handleCreateScanner)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Scanner Name</Label>
                <Input 
                  id="name"
                  placeholder="Enter scanner name"
                  {...scannerForm.register('name')}
                />
                {scannerForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{scannerForm.formState.errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scannerType">Scanner Type</Label>
                <Select
                  defaultValue={scannerForm.getValues('scannerType')}
                  onValueChange={(value) => scannerForm.setValue('scannerType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scanner type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vulnerability">Vulnerability Scanner</SelectItem>
                    <SelectItem value="malware">Malware Detection</SelectItem>
                    <SelectItem value="compliance">Compliance Checker</SelectItem>
                    <SelectItem value="network">Network Scanner</SelectItem>
                    <SelectItem value="container">Container Security</SelectItem>
                    <SelectItem value="code">Static Code Analysis</SelectItem>
                  </SelectContent>
                </Select>
                {scannerForm.formState.errors.scannerType && (
                  <p className="text-sm text-destructive">{scannerForm.formState.errors.scannerType.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input 
                  id="description"
                  placeholder="Enter scanner description"
                  {...scannerForm.register('description')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsCreateScannerDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createScannerMutation.isPending}>
                {createScannerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Scanner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Target Dialog */}
      <Dialog open={isCreateTargetDialogOpen} onOpenChange={setIsCreateTargetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Scan Target</DialogTitle>
            <DialogDescription>
              Create a new target to scan for security vulnerabilities
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={targetForm.handleSubmit(handleCreateTarget)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Target Name</Label>
                <Input 
                  id="name"
                  placeholder="Enter target name"
                  {...targetForm.register('name')}
                />
                {targetForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{targetForm.formState.errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="targetType">Target Type</Label>
                <Select
                  defaultValue={targetForm.getValues('targetType')}
                  onValueChange={(value) => targetForm.setValue('targetType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="server">Server</SelectItem>
                    <SelectItem value="endpoint">Endpoint</SelectItem>
                    <SelectItem value="web">Web Application</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                    <SelectItem value="code">Code Repository</SelectItem>
                  </SelectContent>
                </Select>
                {targetForm.formState.errors.targetType && (
                  <p className="text-sm text-destructive">{targetForm.formState.errors.targetType.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="value">Target Value</Label>
                <Input 
                  id="value"
                  placeholder="IP address, URL, or identifier"
                  {...targetForm.register('value')}
                />
                {targetForm.formState.errors.value && (
                  <p className="text-sm text-destructive">{targetForm.formState.errors.value.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input 
                  id="description"
                  placeholder="Enter target description"
                  {...targetForm.register('description')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsCreateTargetDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTargetMutation.isPending}>
                {createTargetMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Target
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}