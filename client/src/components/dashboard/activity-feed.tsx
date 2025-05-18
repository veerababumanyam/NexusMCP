import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { 
  AlertTriangle, 
  User, 
  Server, 
  Drill, 
  Shield 
} from "lucide-react";

interface ActivityItem {
  id: number;
  type: "alert" | "user" | "server" | "tool" | "policy";
  title: string;
  description: string;
  time: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  onViewAll?: () => void;
}

export function ActivityFeed({ activities, onViewAll }: ActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "alert":
        return (
          <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
        );
      case "user":
        return (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User className="h-4 w-4" />
          </div>
        );
      case "server":
        return (
          <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center text-success">
            <Server className="h-4 w-4" />
          </div>
        );
      case "tool":
        return (
          <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center text-info">
            <Drill className="h-4 w-4" />
          </div>
        );
      case "policy":
        return (
          <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center text-warning">
            <Shield className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <ExternalLink className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="bg-muted/50 py-4">
        <CardTitle className="text-base font-medium">Recent System Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {activities.length === 0 ? (
            <li className="p-6 text-center text-muted-foreground">
              No recent activity to display
            </li>
          ) : (
            activities.map((activity) => (
              <li key={activity.id} className="p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </CardContent>
      {activities.length > 0 && onViewAll && (
        <CardFooter className="bg-muted/50 py-3 px-6 justify-end">
          <Button variant="outline" size="sm" onClick={onViewAll}>
            View All Activity
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
