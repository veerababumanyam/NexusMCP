import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle, 
  AlertCircle, 
  Server, 
  Drill, 
  AlertTriangle
} from "lucide-react";

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: "success" | "warning" | "error" | "info" | "server" | "tool";
  type: "success" | "primary" | "warning" | "danger" | "info";
  footerText?: string;
  footerValue?: string;
  progress?: number;
}

export function StatusCard({
  title,
  value,
  icon,
  type,
  footerText,
  footerValue,
  progress,
}: StatusCardProps) {
  // Map icon type to the appropriate Lucide icon
  const IconComponent = () => {
    switch (icon) {
      case "success":
        return <CheckCircle className="text-success" />;
      case "warning":
        return <AlertTriangle className="text-warning" />;
      case "error":
        return <AlertCircle className="text-danger" />;
      case "server":
        return <Server className="text-primary" />;
      case "tool":
        return <Drill className="text-info" />;
      case "info":
      default:
        return <CheckCircle className="text-info" />;
    }
  };

  // Determine border color class based on type
  const borderColorClass = {
    success: "border-l-success",
    primary: "border-l-primary",
    warning: "border-l-warning",
    danger: "border-l-destructive",
    info: "border-l-info",
  }[type];

  // Determine background color for the icon container
  const bgColorClass = {
    success: "bg-success/10",
    primary: "bg-primary/10",
    warning: "bg-warning/10",
    danger: "bg-destructive/10",
    info: "bg-info/10",
  }[type];

  return (
    <Card className={`border-l-4 ${borderColorClass}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-xl font-semibold mt-1">{value}</p>
          </div>
          <div className={`rounded-full ${bgColorClass} p-2`}>
            <IconComponent />
          </div>
        </div>
        {(progress !== undefined || footerText) && (
          <div className="mt-4">
            {progress !== undefined && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    type === "success"
                      ? "bg-success"
                      : type === "warning"
                      ? "bg-warning"
                      : type === "danger"
                      ? "bg-destructive"
                      : type === "info"
                      ? "bg-info"
                      : "bg-primary"
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
            {footerText && (
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-muted-foreground">{footerText}</span>
                {footerValue && (
                  <span className={`${
                    type === "success"
                      ? "text-success"
                      : type === "warning"
                      ? "text-warning"
                      : type === "danger"
                      ? "text-destructive"
                      : type === "info"
                      ? "text-info"
                      : "text-foreground"
                  }`}>
                    {footerValue}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
