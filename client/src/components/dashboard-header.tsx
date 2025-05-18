import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  heading?: string;
  text?: string;
  icon?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children?: React.ReactNode;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  heading,
  text,
  icon,
  onRefresh,
  isRefreshing = false,
  children,
}) => {
  // Use heading/text if provided, otherwise fall back to title/subtitle
  const displayTitle = heading || title;
  const displaySubtitle = text || subtitle;

  return (
    <div className="flex flex-col space-y-2 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          {icon && (
            <div className="mr-3 mt-1 text-primary">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{displayTitle}</h1>
            {displaySubtitle && (
              <p className="text-muted-foreground">{displaySubtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;