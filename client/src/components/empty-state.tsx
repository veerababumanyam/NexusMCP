import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-64">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        {icon || <FolderOpen className="h-10 w-10 text-muted-foreground" />}
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};