import { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Archive,
  AreaChart,
  ArrowRightLeft,
  BarChart3,
  Bell,
  Box,
  ClipboardCheck,
  Cog,
  Cpu,
  Database,
  FileDigit,
  FileKey,
  FileSpreadsheet,
  FileText,
  FileLock2,
  FolderTree,
  Globe,
  HeartPulse,
  Home,
  Key,
  KeyRound,
  Layers,
  LayoutDashboard,
  LineChart,
  Link,
  Lock,
  LockKeyhole,
  Mail,
  MessageSquare,
  MonitorCheck,
  Network,
  PackageOpen,
  PaintBucket,
  Plug,
  Puzzle,
  QrCode,
  Recycle,
  RefreshCcw,
  Scale,
  Scissors,
  Server,
  ServerCog,
  Settings,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
  Terminal,
  TicketCheck,
  Trash2,
  UserCog,
  Users,
  UserCheck,
  Wallet,
  Webhook,
  Wrench,
  FileStack,
  Gauge,
  ShieldCheck,
  Building2,
  CloudCog,
  Fingerprint,
  BarChartHorizontal,
  LifeBuoy,
  MessageCircle,
  BadgeAlert,
  Router,
  NetworkIcon,
  Unlock
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  color?: string;
  badge?: string;
  requiresPermission?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
  requiresPermission?: string;
}

