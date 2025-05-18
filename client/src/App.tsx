import React, { Suspense, lazy, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { SidebarProvider } from "@/lib/sidebar-context";
import { AppLayout } from "@/components/layout/app-layout";
import { I18nProvider } from "@/lib/i18n-provider";
import { PresenceProvider } from "@/context/PresenceContext";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import ServersPage from "@/pages/servers-page";
import WorkspacePage from "@/pages/workspace-page";
import AuditPage from "@/pages/audit-page";
import ForbiddenPage from "@/pages/forbidden-page";
import ToolsPage from "@/pages/tools-page";
import PoliciesPage from "@/pages/policies-page";
import UsersPage from "@/pages/users-page";
import AnalyticsPage from "@/pages/analytics-page";
import SettingsPage from "@/pages/settings-page";
import ProfilePage from "@/pages/profile-page";
import PluginsPage from "@/pages/plugins-page";
import ApiKeysPage from "@/pages/api-keys-page";
import IpAccessRulesPage from "@/pages/ip-access-rules-page";
import LdapDirectoriesPage from "@/pages/ldap-directories-page";
import SecurityPoliciesPage from "@/pages/security-policies-page";
import CompliancePage from "@/pages/compliance-page";

// Newly implemented pages
import ClinicalToolsPage from "@/pages/healthcare/clinical-tools-page";
import EhrIntegrationsPage from "@/pages/healthcare/ehr-integrations-page";
import { VaultPage } from "@/pages/security";
import PrivacyControlsPage from "@/pages/compliance/privacy-page";
import DebugPage from "@/pages/debug-page";
import ActivityLogsPage from "@/pages/activity-logs-page";
import { queryClient } from "@/lib/queryClient";
// Import the new page components
import McpServersPage from "@/pages/mcp-servers-page";
import ConnectionPoolPage from "@/pages/connection-pool-page";
import ServerHealthPage from "@/pages/server-health-page";
import ServerMetricsPage from "@/pages/server-metrics-page";
import AgentsPage from "@/pages/agents-page";
import AgentTypesPage from "@/pages/agent-types-page";
import AgentMetricsPage from "@/pages/agent-metrics-page";
import A2aOrchestrationPage from "@/pages/a2a-orchestration-page";
import ToolVersionsPage from "@/pages/tool-versions-page";
import OAuthSettingsPage from "@/pages/settings/oauth-settings-page";
import ConnectionSettingsPage from "@/pages/connection-settings-page";

// Import integration pages
import SsoPage from "@/pages/integrations/sso-page";
import ScimPage from "@/pages/integrations/scim-page";
import TicketingPage from "@/pages/integrations/ticketing-page";
import SmtpPage from "@/pages/integrations/smtp-page";
import CollaborationPage from "@/pages/collaboration-page";
import CollaborationDemoPage from "@/pages/collaboration-demo-page";
import SiemIntegrationPage from "@/pages/integration-hub/security-tooling/siem-integration-page";
import CasbIntegrationPage from "@/pages/integration-hub/security-tooling/casb-integration-page";

// Import System Configuration pages
import BrandingPage from "@/pages/system/branding-page";
import IntegrationsPage from "@/pages/system/integrations-page";
import DatabasePage from "@/pages/system/database-page";
import CommunicationPage from "@/pages/system/communication-page";
import MonitoringPage from "@/pages/system/monitoring-page";
import ModuleConfigPage from "@/pages/system/module-config-page";
import GeoRedundancyPage from "@/pages/system/geo-redundancy-page";

// Import Access Manager pages
import AccessManagerDashboard from "@/pages/access-manager/index";
import ClientManagementPage from "@/pages/access-manager/client-management-page";
import AuditLogsPage from "@/pages/access-manager/audit-logs";
import RolePermissionsPage from "@/pages/access-manager/role-permissions-page";
import AccessPoliciesPage from "@/pages/access-manager/access-policies-page";
import JwtSettingsPage from "@/pages/access-manager/jwt-settings";
import JwtVerificationPage from "@/pages/access-manager/jwt-verification-page";

// Import Healthcare pages
import PhiManagementPage from "@/pages/healthcare/phi-management-page";

// Import Financial Services pages
import AnomalyDetectionTestPage from "@/pages/financial/anomaly-detection-test";

// Import Marketplace pages
import MarketplacePage from "@/pages/marketplace/marketplace-page";
import ConnectorDetailsPage from "@/pages/marketplace/connector-details-page";
import SubmitConnectorPage from "@/pages/marketplace/submit-connector-page";
import MyConnectorsPage from "@/pages/marketplace/my-connectors-page";

// Import Integrations pages
import { 
  MonitoringLandingPage,
  AddIntegrationPage,
  IntegrationDetailsPage 
} from "@/pages/integration-hub/monitoring";
import ApiGatewayPage from "@/pages/integration-hub/api-network/api-gateway-page";
import WafPage from "@/pages/integration-hub/api-network/waf-page";

// Import Data Storage & BI Integration pages
import DataStorageLandingPage from "@/pages/integration-hub/data-storage/data-storage-landing";
import { default as DataStorageAddIntegrationPage } from "@/pages/integration-hub/data-storage/add-integration";
import { default as DataStorageIntegrationDetailsPage } from "@/pages/integration-hub/data-storage/integration-details";
import BIToolConnectorPage from "@/pages/integration-hub/data-storage/bi-tool-connector";

// Import placeholder page for routes under development
import PlaceholderPage from "@/pages/placeholder-page";
import WebSocketTestPage from "@/pages/websocket-test-page";

// Lazy-loaded components
const LazyMessagingPage = lazy(() => import("@/pages/integrations/messaging-page"));
const LazyVaultPage = lazy(() => import("@/pages/security/vault-page"));
const LazyFileStoragePage = lazy(() => import("@/pages/integrations/file-storage"));
const LazyDataStoragePage = lazy(() => import("@/pages/integrations/data-storage-page"));
const LazyToolCatalogPage = lazy(() => import("@/pages/tool-catalog-page"));

function AppRoutes() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth">
        <AuthPage />
      </Route>
      <Route path="/forbidden">
        <ForbiddenPage />
      </Route>
      <Route path="/debug">
        <DebugPage />
      </Route>
      
      <Route path="/websocket-test">
        <WebSocketTestPage />
      </Route>
      
      {/* Protected routes with specific permissions */}
      <ProtectedRoute path="/">
        <DashboardPage />
      </ProtectedRoute>
      <ProtectedRoute 
        path="/analytics" 
        requiredPermission="analytics:view"
      >
        <AnalyticsPage />
      </ProtectedRoute>
      <ProtectedRoute 
        path="/activity-logs"
      >
        <ActivityLogsPage />
      </ProtectedRoute>
      
      {/* MCP Server routes */}
      <ProtectedRoute 
        path="/mcp-servers" 
        requiredPermission="servers:view"
      >
        <McpServersPage />
      </ProtectedRoute>
      <ProtectedRoute 
        path="/connection-pool" 
        requiredPermission="servers:view"
      >
        <ConnectionPoolPage />
      </ProtectedRoute>
      <ProtectedRoute 
        path="/server-health" 
        requiredPermission="servers:view"
      >
        <ServerHealthPage />
      </ProtectedRoute>
      <ProtectedRoute 
        path="/server-metrics" 
        requiredPermission="servers:view"
      >
        <ServerMetricsPage />
      </ProtectedRoute>
      <ProtectedRoute 
        path="/servers" 
        requiredPermission="servers:view"
      >
        <ServersPage />
      </ProtectedRoute>
      
      {/* Agent routes */}
      <ProtectedRoute 
        path="/agents" 
        component={AgentsPage} 
        requiredPermission="agents:view"
      />
      <ProtectedRoute 
        path="/agent-types" 
        component={AgentTypesPage} 
        requiredPermission="agents:view"
      />
      <ProtectedRoute 
        path="/agent-metrics" 
        component={AgentMetricsPage} 
        requiredPermission="agents:view"
      />
      <ProtectedRoute 
        path="/a2a-orchestration" 
        component={A2aOrchestrationPage} 
        requiredPermission="agents:view"
      />
      
      {/* Tools routes */}
      <ProtectedRoute 
        path="/tools" 
        component={ToolsPage} 
        requiredPermission="tools:view"
      />
      <ProtectedRoute 
        path="/tool-versions" 
        component={ToolVersionsPage} 
        requiredPermission="tools:view"
      />
      <ProtectedRoute 
        path="/api-keys" 
        component={ApiKeysPage} 
        requiredPermission="api:manage"
      />
      
      {/* Workspace routes */}
      <ProtectedRoute 
        path="/workspaces" 
        component={WorkspacePage} 
        requiredPermission="workspaces:view"
      />
      <ProtectedRoute 
        path="/collaboration" 
        component={CollaborationPage} 
        requiredPermission="workspaces:view"
      />
      <ProtectedRoute 
        path="/collaboration/demo" 
        component={CollaborationDemoPage} 
        requiredPermission="workspaces:view"
      />
      
      {/* Admin routes */}
      <ProtectedRoute 
        path="/policies" 
        component={PoliciesPage} 
        requiredPermission="policies:view"
      />
      <ProtectedRoute 
        path="/users" 
        component={UsersPage} 
        requiredPermission="users:view"
      />
      <ProtectedRoute 
        path="/audit" 
        component={AuditPage} 
        requiredPermission="audit:view"
      />
      <ProtectedRoute 
        path="/settings" 
        component={SettingsPage} 
        requiredPermission="settings:view"
      />
      <ProtectedRoute 
        path="/settings/oauth" 
        component={OAuthSettingsPage} 
        requiredPermission="settings:oauth"
      />
      <ProtectedRoute 
        path="/profile" 
        component={ProfilePage} 
      />
      <ProtectedRoute 
        path="/plugins" 
        component={PluginsPage} 
        requiredPermission="plugins:view"
      />
      <ProtectedRoute 
        path="/ip-access-rules" 
        component={IpAccessRulesPage} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/ldap-directories" 
        component={LdapDirectoriesPage} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/security-policies" 
        component={SecurityPoliciesPage} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/compliance" 
        component={CompliancePage} 
        requiredPermission="compliance:manage"
      />
      
      {/* Access Manager routes */}
      <ProtectedRoute 
        path="/access-manager" 
        component={AccessManagerDashboard} 
        requiredPermission="admin.access"
      />
      <ProtectedRoute 
        path="/access-manager/client-management" 
        component={ClientManagementPage} 
        requiredPermission="oauth:client:read"
      />
      <ProtectedRoute 
        path="/access-manager/audit-logs" 
        component={AuditLogsPage} 
        requiredPermission="audit:read"
      />
      <ProtectedRoute 
        path="/access-manager/role-management" 
        component={RolePermissionsPage} 
        requiredPermission="admin.roles"
      />
      <ProtectedRoute 
        path="/access-manager/permission-sets" 
        component={AccessPoliciesPage} 
        requiredPermission="admin.permissions"
      />
      
      {/* System Configuration routes */}
      <ProtectedRoute 
        path="/system/branding" 
        component={BrandingPage} 
        requiredPermission="admin.system.branding"
      />
      <ProtectedRoute 
        path="/system/integrations" 
        component={IntegrationsPage} 
        requiredPermission="admin.system.integrations"
      />
      <ProtectedRoute 
        path="/system/database" 
        component={DatabasePage} 
        requiredPermission="admin.system.database"
      />
      <ProtectedRoute 
        path="/system/communication" 
        component={CommunicationPage} 
        requiredPermission="admin.system.communication"
      />
      <ProtectedRoute 
        path="/system/monitoring" 
        component={MonitoringPage} 
        requiredPermission="admin.system.monitoring"
      />
      <ProtectedRoute 
        path="/system/modules" 
        component={ModuleConfigPage} 
        requiredPermission="admin.system.modules"
      />
      <ProtectedRoute 
        path="/system/geo-redundancy" 
        component={GeoRedundancyPage} 
        requiredPermission="admin.system.infrastructure"
      />
      
      {/* Healthcare routes */}
      <ProtectedRoute 
        path="/healthcare/phi-management" 
        component={PhiManagementPage} 
        requiredPermission="healthcare:phi:manage"
      />
      
      {/* Financial Services routes */}
      <ProtectedRoute 
        path="/financial/anomaly-detection-test" 
        component={AnomalyDetectionTestPage} 
        requiredPermission="financial:anomaly:test"
      />
      
      {/* Healthcare routes - Implemented */}
      <ProtectedRoute 
        path="/healthcare/clinical-tools" 
        component={ClinicalToolsPage} 
        requiredPermission="healthcare:tools:manage"
      />
      <ProtectedRoute 
        path="/healthcare/ehr-integrations" 
        component={EhrIntegrationsPage} 
        requiredPermission="healthcare:ehr:manage"
      />
      
      {/* Workspace Members */}
      <ProtectedRoute 
        path="/workspaces/members" 
        component={lazy(() => import("@/pages/workspace-members-page"))}
        requiredPermission="workspaces:view"
      />
      <ProtectedRoute 
        path="/workspaces/resources" 
        component={lazy(() => {
          console.log("Loading workspace resources page");
          return import("@/pages/workspace-resources-page");
        })}
        requiredPermission="workspaces:view"
      />
      
      {/* Marketplace routes */}
      <ProtectedRoute 
        path="/marketplace" 
        component={MarketplacePage} 
        requiredPermission="marketplace:view"
      />
      <ProtectedRoute 
        path="/marketplace/connectors/:slug" 
        component={ConnectorDetailsPage} 
        requiredPermission="marketplace:view"
      />
      <ProtectedRoute 
        path="/marketplace/submit" 
        component={SubmitConnectorPage} 
        requiredPermission="marketplace:publish"
      />
      <ProtectedRoute 
        path="/marketplace/my-connectors" 
        component={MyConnectorsPage} 
        requiredPermission="marketplace:view"
      />
      
      {/* Missing routes - MCP Servers */}
      <ProtectedRoute 
        path="/connection-settings" 
        component={ConnectionSettingsPage} 
        requiredPermission="servers:view"
      />
      <ProtectedRoute 
        path="/tool-catalog" 
        component={LazyToolCatalogPage} 
        requiredPermission="tools:view"
      />
      
      {/* Missing routes - Access Manager */}
      <ProtectedRoute 
        path="/access-manager/permission-sets" 
        component={PlaceholderPage} 
        requiredPermission="admin.roles"
      />
      <ProtectedRoute 
        path="/access-manager/identity-providers" 
        component={lazy(() => import("@/pages/access-manager/identity-providers-page"))} 
        requiredPermission="admin.identity"
      />
      <ProtectedRoute 
        path="/access-manager/jwt-settings" 
        component={JwtSettingsPage} 
        requiredPermission="admin.security"
      />
      <ProtectedRoute 
        path="/access-manager/jwt-verification" 
        component={JwtVerificationPage} 
        requiredPermission="admin.security"
      />
      
      {/* Security Center */}
      <ProtectedRoute 
        path="/breach-detection" 
        component={lazy(() => import('@/pages/breach-detection/index'))} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/breach-detection/rules" 
        component={lazy(() => import('@/pages/breach-detection/rules/index'))} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/breach-detection/rules/new" 
        component={lazy(() => import('@/pages/breach-detection/rules/new'))} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/breach-detection/breaches/new" 
        component={lazy(() => import('@/pages/breach-detection/breaches/new'))} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/breach-detection/breaches/:id" 
        component={lazy(() => import('@/pages/breach-detection/breach-detail'))} 
        requiredPermission="security:manage"
      />
      <ProtectedRoute 
        path="/security/scanner" 
        component={lazy(() => import('@/pages/security/scanner-page'))} 
        requiredPermission="admin.security.scanner"
      />
      <ProtectedRoute 
        path="/security/certificates" 
        component={PlaceholderPage} 
        requiredPermission="admin.security.certificates"
      />
      <ProtectedRoute 
        path="/security/ip-filtering" 
        component={PlaceholderPage} 
        requiredPermission="admin.security.ip"
      />
      <ProtectedRoute 
        path="/security/vault" 
        component={VaultPage} 
        requiredPermission="admin.security.vault"
      />
      
      {/* Missing routes - AI Agents */}
      <ProtectedRoute 
        path="/agent-monitoring" 
        component={PlaceholderPage} 
        requiredPermission="agents:view"
      />
      <ProtectedRoute 
        path="/agent-logs" 
        component={PlaceholderPage} 
        requiredPermission="agents:view"
      />
      
      {/* Missing routes - Administration */}
      {/* Redirecting /roles to /access-manager/role-management */}
      <Route 
        path="/roles"
        component={() => {
          useEffect(() => {
            window.location.href = '/access-manager/role-management';
          }, []);
          return <div>Redirecting to Role Management...</div>;
        }}
      />

      {/* Redirecting /integrations/secrets to /security/vault */}
      <Route 
        path="/integrations/secrets"
        component={() => {
          useEffect(() => {
            window.location.href = '/security/vault?tab=secrets&from=integrations_secrets';
          }, []);
          return <div>Redirecting to Vault...</div>;
        }}
      />
      {/* Directory integration removed as requested */}
      <ProtectedRoute 
        path="/audit-reports" 
        component={PlaceholderPage} 
        requiredPermission="admin.audit"
      />
      <ProtectedRoute 
        path="/system-backup" 
        component={PlaceholderPage} 
        requiredPermission="admin.backup"
      />
      <ProtectedRoute 
        path="/platform-updates" 
        component={PlaceholderPage} 
        requiredPermission="admin.updates"
      />
      
      {/* Missing routes - Tools & APIs */}
      <ProtectedRoute 
        path="/webhooks" 
        component={PlaceholderPage} 
      />
      <ProtectedRoute 
        path="/tokens" 
        component={PlaceholderPage} 
      />
      <ProtectedRoute 
        path="/api-gateway" 
        component={PlaceholderPage} 
      />
      <ProtectedRoute 
        path="/graphql-console" 
        component={PlaceholderPage} 
      />
      
      {/* Missing routes - Infrastructure */}
      <ProtectedRoute 
        path="/infrastructure/database" 
        component={PlaceholderPage} 
        requiredPermission="admin.infrastructure.database"
      />
      <ProtectedRoute 
        path="/infrastructure/load-balancers" 
        component={PlaceholderPage} 
        requiredPermission="admin.infrastructure.loadbalancer"
      />
      <ProtectedRoute 
        path="/infrastructure/edge-proxies" 
        component={PlaceholderPage} 
        requiredPermission="admin.infrastructure.proxy"
      />
      <ProtectedRoute 
        path="/infrastructure/cache" 
        component={PlaceholderPage} 
        requiredPermission="admin.infrastructure.cache"
      />
      <ProtectedRoute 
        path="/infrastructure/queues" 
        component={PlaceholderPage} 
        requiredPermission="admin.infrastructure.queue"
      />
      
      {/* Integration Hub - Identity & Access Management */}
      <ProtectedRoute 
        path="/integrations/identity" 
        component={PlaceholderPage} 
        requiredPermission="admin.integrations.identity"
      />
      <ProtectedRoute 
        path="/integrations/sso" 
        component={SsoPage} 
        requiredPermission="admin.integrations.sso"
      />
      {/* Directory integration removed as requested */}
      <ProtectedRoute 
        path="/integrations/scim" 
        component={ScimPage} 
        requiredPermission="admin.integrations.scim"
      />
      
      {/* Integration Hub - IT Service Management */}
      <ProtectedRoute 
        path="/integrations/ticketing" 
        component={TicketingPage} 
        requiredPermission="admin.integrations.ticketing"
      />
      
      {/* Integration Hub - Data Storage & BI */}
      <ProtectedRoute 
        path="/integrations/data-storage" 
        component={LazyDataStoragePage} 
        requiredPermission="integrations:data:view"
      />
      
      {/* Integration Hub - Communication & Notification */}
      <ProtectedRoute 
        path="/integrations/smtp" 
        component={SmtpPage} 
        requiredPermission="admin.integrations.smtp"
      />
      <ProtectedRoute 
        path="/integrations/messaging" 
        component={LazyMessagingPage} 
        requiredPermission="admin.integrations.messaging"
      />
      
      {/* Integration Hub - API & Network */}
      <ProtectedRoute 
        path="/integrations/api-gateway" 
        component={ApiGatewayPage} 
        requiredPermission="admin.integrations.api"
      />
      <ProtectedRoute 
        path="/integrations/waf" 
        component={WafPage} 
        requiredPermission="admin.integrations.security"
      />
      
      {/* Integration Hub - Monitoring & Observability */}
      {/* New monitoring integration routes */}
      <ProtectedRoute 
        path="/integration-hub/monitoring" 
        component={MonitoringLandingPage}
        requiredPermission="admin.integrations.monitoring"
      />
      <ProtectedRoute 
        path="/integration-hub/monitoring/new" 
        component={AddIntegrationPage} 
        requiredPermission="admin.integrations.monitoring"
      />
      <ProtectedRoute 
        path="/integration-hub/monitoring/:id" 
        component={IntegrationDetailsPage} 
        requiredPermission="admin.integrations.monitoring"
      />
      
      {/* Original routes for backward compatibility */}
      <ProtectedRoute 
        path="/integrations/monitoring" 
        component={MonitoringLandingPage} 
        requiredPermission="admin.integrations.monitoring"
      />
      <ProtectedRoute 
        path="/integrations/apm" 
        component={MonitoringLandingPage} 
        requiredPermission="admin.integrations.apm"
      />
      <ProtectedRoute 
        path="/integrations/logging" 
        component={MonitoringLandingPage} 
        requiredPermission="admin.integrations.logging"
      />
      
      {/* Integration Hub - Data Storage & BI Integration */}
      <ProtectedRoute 
        path="/integration-hub/data-storage" 
        component={DataStorageLandingPage} 
        requiredPermission="admin.integrations.database"
      />
      <ProtectedRoute 
        path="/integration-hub/data-storage/new" 
        component={DataStorageAddIntegrationPage} 
        requiredPermission="admin.integrations.database"
      />
      <ProtectedRoute 
        path="/integration-hub/data-storage/bi-tool" 
        component={BIToolConnectorPage} 
        requiredPermission="admin.integrations.bi"
      />
      <ProtectedRoute 
        path="/integration-hub/data-storage/:id" 
        component={DataStorageIntegrationDetailsPage} 
        requiredPermission="admin.integrations.database"
      />
      
      {/* Legacy routes for backward compatibility */}
      <ProtectedRoute 
        path="/integrations/databases" 
        component={DataStorageLandingPage} 
        requiredPermission="admin.integrations.database"
      />
      <ProtectedRoute 
        path="/integrations/data-warehouse" 
        component={DataStorageLandingPage} 
        requiredPermission="admin.integrations.warehouse"
      />
      <ProtectedRoute 
        path="/integrations/bi-tools" 
        component={DataStorageLandingPage} 
        requiredPermission="admin.integrations.bi"
      />
      
      {/* Integration Hub - Security Tooling */}
      <ProtectedRoute 
        path="/integrations/siem" 
        component={SiemIntegrationPage} 
        requiredPermission="admin.integrations.siem"
      />
      <ProtectedRoute 
        path="/integrations/casb" 
        component={CasbIntegrationPage} 
        requiredPermission="admin.integrations.casb"
      />
      {/* Route removed - duplicate of the one above */}
      
      {/* Integration Hub - Enterprise File Storage */}
      <ProtectedRoute 
        path="/integrations/file-storage" 
        component={LazyFileStoragePage} 
        requiredPermission="admin.integrations.files"
      />
      
      {/* Integration Hub - Workflow Automation */}
      <ProtectedRoute 
        path="/integrations/webhooks" 
        component={PlaceholderPage} 
        requiredPermission="admin.integrations.webhooks"
      />
      <ProtectedRoute 
        path="/integrations/ipaas" 
        component={PlaceholderPage} 
        requiredPermission="admin.integrations.ipaas"
      />
      
      {/* Integration Hub - Support */}
      <ProtectedRoute 
        path="/integrations/support" 
        component={PlaceholderPage} 
        requiredPermission="admin.integrations.support"
      />
      
      {/* Missing routes - Compliance & Governance */}
      <ProtectedRoute 
        path="/compliance/policies" 
        component={PlaceholderPage} 
        requiredPermission="admin.compliance.policy"
      />
      <ProtectedRoute 
        path="/compliance/data-retention" 
        component={PlaceholderPage} 
        requiredPermission="admin.compliance.retention"
      />
      <ProtectedRoute 
        path="/compliance/reports" 
        component={PlaceholderPage} 
        requiredPermission="admin.compliance.reports"
      />
      <ProtectedRoute 
        path="/compliance/privacy" 
        component={PrivacyControlsPage} 
        requiredPermission="admin.compliance.privacy"
      />
      <ProtectedRoute 
        path="/compliance/risk" 
        component={PlaceholderPage} 
        requiredPermission="admin.compliance.risk"
      />
      
      {/* Missing routes - System Configuration */}
      <ProtectedRoute 
        path="/system/email-templates" 
        component={PlaceholderPage} 
        requiredPermission="admin.system.communication"
      />
      <ProtectedRoute 
        path="/system/smtp" 
        component={SmtpPage} 
        requiredPermission="admin.system.communication"
      />
      <ProtectedRoute 
        path="/system/ai-providers" 
        component={PlaceholderPage} 
        requiredPermission="admin.system.ai"
      />
      
      {/* Catch-all route */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

// Authenticated Layout component that only renders when user is logged in
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  
  // Don't render the layout for auth and forbidden pages
  if (location.startsWith('/auth') || location === '/forbidden') {
    return <>{children}</>;
  }
  
  // Don't render the layout if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <>{children}</>;
  }
  
  // Render the full layout with sidebar when authenticated
  return (
    <SidebarProvider>
      <PresenceProvider>
        <AppLayout>
          {children}
        </AppLayout>
      </PresenceProvider>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <I18nProvider>
          <ThemeProvider defaultTheme="dark" storageKey="nexus-ui-theme">
            <AuthProvider>
              <AuthenticatedLayout>
                <AppRoutes />
              </AuthenticatedLayout>
              <Toaster />
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </Suspense>
    </QueryClientProvider>
  );
}

export default App;
