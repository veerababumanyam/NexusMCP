import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatusCard } from "@/components/dashboard/status-card";
import { ServerTable } from "@/components/dashboard/server-table";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AgentStats } from "@/components/dashboard/agent-stats";
import { WorkspaceStatus } from "@/components/dashboard/workspace-status";
import { getSystemStatus, getServerStatuses, getWorkspaces } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

// For TypeScript types
interface ActivityItem {
  id: number;
  type: "alert" | "user" | "server" | "tool" | "policy";
  title: string;
  description: string;
  time: string;
};

export default function DashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();

  // Fetch system status
  const {
    data: systemStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["/api/system/status"],
    queryFn: getSystemStatus,
  });

  // Fetch server statuses
  const {
    data: serverStatuses,
    isLoading: isLoadingServers,
    refetch: refetchServers,
  } = useQuery({
    queryKey: ["/api/mcp-servers/status"],
    queryFn: getServerStatuses,
  });

  // Fetch workspaces
  const {
    data: workspaces,
    isLoading: isLoadingWorkspaces,
    refetch: refetchWorkspaces,
  } = useQuery({
    queryKey: ["/api/workspaces"],
    queryFn: getWorkspaces,
  });

  // Refresh all data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchStatus(),
        refetchServers(),
        refetchWorkspaces(),
      ]);
    } catch (error) {
      console.error("Error refreshing dashboard data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Mock data for components that don't have API endpoints yet
  const activityItems = [
    {
      id: 1,
      type: "alert" as const,
      title: "MCP Server Alert: Test-MCP-01",
      description:
        "Server encountered connectivity issues with tool 'code-review'. Error code: MCP-503.",
      time: "10 minutes ago",
    },
    {
      id: 2,
      type: "user" as const,
      title: "User Management",
      description:
        "Admin user sarah.johnson added to 'SecOps' group with admin privileges.",
      time: "45 minutes ago",
    },
    {
      id: 3,
      type: "server" as const,
      title: "Server Onboarding",
      description:
        "New MCP server Prod-MCP-03 successfully onboarded and deployed to Production workspace.",
      time: "1 hour ago",
    },
    {
      id: 4,
      type: "tool" as const,
      title: "Tool Registration",
      description:
        "New tool data-analyzer registered in Development workspace. Awaiting approval.",
      time: "3 hours ago",
    },
    {
      id: 5,
      type: "policy" as const,
      title: "Policy Update",
      description:
        "Security policy data-access-control updated with new compliance requirements.",
      time: "5 hours ago",
    },
  ];

  const agentData = {
    chartData: [30, 45, 25, 20, 35, 55, 40, 30, 25, 45, 50, 35],
    activeAgents: {
      value: 24,
      percent: 80,
    },
    responseTime: {
      value: "168ms avg",
      percent: 65,
    },
    errorRate: {
      value: "2.1%",
      percent: 10,
    },
  };

  const formattedWorkspaces = workspaces?.map((workspace: any) => ({
    id: workspace.id,
    name: workspace.name,
    status: workspace.status as "active" | "inactive" | "issues",
    icon:
      workspace.name.toLowerCase() === "enterprise"
        ? "enterprise"
        : workspace.name.toLowerCase() === "development"
        ? "development"
        : workspace.name.toLowerCase() === "testing"
        ? "testing"
        : "staging",
    utilization: Math.floor(Math.random() * 100), // This would come from real metrics in production
  })) || [];

  const isLoading = isLoadingStatus || isLoadingServers || isLoadingWorkspaces || isRefreshing;

  return (
    <>
      <DashboardHeader
        title="Dashboard"
        subtitle="NexusMCP System Overview"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatusCard
          title="System Status"
          value={systemStatus?.systemStatus || "Unknown"}
          icon="success"
          type="success"
          footerText="Last checked"
          footerValue={systemStatus?.lastUpdated ? "Just now" : "N/A"}
        />
        <StatusCard
          title="Active Servers"
          value={`${systemStatus?.activeServerCount || 0} / ${
            systemStatus?.serverCount || 0
          }`}
          icon="server"
          type="primary"
          progress={
            systemStatus?.serverCount
              ? (systemStatus.activeServerCount / systemStatus.serverCount) * 100
              : 0
          }
          footerText="Available"
          footerValue={
            systemStatus?.serverCount
              ? `${Math.round(
                  (systemStatus.activeServerCount / systemStatus.serverCount) *
                    100
                )}%`
              : "0%"
          }
        />
        <StatusCard
          title="Active Tools"
          value={systemStatus?.toolCount || 0}
          icon="tool"
          type="info"
          footerText="Usage Today"
          footerValue="4,821 requests"
        />
        <StatusCard
          title="Alerts"
          value={3}
          icon="warning"
          type="warning"
          footerText="Critical issues"
          footerValue="1"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - MCP Server Status & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <ServerTable
            servers={serverStatuses || []}
            onRefresh={refreshData}
            isLoading={isLoading}
          />
          <ActivityFeed activities={activityItems} />
        </div>

        {/* Right Column - Quick Actions, Agent Stats, Workspace Status */}
        <div className="space-y-6">
          <QuickActions />
          <AgentStats data={agentData} />
          <WorkspaceStatus workspaces={formattedWorkspaces} />
        </div>
      </div>
    </>
  );
}
