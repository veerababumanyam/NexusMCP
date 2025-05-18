import React from "react";
import { LucideIcon, AlertCircle, Database, Server, BarChart3, FileBox, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = "info",
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  // Determine which icon to render
  const IconToRender = () => {
    if (typeof icon === "string") {
      switch (icon) {
        case "database":
          return <Database className="h-12 w-12 text-muted-foreground opacity-50" />;
        case "server":
          return <Server className="h-12 w-12 text-muted-foreground opacity-50" />;
        case "chart":
          return <BarChart3 className="h-12 w-12 text-muted-foreground opacity-50" />;
        case "file":
          return <FileBox className="h-12 w-12 text-muted-foreground opacity-50" />;
        case "warning":
          return <AlertCircle className="h-12 w-12 text-muted-foreground opacity-50" />;
        case "info":
        default:
          return <Info className="h-12 w-12 text-muted-foreground opacity-50" />;
      }
    } else if (React.isValidElement(icon)) {
      return icon;
    } else {
      return <Info className="h-12 w-12 text-muted-foreground opacity-50" />;
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      <IconToRender />
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="mt-4">{actions}</div>}
    </div>
  );
}