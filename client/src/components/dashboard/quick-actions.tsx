import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  PackagePlus, 
  UserPlus, 
  Drill, 
  FileBox 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface QuickAction {
  id: string;
  title: string;
  icon: JSX.Element;
  onClick?: () => void;
  href?: string;
}

export function QuickActions() {
  const { toast } = useToast();

  const handleActionClick = (action: string) => {
    toast({
      title: `${action} Action`,
      description: `${action} action was triggered`,
    });
  };

  const quickActions: QuickAction[] = [
    {
      id: "add-server",
      title: "Add MCP Server",
      icon: <PackagePlus className="h-5 w-5" />,
      href: "/servers/new"
    },
    {
      id: "add-user",
      title: "Add User",
      icon: <UserPlus className="h-5 w-5" />,
      onClick: () => handleActionClick("Add User")
    },
    {
      id: "manage-tools",
      title: "Manage Tools",
      icon: <Drill className="h-5 w-5" />,
      href: "/tools"
    },
    {
      id: "run-report",
      title: "Run Report",
      icon: <FileBox className="h-5 w-5" />,
      onClick: () => handleActionClick("Run Report")
    }
  ];

  return (
    <Card>
      <CardHeader className="bg-muted/50 py-4">
        <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            action.href ? (
              <Link key={action.id} href={action.href}>
                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center p-4 h-auto border-border hover:bg-muted/50 transition-colors w-full"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium">{action.title}</span>
                </Button>
              </Link>
            ) : (
              <Button
                key={action.id}
                variant="outline"
                className="flex flex-col items-center justify-center p-4 h-auto border-border hover:bg-muted/50 transition-colors"
                onClick={action.onClick}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  {action.icon}
                </div>
                <span className="text-sm font-medium">{action.title}</span>
              </Button>
            )
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