export const navigation: NavGroup[] = [
  {
    id: "overview",
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: Home,
      },
      {
        title: "Analytics",
        href: "/analytics",
        icon: BarChart3,
      },
      {
        title: "Activity Logs",
        href: "/activity-logs",
        icon: FileText,
      },
    ],
  },
  {
    id: "workspaces",
    title: "Workspaces",
    items: [
      {
        title: "Workspace Management",
        href: "/workspaces",
        icon: LayoutDashboard,
      },
      {
        title: "Workspace Members",
        href: "/workspaces/members",
        icon: Users,
      },
      {
        title: "Resource Allocation",
        href: "/workspaces/resources",
        icon: SlidersHorizontal,
      },
      {
        title: "Collaboration",
        href: "/collaboration",
        icon: MessageCircle,
      },
      {
        title: "Collaboration Demo",
        href: "/collaboration/demo",
        icon: MessageSquare,
      },
    ],
  },
  {
    id: "mcp-servers",
    title: "MCP Servers",
    items: [
      {
        title: "Server Management",
        href: "/mcp-servers",
        icon: Server,
      },
      {
        title: "Server Health",
        href: "/server-health",
        icon: MonitorCheck,
      },
      {
        title: "Connection Settings",
        href: "/connection-settings",
        icon: Network,
      },
      {
        title: "Tool Catalog",
        href: "/tool-catalog",
        icon: Wrench,
      },
    ],
  },
  {
    id: "access-manager",
    title: "Access Manager",
    requiresPermission: "admin.access",
    items: [
      {
        title: "Dashboard",
        href: "/access-manager",
        icon: LayoutDashboard,
        requiresPermission: "admin.access",
      },
      {
        title: "Role Management",
        href: "/access-manager/role-management",
        icon: UserCog,
        requiresPermission: "admin.roles",
      },
      {
        title: "Access Policies",
        href: "/access-manager/permission-sets",
        icon: FileKey,
        requiresPermission: "admin.roles",
      },
      {
        title: "OAuth Clients",
        href: "/access-manager/client-management",
        icon: KeyRound,
        requiresPermission: "oauth:client:read",
      },
      {
        title: "Identity Providers",
        href: "/access-manager/identity-providers",
        icon: UserCheck,
        requiresPermission: "admin.identity",
      },
      {
        title: "JWT Settings",
        href: "/access-manager/jwt-settings",
        icon: FileDigit,
        requiresPermission: "admin.security",
      },
      {
        title: "Audit Logs",
        href: "/access-manager/audit-logs",
        icon: FileText,
        requiresPermission: "audit:read",
      },
    ],
  },
  {
    id: "security-center",
    title: "Security Center",
    requiresPermission: "admin.security",
    items: [
      {
        title: "Security Scanner",
        href: "/security/scanner",
        icon: Shield,
        requiresPermission: "admin.security.scanner",
      },
      {
        title: "Breach Detection",
        href: "/breach-detection",
        icon: ShieldAlert,
        requiresPermission: "security:manage",
      },
      {
        title: "Breach Detection Rules",
        href: "/breach-detection/rules",
        icon: FileStack,
        requiresPermission: "security:manage",
      },
      {
        title: "Certificate Management",
        href: "/security/certificates",
        icon: FileKey,
        requiresPermission: "admin.security.certificates",
      },
      {
        title: "IP Filtering",
        href: "/security/ip-filtering",
        icon: LockKeyhole,
        requiresPermission: "admin.security.ip",
      },
      {
        title: "Vault Integration",
        href: "/security/vault",
        icon: Wallet,
        requiresPermission: "admin.security.vault",
      },
    ],
  },
  {
    id: "ai-agents",
    title: "AI Agents",
    items: [
      {
        title: "Agent Registry",
        href: "/agents",
        icon: Box,
      },
      {
        title: "Agent Monitoring",
        href: "/agent-monitoring",
        icon: AreaChart,
      },
      {
        title: "Execution Logs",
        href: "/agent-logs",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    id: "administration",
    title: "Administration",
    requiresPermission: "admin.access",
    items: [
      {
        title: "User Management",
        href: "/users",
        icon: Users,
        requiresPermission: "admin.users",
      },
      {
        title: "Roles & Permissions",
        href: "/access-manager/role-management",
        icon: UserCog,
        requiresPermission: "admin.roles",
      },
      /* Directory integration removed as requested */
      {
        title: "Security Policies",
        href: "/security-policies",
        icon: Shield,
        requiresPermission: "admin.security",
      },
      {
        title: "Audit Reports",
        href: "/audit-reports",
        icon: FileSpreadsheet,
        requiresPermission: "admin.audit",
      },
      {
        title: "System Backup",
        href: "/system-backup",
        icon: Archive,
        requiresPermission: "admin.backup",
      },
      {
        title: "Platform Updates",
        href: "/platform-updates",
        icon: RefreshCcw,
        requiresPermission: "admin.updates",
      },
    ],
  },
  {
    id: "tools-apis",
    title: "Tools & APIs",
    items: [
      {
        title: "API Keys",
        href: "/api-keys",
        icon: Key,
      },
      {
        title: "Webhook Configuration",
        href: "/webhooks",
        icon: Webhook,
      },
      {
        title: "Token Management",
        href: "/tokens",
        icon: QrCode,
      },
      {
        title: "API Gateway",
        href: "/api-gateway",
        icon: ArrowRightLeft, 
      },
      {
        title: "GraphQL Console",
        href: "/graphql-console",
        icon: Terminal,
      },
    ],
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    requiresPermission: "admin.infrastructure",
    items: [
      {
        title: "Database Management",
        href: "/infrastructure/database",
        icon: Database,
        requiresPermission: "admin.infrastructure.database",
      },
      {
        title: "Load Balancers",
        href: "/infrastructure/load-balancers",
        icon: Scale,
        requiresPermission: "admin.infrastructure.loadbalancer",
      },
      {
        title: "Edge Proxies",
        href: "/infrastructure/edge-proxies",
        icon: Globe,
        requiresPermission: "admin.infrastructure.proxy",
      },
      {
        title: "Caching Services",
        href: "/infrastructure/cache",
        icon: PackageOpen,
        requiresPermission: "admin.infrastructure.cache",
      },
      {
        title: "Queue Management",
        href: "/infrastructure/queues",
        icon: RefreshCcw,
        requiresPermission: "admin.infrastructure.queue",
      },
    ],
  },
  {
    id: "integration-hub",
    title: "Integration Hub",
    requiresPermission: "admin.integrations",
    items: [
      // Identity & Access Management (IAM)
      {
        title: "Identity Management",
        href: "/integrations/identity",
        icon: Fingerprint,
        requiresPermission: "admin.integrations.identity",
      },
      {
        title: "SSO Integration",
        href: "/integrations/sso",
        icon: UserCheck,
        requiresPermission: "admin.integrations.sso",
      },
      {
        title: "SCIM User Provisioning",
        href: "/integrations/scim",
        icon: Users,
        requiresPermission: "admin.integrations.scim",
      },
      // IT Service Management
      {
        title: "Ticketing Systems",
        href: "/integrations/ticketing",
        icon: TicketCheck,
        requiresPermission: "admin.integrations.ticketing",
      },
      // Communication & Notification
      {
        title: "SMTP Configuration",
        href: "/integrations/smtp",
        icon: Mail,
        requiresPermission: "admin.integrations.smtp",
      },
      {
        title: "Messaging Platforms",
        href: "/integrations/messaging",
        icon: MessageCircle,
        requiresPermission: "admin.integrations.messaging",
      },
      // API & Network
      {
        title: "API Gateway",
        href: "/integrations/api-gateway",
        icon: Router,
        requiresPermission: "admin.integrations.api",
      },
      {
        title: "WAF Configuration",
        href: "/integrations/waf",
        icon: Shield,
        requiresPermission: "admin.integrations.security",
      },
      // Monitoring & Observability
      {
        title: "Monitoring Systems",
        href: "/integration-hub/monitoring",
        icon: LineChart,
        requiresPermission: "admin.integrations.monitoring",
      },
      {
        title: "APM Integration",
        href: "/integration-hub/monitoring?tab=apm",
        icon: Gauge,
        requiresPermission: "admin.integrations.apm",
      },
      {
        title: "Log Aggregation",
        href: "/integration-hub/monitoring?tab=logging",
        icon: FileStack,
        requiresPermission: "admin.integrations.logging",
      },
      // Data Storage & Analytics
      {
        title: "Data Storage & BI",
        href: "/integration-hub/data-storage",
        icon: Database,
        requiresPermission: "admin.integrations.database",
      },
      // Security Tooling
      {
        title: "SIEM Integration",
        href: "/integrations/siem",
        icon: ShieldCheck,
        requiresPermission: "admin.integrations.siem",
      },
      {
        title: "Secrets Management",
        href: "/security/vault?tab=secrets",
        icon: Unlock,
        requiresPermission: "admin.integrations.secrets",
      },
      // Enterprise File Storage
      {
        title: "File Storage",
        href: "/integrations/file-storage",
        icon: FileStack,
        requiresPermission: "admin.integrations.files",
      },
      // Workflow Automation
      {
        title: "Webhook Registry",
        href: "/integrations/webhooks",
        icon: Webhook,
        requiresPermission: "admin.integrations.webhooks",
      },
      {
        title: "iPaaS Connections",
        href: "/integrations/ipaas",
        icon: CloudCog,
        requiresPermission: "admin.integrations.ipaas",
      },
      // Support
      {
        title: "Integration Support",
        href: "/integrations/support",
        icon: LifeBuoy,
        requiresPermission: "admin.integrations.support",
      },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & Governance",
    requiresPermission: "admin.compliance",
    items: [
      {
        title: "Policy Manager",
        href: "/compliance/policies",
        icon: FileText,
        requiresPermission: "admin.compliance.policy",
      },
      {
        title: "Data Retention",
        href: "/compliance/data-retention",
        icon: Trash2,
        requiresPermission: "admin.compliance.retention",
      },
      {
        title: "Compliance Reports",
        href: "/compliance/reports",
        icon: FileSpreadsheet,
        requiresPermission: "admin.compliance.reports",
      },
      {
        title: "Privacy Controls",
        href: "/compliance/privacy",
        icon: Lock,
        requiresPermission: "admin.compliance.privacy",
      },
      {
        title: "Risk Assessment",
        href: "/compliance/risk",
        icon: AlertTriangle,
        requiresPermission: "admin.compliance.risk",
      },
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare",
    requiresPermission: "healthcare:access",
    items: [
      {
        title: "PHI Management",
        href: "/healthcare/phi-management",
        icon: FileLock2,
        requiresPermission: "healthcare:phi:manage",
      },
      {
        title: "EHR Integrations",
        href: "/healthcare/ehr-integrations",
        icon: Stethoscope,
        requiresPermission: "healthcare:ehr:manage",
      },
      {
        title: "Clinical Plugins",
        href: "/healthcare/clinical-tools",
        icon: HeartPulse,
        requiresPermission: "healthcare:tools:manage",
      },
    ],
  },
  {
    id: "platform-config",
    title: "Platform Configuration",
    requiresPermission: "admin.system",
    items: [
      {
        title: "Branding",
        href: "/system/branding",
        icon: PaintBucket,
        requiresPermission: "admin.system.branding",
      },
      {
        title: "Modules",
        href: "/system/modules",
        icon: Puzzle,
        requiresPermission: "admin.system.modules",
      },
      {
        title: "Email Templates",
        href: "/system/email-templates",
        icon: Mail,
        requiresPermission: "admin.system.communication",
      },
      {
        title: "SMTP Settings",
        href: "/system/smtp",
        icon: Mail,
        requiresPermission: "admin.system.communication",
      },
      {
        title: "AI Providers",
        href: "/system/ai-providers",
        icon: Cpu,
        requiresPermission: "admin.system.ai",
      },
      {
        title: "Geo-Redundancy",
        href: "/system/geo-redundancy",
        icon: Globe,
        requiresPermission: "admin.system.infrastructure",
      },
    ],
  },
];