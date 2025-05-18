import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AgentStatsProps {
  data: {
    chartData: number[];
    activeAgents: {
      value: number;
      percent: number;
    };
    responseTime: {
      value: string;
      percent: number;
    };
    errorRate: {
      value: string;
      percent: number;
    };
  };
  onViewDetails?: () => void;
}

export function AgentStats({ data, onViewDetails }: AgentStatsProps) {
  return (
    <Card>
      <CardHeader className="bg-muted/50 py-4">
        <CardTitle className="text-base font-medium">Agent Communication</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-foreground mb-2">
            A2A Communications (Last 24h)
          </h3>
          <div className="h-36 bg-muted/50 rounded-lg flex items-end p-2">
            {data.chartData.map((value, index) => (
              <div
                key={index}
                className="w-1/12 bg-primary rounded-t-md mx-1"
                style={{ height: `${value}px` }}
              ></div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-foreground">Active Agents</span>
              <span className="text-sm font-medium">{data.activeAgents.value}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-success h-2 rounded-full"
                style={{ width: `${data.activeAgents.percent}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-foreground">Response Time</span>
              <span className="text-sm font-medium">{data.responseTime.value}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-info h-2 rounded-full"
                style={{ width: `${data.responseTime.percent}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-foreground">Error Rate</span>
              <span className="text-sm font-medium">{data.errorRate.value}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-destructive h-2 rounded-full"
                style={{ width: `${data.errorRate.percent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </CardContent>
      {onViewDetails && (
        <CardFooter className="bg-muted/50 py-3 px-6 justify-end">
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            View Details
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
