import { useLocation } from "wouter";
import { AlertTriangle, Construction } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlaceholderPage() {
  const [location] = useLocation();
  const pathSegments = location.split('/').filter(Boolean);
  const pageName = pathSegments[pathSegments.length - 1]
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  const getPageTitle = () => {
    // Handle special cases
    if (location.includes('/mfa')) return 'Multi-Factor Authentication';
    if (location.includes('/sso')) return 'Single Sign-On';
    if (location.includes('/smtp')) return 'SMTP Configuration';
    if (location.includes('/ehr')) return 'EHR Integration';
    if (location.includes('/phi')) return 'PHI Management';
    if (location.includes('/jwt')) return 'JWT Settings';
    if (location.includes('/ip-')) return 'IP Filtering';
    if (location.includes('/a2a')) return 'Agent-to-Agent Orchestration';
    
    // Default to capitalized page name from URL
    return pageName;
  };
  
  const getPageDescription = () => {
    const baseDescription = `This page will provide ${getPageTitle().toLowerCase()} features and functionality. `;
    
    // Customized descriptions based on path
    if (location.includes('/security')) {
      return baseDescription + 'Security features help protect your MCP infrastructure from threats and vulnerabilities.';
    }
    if (location.includes('/healthcare')) {
      return baseDescription + 'Healthcare features are designed for HIPAA compliance and clinical data management.';
    }
    if (location.includes('/compliance')) {
      return baseDescription + 'Compliance features help meet regulatory requirements and industry standards.';
    }
    if (location.includes('/infrastructure')) {
      return baseDescription + 'Infrastructure components support your MCP deployment and ensure high availability.';
    }
    if (location.includes('/integrations')) {
      return baseDescription + 'Integration features connect your MCP platform with external systems and services.';
    }
    if (location.includes('/financial')) {
      return baseDescription + 'Financial features support SEC, FINRA, and MiFID II compliance requirements.';
    }
    if (location.includes('/workspaces')) {
      return baseDescription + 'Workspace management enables collaboration and resource allocation across teams.';
    }
    
    return baseDescription + 'This feature is currently under development and will be available soon.';
  };
  
  const getPageCategory = () => {
    if (location.includes('/security')) return 'Security Center';
    if (location.includes('/healthcare')) return 'Healthcare';
    if (location.includes('/compliance')) return 'Compliance & Governance';
    if (location.includes('/infrastructure')) return 'Infrastructure';
    if (location.includes('/integrations')) return 'Integration Hub';
    if (location.includes('/financial')) return 'Financial Services';
    if (location.includes('/system')) return 'System Configuration';
    if (location.includes('/access-manager')) return 'Access Manager';
    if (location.includes('/workspaces')) return 'Workspaces';
    if (location.includes('/agent')) return 'AI Agents';
    if (location.includes('/tool')) return 'Tools & APIs';
    
    return 'Platform';
  };
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{getPageTitle()}</h1>
          <div className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-500">
            Under Development
          </div>
        </div>
        <p className="text-muted-foreground mt-2">
          {getPageCategory()} / {getPageTitle()}
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5 text-amber-500" />
            <span>Feature Under Development</span>
          </CardTitle>
          <CardDescription>
            {getPageDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="max-w-md text-muted-foreground mb-6">
              This page is currently under active development. The complete 
              functionality will be available in an upcoming release.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button onClick={() => window.location.href = "/"}>
                Return to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}