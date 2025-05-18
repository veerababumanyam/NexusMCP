import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building,
  Code,
  TestTube
} from "lucide-react";

interface WorkspaceStatusProps {
  workspaces: Array<{
    id: number;
    name: string;
    status: "active" | "inactive" | "issues";
    icon: "enterprise" | "development" | "testing" | "staging";
    utilization: number;
  }>;
}

export function WorkspaceStatus({ workspaces }: WorkspaceStatusProps) {
  const getWorkspaceIcon = (icon: string) => {
    switch (icon) {
      case "enterprise":
        return (
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-white">
            <Building className="h-4 w-4" />
          </div>
        );
      case "development":
        return (
          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-white">
            <Code className="h-4 w-4" />
          </div>
        );
      case "testing":
      case "staging":
        return (
          <div className="h-8 w-8 rounded-md bg-info flex items-center justify-center text-white">
            <TestTube className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
            <Building className="h-4 w-4" />
          </div>
        );
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success";
      case "issues":
        return "bg-warning/10 text-warning";
      case "inactive":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 50) return "bg-success";
    if (utilization < 80) return "bg-secondary";
    return "bg-warning";
  };

  return (
    <Card>
      <CardHeader className="bg-muted/50 py-4">
        <CardTitle className="text-base font-medium">Workspace Status</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {workspaces.length === 0 ? (
            <li className="p-6 text-center text-muted-foreground">
              No workspaces available
            </li>
          ) : (
            workspaces.map((workspace) => (
              <li key={workspace.id} className="p-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    {getWorkspaceIcon(workspace.icon)}
                    <span className="ml-3 text-sm font-medium">{workspace.name}</span>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(workspace.status)}`}>
                    {workspace.status.charAt(0).toUpperCase() + workspace.status.slice(1)}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Resource Utilization</span>
                    <span>{workspace.utilization}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getUtilizationColor(workspace.utilization)}`}
                      style={{ width: `${workspace.utilization}%` }}
                    ></div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
