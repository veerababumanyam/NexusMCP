import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  alert?: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader = ({
  title,
  description,
  icon: Icon,
  alert,
  actions,
  children
}: PageHeaderProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div>
            {actions}
          </div>
        )}
        {children && (
          <div>
            {children}
          </div>
        )}
      </div>
      
      {alert && (
        <Alert variant={alert.variant || "default"}>
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.description}</AlertDescription>
        </Alert>
      )}
      
      <Separator />
    </div>
  );
};

export { PageHeader };
export default PageHeader;