import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Server, Shield, CheckCircle, Laptop, Database, Link, FileCode, 
  FileJson, Stethoscope, WrenchIcon, Settings, RefreshCcw, Power, AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function EhrIntegrationsPage() {
  const [activeTab, setActiveTab] = useState("connected");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Mock query that would normally fetch EHR integrations from backend
  const { data: ehrIntegrations, isLoading } = useQuery({
    queryKey: ["/api/healthcare/ehr-integrations"],
    queryFn: async () => {
      // This would normally fetch from the actual API endpoint
      return {
        connected: [
          {
            id: "epic-fhir-1",
            name: "Epic Systems FHIR API",
            type: "FHIR",
            lastSync: "2023-05-02T14:30:00Z",
            status: "active",
            version: "R4",
            endpoint: "https://fhir.epic-ehr.example.com/api/FHIR/R4",
            credentials: "OAuth 2.0",
            syncFrequency: "15 minutes",
            dataTypes: ["Patient", "Observation", "Medication", "Condition"],
            metrics: {
              uptime: 99.8,
              responseTime: 230,
              errorRate: 0.2,
              syncedRecords: 15482
            },
            hipaaCompliant: true
          },
          {
            id: "cerner-fhir-1",
            name: "Cerner Millennium FHIR",
            type: "FHIR",
            lastSync: "2023-05-02T14:15:00Z",
            status: "active",
            version: "R4",
            endpoint: "https://fhir.cerner-ehr.example.com/api/FHIR/R4",
            credentials: "Client Certificate",
            syncFrequency: "30 minutes",
            dataTypes: ["Patient", "AllergyIntolerance", "Procedure", "Encounter"],
            metrics: {
              uptime: 99.5,
              responseTime: 310,
              errorRate: 0.5,
              syncedRecords: 9742
            },
            hipaaCompliant: true
          },
          {
            id: "athena-health-1",
            name: "Athena Health API",
            type: "Proprietary",
            lastSync: "2023-05-02T13:00:00Z",
            status: "degraded",
            version: "v1.2",
            endpoint: "https://api.athena-health.example.com/v1/",
            credentials: "API Key",
            syncFrequency: "60 minutes",
            dataTypes: ["Patient", "Appointments", "Billing", "Clinical"],
            metrics: {
              uptime: 97.2,
              responseTime: 450,
              errorRate: 2.8,
              syncedRecords: 7123
            },
            hipaaCompliant: true
          },
          {
            id: "allscripts-api-1",
            name: "Allscripts Integration",
            type: "Proprietary",
            lastSync: "2023-05-01T23:45:00Z",
            status: "inactive",
            version: "2.0",
            endpoint: "https://api.allscripts.example.com/v2/",
            credentials: "Basic Auth",
            syncFrequency: "Daily",
            dataTypes: ["Patient", "Clinical Notes", "Medications"],
            metrics: {
              uptime: 0,
              responseTime: 0,
              errorRate: 100,
              syncedRecords: 5281
            },
            hipaaCompliant: true
          }
        ],
        available: [
          {
            id: "nextgen-fhir",
            name: "NextGen Healthcare FHIR",
            type: "FHIR",
            version: "R4",
            description: "FHIR integration with NextGen Healthcare EHR system",
            setupComplexity: "Medium",
            certifications: ["ONC-ACB", "HIPAA BAA"],
            dataAccess: ["Patient Demographics", "Clinical Data", "Scheduling", "Billing"],
            averageSetupTime: "2-3 days"
          },
          {
            id: "eclinicalworks-api",
            name: "eClinicalWorks API",
            type: "Proprietary",
            version: "11.0",
            description: "Integration with eClinicalWorks EHR through their proprietary API",
            setupComplexity: "Complex",
            certifications: ["ONC-ACB", "HIPAA BAA", "EHNAC"],
            dataAccess: ["Patient Data", "Clinical Records", "Appointments", "Billing"],
            averageSetupTime: "3-5 days"
          },
          {
            id: "meditech-fhir",
            name: "MEDITECH FHIR API",
            type: "FHIR",
            version: "R4",
            description: "Standards-based integration with MEDITECH Expanse EHR",
            setupComplexity: "Medium",
            certifications: ["ONC-ACB", "HIPAA BAA"],
            dataAccess: ["Patient Demographics", "Clinical Data", "Medications", "Lab Results"],
            averageSetupTime: "2-4 days"
          }
        ]
      };
    }
  });
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Degraded</Badge>;
      case "inactive":
        return <Badge className="bg-gray-500 hover:bg-gray-600">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "inactive":
        return <Power className="h-5 w-5 text-gray-500" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };
  
  // Filter integrations by search query
  const filterIntegrations = (list: any[]) => {
    if (!list) return [];
    if (!searchQuery) return list;
    
    return list.filter(integration => 
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };
  
  const filteredConnected = ehrIntegrations?.connected ? filterIntegrations(ehrIntegrations.connected) : [];
  const filteredAvailable = ehrIntegrations?.available ? filterIntegrations(ehrIntegrations.available) : [];
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EHR Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Manage electronic health record system integrations and data synchronization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>
          <Button>
            <Link className="h-4 w-4 mr-2" />
            Connect EHR
          </Button>
        </div>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connected">Connected Systems</TabsTrigger>
          <TabsTrigger value="available">Available Integrations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="connected" className="mt-6">
          <div className="bg-card rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">EHR System</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      Loading integrations...
                    </TableCell>
                  </TableRow>
                ) : filteredConnected.length > 0 ? (
                  filteredConnected.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          {integration.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {integration.type === "FHIR" ? (
                            <FileJson className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FileCode className="h-4 w-4 text-purple-500" />
                          )}
                          {integration.type}
                        </div>
                      </TableCell>
                      <TableCell>{integration.version}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(integration.status)}
                          {getStatusBadge(integration.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(integration.lastSync).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-40">
                          <div className="flex justify-between items-center text-xs">
                            <span>Response Time</span>
                            <span>{integration.metrics.responseTime}ms</span>
                          </div>
                          <Progress 
                            value={Math.max(0, 100 - (integration.metrics.responseTime / 10))} 
                            className="h-1.5" 
                          />
                          <div className="flex justify-between items-center text-xs">
                            <span>Uptime</span>
                            <span>{integration.metrics.uptime}%</span>
                          </div>
                          <Progress 
                            value={integration.metrics.uptime} 
                            className="h-1.5" 
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" disabled={integration.status === "inactive"}>
                            <RefreshCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                      No integrations found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        
        <TabsContent value="available" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isLoading ? (
              <p>Loading available integrations...</p>
            ) : filteredAvailable.length > 0 ? (
              filteredAvailable.map((integration) => (
                <Card key={integration.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          <Stethoscope className="h-5 w-5" />
                        </div>
                        <CardTitle>{integration.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {integration.type}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">{integration.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-1">Version</h4>
                          <p className="text-sm">{integration.version}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-1">Setup Complexity</h4>
                          <p className="text-sm">{integration.setupComplexity}</p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-1">Certifications</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {integration.certifications.map((cert, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="data-access">
                          <AccordionTrigger className="text-sm font-medium">
                            Available Data
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-1">
                              {integration.dataAccess.map((data, index) => (
                                <li key={index} className="text-sm flex items-center gap-1.5">
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                  {data}
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <div className="text-sm text-muted-foreground">
                      Setup time: {integration.averageSetupTime}
                    </div>
                    <Button>
                      <Link className="h-4 w-4 mr-2" />
                      Connect
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <p className="col-span-full text-center py-8 text-muted-foreground">
                No integrations found matching your search.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}