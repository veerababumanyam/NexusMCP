import { useState, useEffect } from 'react';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Info, RefreshCw, Save, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface ConnectionSettings {
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  keepAliveInterval: number;
  retryInterval: number;
  maxRetries: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeout: number;
  healthCheckEnabled: boolean;
  healthCheckInterval: number;
  loadBalancingEnabled: boolean;
  loadBalancingStrategy: 'round_robin' | 'least_connections' | 'weighted' | 'sticky_session';
  tlsVerification: boolean;
}

export default function ConnectionSettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<ConnectionSettings>({
    maxConnections: 100,
    connectionTimeout: 5000,
    idleTimeout: 60000,
    keepAliveInterval: 30000,
    retryInterval: 2000,
    maxRetries: 5,
    circuitBreakerEnabled: true,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeout: 30000,
    healthCheckEnabled: true,
    healthCheckInterval: 60000,
    loadBalancingEnabled: true,
    loadBalancingStrategy: 'round_robin',
    tlsVerification: true
  });

  const [originalSettings, setOriginalSettings] = useState<ConnectionSettings | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest('GET', '/api/mcp/connection-settings');
        const data = await response.json();
        setSettings(data);
        setOriginalSettings(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching connection settings:', error);
        setIsLoading(false);
        setStatusMessage({
          type: 'error',
          message: 'Failed to load connection settings. Please try again.'
        });
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setStatusMessage({
        type: 'info',
        message: 'Saving connection settings...'
      });

      const response = await apiRequest('PUT', '/api/mcp/connection-settings', settings);
      
      if (response.ok) {
        setOriginalSettings(settings);
        setStatusMessage({
          type: 'success',
          message: 'Connection settings saved successfully'
        });
        toast({
          title: 'Settings Saved',
          description: 'Connection settings have been updated successfully.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setStatusMessage({
        type: 'error',
        message: 'Failed to save settings. Please try again.'
      });
      toast({
        title: 'Error',
        description: 'Failed to save connection settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      toast({
        title: 'Settings Reset',
        description: 'Connection settings have been reset to their previous values.',
      });
    }
  };

  const isModified = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  return (
    <div className="container py-6">
      <PageHeader 
        title="Connection Settings" 
        description="Configure and optimize MCP server connection parameters"
      />

      {statusMessage && (
        <Alert 
          className={`mb-6 ${statusMessage.type === 'success' ? 'bg-success/20 text-success border-success/50' : 
            statusMessage.type === 'error' ? 'bg-destructive/20 text-destructive border-destructive/50' : 
            'bg-info/20 text-info border-info/50'}`}
        >
          {statusMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : 
           statusMessage.type === 'error' ? <AlertCircle className="h-4 w-4" /> : 
           <Info className="h-4 w-4" />}
          <AlertTitle>
            {statusMessage.type === 'success' ? 'Success' : 
             statusMessage.type === 'error' ? 'Error' : 
             'Information'}
          </AlertTitle>
          <AlertDescription>{statusMessage.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end mb-6 gap-2">
        <Button 
          variant="outline" 
          onClick={handleResetSettings}
          disabled={!isModified || isLoading || isSaving}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button 
          onClick={handleSaveSettings}
          disabled={!isModified || isLoading || isSaving}
        >
          {isSaving ? (
            <><span className="animate-spin mr-2">⟳</span> Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Settings</>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid grid-cols-4 w-full">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="reliability">Reliability & Resiliency</TabsTrigger>
          <TabsTrigger value="loadbalancing">Load Balancing</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Parameters</CardTitle>
              <CardDescription>Basic connection and timeout settings for MCP server connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxConnections">Maximum Connections</Label>
                  <div className="flex items-center space-x-4">
                    <Slider
                      id="maxConnections"
                      min={10}
                      max={500}
                      step={10}
                      value={[settings.maxConnections]}
                      onValueChange={(value) => setSettings({ ...settings, maxConnections: value[0] })}
                      disabled={isLoading}
                    />
                    <span className="w-12 text-center">{settings.maxConnections}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Maximum number of concurrent connections to MCP servers</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="connectionTimeout">Connection Timeout (ms)</Label>
                  <Input
                    id="connectionTimeout"
                    type="number"
                    value={settings.connectionTimeout}
                    onChange={(e) => setSettings({ ...settings, connectionTimeout: parseInt(e.target.value) })}
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">Time to wait before connection attempt times out</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="idleTimeout">Idle Timeout (ms)</Label>
                  <Input
                    id="idleTimeout"
                    type="number"
                    value={settings.idleTimeout}
                    onChange={(e) => setSettings({ ...settings, idleTimeout: parseInt(e.target.value) })}
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">Time to wait before closing an idle connection</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="keepAliveInterval">Keep-Alive Interval (ms)</Label>
                  <Input
                    id="keepAliveInterval"
                    type="number"
                    value={settings.keepAliveInterval}
                    onChange={(e) => setSettings({ ...settings, keepAliveInterval: parseInt(e.target.value) })}
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">Interval for sending keep-alive packets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reliability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker</CardTitle>
              <CardDescription>Configure circuit breaker patterns to prevent cascading failures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="circuitBreakerEnabled">Enable Circuit Breaker</Label>
                  <p className="text-sm text-muted-foreground">Automatically stop requests to failing servers</p>
                </div>
                <Switch
                  id="circuitBreakerEnabled"
                  checked={settings.circuitBreakerEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, circuitBreakerEnabled: checked })}
                  disabled={isLoading}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="circuitBreakerThreshold">Failure Threshold</Label>
                  <div className="flex items-center space-x-4">
                    <Slider
                      id="circuitBreakerThreshold"
                      min={1}
                      max={20}
                      step={1}
                      value={[settings.circuitBreakerThreshold]}
                      onValueChange={(value) => setSettings({ ...settings, circuitBreakerThreshold: value[0] })}
                      disabled={isLoading || !settings.circuitBreakerEnabled}
                    />
                    <span className="w-12 text-center">{settings.circuitBreakerThreshold}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Number of consecutive failures before tripping the circuit</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="circuitBreakerResetTimeout">Reset Timeout (ms)</Label>
                  <Input
                    id="circuitBreakerResetTimeout"
                    type="number"
                    value={settings.circuitBreakerResetTimeout}
                    onChange={(e) => setSettings({ ...settings, circuitBreakerResetTimeout: parseInt(e.target.value) })}
                    disabled={isLoading || !settings.circuitBreakerEnabled}
                  />
                  <p className="text-sm text-muted-foreground">Time before allowing requests again after circuit trips</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Health Checking</CardTitle>
              <CardDescription>Configure health checks to proactively monitor MCP server status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="healthCheckEnabled">Enable Health Checks</Label>
                  <p className="text-sm text-muted-foreground">Periodically verify server availability</p>
                </div>
                <Switch
                  id="healthCheckEnabled"
                  checked={settings.healthCheckEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, healthCheckEnabled: checked })}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="healthCheckInterval">Health Check Interval (ms)</Label>
                <Input
                  id="healthCheckInterval"
                  type="number"
                  value={settings.healthCheckInterval}
                  onChange={(e) => setSettings({ ...settings, healthCheckInterval: parseInt(e.target.value) })}
                  disabled={isLoading || !settings.healthCheckEnabled}
                />
                <p className="text-sm text-muted-foreground">Time between health check probes</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retry Settings</CardTitle>
              <CardDescription>Configure automatic retry behavior for failed requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="retryInterval">Retry Interval (ms)</Label>
                  <Input
                    id="retryInterval"
                    type="number"
                    value={settings.retryInterval}
                    onChange={(e) => setSettings({ ...settings, retryInterval: parseInt(e.target.value) })}
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">Time to wait between retry attempts</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Maximum Retries</Label>
                  <div className="flex items-center space-x-4">
                    <Slider
                      id="maxRetries"
                      min={0}
                      max={10}
                      step={1}
                      value={[settings.maxRetries]}
                      onValueChange={(value) => setSettings({ ...settings, maxRetries: value[0] })}
                      disabled={isLoading}
                    />
                    <span className="w-12 text-center">{settings.maxRetries}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Maximum number of retry attempts for failed requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loadbalancing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Load Balancing</CardTitle>
              <CardDescription>Configure how requests are distributed across MCP servers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="loadBalancingEnabled">Enable Load Balancing</Label>
                  <p className="text-sm text-muted-foreground">Distribute requests across multiple MCP servers</p>
                </div>
                <Switch
                  id="loadBalancingEnabled"
                  checked={settings.loadBalancingEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, loadBalancingEnabled: checked })}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="loadBalancingStrategy">Load Balancing Strategy</Label>
                <Select
                  value={settings.loadBalancingStrategy}
                  onValueChange={(value) => setSettings({ 
                    ...settings, 
                    loadBalancingStrategy: value as 'round_robin' | 'least_connections' | 'weighted' | 'sticky_session' 
                  })}
                  disabled={isLoading || !settings.loadBalancingEnabled}
                >
                  <SelectTrigger id="loadBalancingStrategy">
                    <SelectValue placeholder="Select a load balancing strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                    <SelectItem value="least_connections">Least Connections</SelectItem>
                    <SelectItem value="weighted">Weighted</SelectItem>
                    <SelectItem value="sticky_session">Sticky Session</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {settings.loadBalancingStrategy === 'round_robin' && 
                    "Distributes requests in sequential order across all available servers"}
                  {settings.loadBalancingStrategy === 'least_connections' && 
                    "Sends requests to servers with the fewest active connections"}
                  {settings.loadBalancingStrategy === 'weighted' && 
                    "Distributes requests based on server capacity weights"}
                  {settings.loadBalancingStrategy === 'sticky_session' && 
                    "Routes requests from the same client to the same server"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Security</CardTitle>
              <CardDescription>Configure security settings for MCP server connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tlsVerification">TLS Certificate Verification</Label>
                  <p className="text-sm text-muted-foreground">Verify server TLS certificates for secure connections</p>
                </div>
                <Switch
                  id="tlsVerification"
                  checked={settings.tlsVerification}
                  onCheckedChange={(checked) => setSettings({ ...settings, tlsVerification: checked })}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}