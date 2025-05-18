import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Pill, Clipboard, StethoscopeIcon, BrainCircuit, Heart, HeartPulse, Activity, Microscope, LineChart, Syringe
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function ClinicalToolsPage() {
  const [activeTab, setActiveTab] = useState("installed");
  const [filterCategory, setFilterCategory] = useState("all");
  
  // Mock query - in a real implementation this would fetch from your backend
  const { data: plugins, isLoading } = useQuery({
    queryKey: ["/api/healthcare/clinical-plugins"],
    queryFn: async () => {
      // This would normally fetch from the actual API endpoint
      return {
        installed: [
          {
            id: "ehr-analyzer",
            name: "EHR Data Analyzer",
            description: "Analyzes EHR data for patterns and insights with HIPAA compliance.",
            category: "analytics",
            version: "2.1.0",
            author: "HealthTech Innovations",
            status: "active",
            lastUsed: "2023-04-28T15:30:00Z",
            usageCount: 345
          },
          {
            id: "diagnostic-ai",
            name: "Diagnostic Assistant AI",
            description: "AI-powered clinical decision support for diagnostics with citation tracking.",
            category: "ai",
            version: "3.0.2",
            author: "MedAI Research",
            status: "active",
            lastUsed: "2023-05-02T09:45:00Z", 
            usageCount: 289
          },
          {
            id: "vital-monitor",
            name: "Vital Signs Monitor",
            description: "Real-time vital signs monitoring with alert thresholds and trending.",
            category: "monitoring",
            version: "1.5.8",
            author: "ClinicalMonitor Inc",
            status: "active",
            lastUsed: "2023-05-01T14:20:00Z",
            usageCount: 421
          },
          {
            id: "med-protocol",
            name: "Medication Protocol Checker",
            description: "Validates medication orders against protocols and detects interactions.",
            category: "prescription",
            version: "2.2.1",
            author: "SafeRx Systems",
            status: "disabled",
            lastUsed: "2023-03-15T11:10:00Z",
            usageCount: 132
          }
        ],
        available: [
          {
            id: "lab-analyzer",
            name: "Lab Results Analyzer",
            description: "Interprets lab results and provides reference ranges and trend analysis.",
            category: "analytics",
            version: "1.8.5",
            author: "DiagnosticTech",
            rating: 4.7,
            installations: 1245
          },
          {
            id: "imaging-ai",
            name: "Medical Imaging AI",
            description: "AI-powered analysis of medical images with annotation capabilities.",
            category: "ai",
            version: "2.3.0",
            author: "VisualDiagnostics",
            rating: 4.9,
            installations: 982
          },
          {
            id: "clinical-trials",
            name: "Clinical Trials Matcher",
            description: "Matches patients to relevant clinical trials based on criteria.",
            category: "research",
            version: "1.2.1",
            author: "ResearchLink",
            rating: 4.4,
            installations: 586
          }
        ]
      };
    }
  });
  
  // Get the icon for the plugin category
  function getCategoryIcon(category: string) {
    switch (category) {
      case "analytics":
        return <LineChart className="h-5 w-5" />;
      case "ai":
        return <BrainCircuit className="h-5 w-5" />;
      case "monitoring":
        return <Activity className="h-5 w-5" />;
      case "prescription":
        return <Clipboard className="h-5 w-5" />;
      case "research":
        return <Microscope className="h-5 w-5" />;
      default:
        return <Pill className="h-5 w-5" />;
    }
  }
  
  // Filter plugins by category
  const getFilteredPlugins = (list: any[]) => {
    if (!list) return [];
    return filterCategory === "all" 
      ? list 
      : list.filter(plugin => plugin.category === filterCategory);
  }
  
  const filteredInstalled = plugins?.installed ? getFilteredPlugins(plugins.installed) : [];
  const filteredAvailable = plugins?.available ? getFilteredPlugins(plugins.available) : [];
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clinical Plugins</h1>
          <p className="text-muted-foreground mt-1">
            Manage and deploy clinical decision support tools and integrations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="ai">AI & ML</SelectItem>
              <SelectItem value="monitoring">Monitoring</SelectItem>
              <SelectItem value="prescription">Prescription</SelectItem>
              <SelectItem value="research">Research</SelectItem>
            </SelectContent>
          </Select>
          <Button>Add New Plugin</Button>
        </div>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="installed">Installed</TabsTrigger>
          <TabsTrigger value="available">Marketplace</TabsTrigger>
        </TabsList>
        
        <TabsContent value="installed" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <p>Loading installed plugins...</p>
            ) : filteredInstalled.length > 0 ? (
              filteredInstalled.map((plugin) => (
                <Card key={plugin.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          {getCategoryIcon(plugin.category)}
                        </div>
                        <CardTitle className="text-md">{plugin.name}</CardTitle>
                      </div>
                      <Badge variant={plugin.status === "active" ? "default" : "secondary"}>
                        {plugin.status === "active" ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">{plugin.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-medium">{plugin.version}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Author</span>
                        <span className="font-medium">{plugin.author}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Usage Count</span>
                        <span className="font-medium">{plugin.usageCount} sessions</span>
                      </div>
                      <div className="mt-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">HIPAA Compliance</span>
                          <span className="font-medium text-green-500">Verified</span>
                        </div>
                        <Progress value={100} className="h-1.5" />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <Button variant="ghost" size="sm">Configure</Button>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`enable-${plugin.id}`} className="text-sm">
                        {plugin.status === "active" ? "Enabled" : "Disabled"}
                      </Label>
                      <Switch 
                        id={`enable-${plugin.id}`} 
                        checked={plugin.status === "active"} 
                      />
                    </div>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <p className="col-span-full text-center py-6 text-muted-foreground">
                No plugins found matching the selected category.
              </p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="available" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <p>Loading available plugins...</p>
            ) : filteredAvailable.length > 0 ? (
              filteredAvailable.map((plugin) => (
                <Card key={plugin.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          {getCategoryIcon(plugin.category)}
                        </div>
                        <CardTitle className="text-md">{plugin.name}</CardTitle>
                      </div>
                      <Badge variant="outline">
                        {plugin.rating} ★
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">{plugin.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-medium">{plugin.version}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Author</span>
                        <span className="font-medium">{plugin.author}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Installations</span>
                        <span className="font-medium">{plugin.installations} users</span>
                      </div>
                      <div className="mt-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">HIPAA Compliance</span>
                          <span className="font-medium text-green-500">Verified</span>
                        </div>
                        <Progress value={100} className="h-1.5" />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <Button variant="outline" size="sm">Details</Button>
                    <Button size="sm">Install</Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <p className="col-span-full text-center py-6 text-muted-foreground">
                No plugins found matching the selected category.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}