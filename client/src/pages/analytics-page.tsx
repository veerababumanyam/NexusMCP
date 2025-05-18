import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  BarChart3, 
  LineChart, 
  PieChart,
  ArrowDown,
  ArrowUp,
  Clock,
  Server,
  Cpu,
  DownloadCloud,
  Activity,
  Users,
  AlertCircle,
  Calendar,
  ChevronDown,
  Share2,
  FileText,
  ArrowDownload
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// API functions
async function getAnalytics(period = "7d") {
  const res = await apiRequest("GET", `/api/analytics?period=${period}`);
  return await res.json();
}

async function getSystemHealth() {
  const res = await apiRequest("GET", "/api/system/health");
  return await res.json();
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState("7d");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch analytics data
  const {
    data: analytics,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/analytics", period],
    queryFn: () => getAnalytics(period),
  });

  // Fetch system health data
  const {
    data: systemHealth,
    isLoading: isLoadingHealth,
  } = useQuery({
    queryKey: ["/api/system/health"],
    queryFn: getSystemHealth,
  });

  // Refresh analytics data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Refreshed",
        description: "Analytics data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh analytics data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Theme colors for charts
  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num;
  };

  // Get trend indicator component
  const getTrendIndicator = (value: number, isGoodWhenPositive = true) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;
    const colorClass = isPositive 
      ? (isGoodWhenPositive ? "text-success" : "text-destructive")
      : (isGoodWhenPositive ? "text-destructive" : "text-success");
    
    return isNeutral ? null : (
      <div className={`flex items-center ${colorClass}`}>
        {isPositive ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        <span className="text-xs font-medium">{Math.abs(value)}%</span>
      </div>
    );
  };

  // Placeholder mock data (in a real application, this would come from the API)
  const mockData = {
    overview: {
      requestCount: {
        total: 153427,
        trend: 12.4,
        data: [
          { date: "Mon", requests: 12500 },
          { date: "Tue", requests: 17800 },
          { date: "Wed", requests: 22400 },
          { date: "Thu", requests: 18700 },
          { date: "Fri", requests: 24300 },
          { date: "Sat", requests: 29800 },
          { date: "Sun", requests: 27900 },
        ]
      },
      averageLatency: {
        value: 234,
        trend: -8.2,
        data: [
          { time: "00:00", latency: 180 },
          { time: "04:00", latency: 200 },
          { time: "08:00", latency: 320 },
          { time: "12:00", latency: 270 },
          { time: "16:00", latency: 310 },
          { time: "20:00", latency: 250 },
          { time: "23:59", latency: 190 },
        ]
      },
      errorRate: {
        value: 1.8,
        trend: -0.5,
        data: [
          { date: "Mon", rate: 2.3 },
          { date: "Tue", rate: 1.9 },
          { date: "Wed", rate: 2.1 },
          { date: "Thu", rate: 1.7 },
          { date: "Fri", rate: 1.6 },
          { date: "Sat", rate: 1.4 },
          { date: "Sun", rate: 1.8 },
        ]
      },
      activeUsers: {
        total: 1247,
        trend: 5.3,
        data: [
          { name: "Today", value: 1247 },
          { name: "Yesterday", value: 1183 },
          { name: "Last Week", value: 924 },
        ]
      },
      toolUsageDistribution: [
        { name: "Tool A", value: 35 },
        { name: "Tool B", value: 25 },
        { name: "Tool C", value: 20 },
        { name: "Tool D", value: 15 },
        { name: "Others", value: 5 },
      ],
      systemHealth: {
        cpu: 42,
        memory: 68,
        disk: 53,
        services: {
          total: 12,
          healthy: 11,
          degraded: 1,
          unhealthy: 0,
        }
      }
    },
    usage: {
      requestsByHour: [
        { hour: "00", requests: 320 },
        { hour: "01", requests: 280 },
        { hour: "02", requests: 210 },
        { hour: "03", requests: 190 },
        { hour: "04", requests: 180 },
        { hour: "05", requests: 270 },
        { hour: "06", requests: 450 },
        { hour: "07", requests: 750 },
        { hour: "08", requests: 1200 },
        { hour: "09", requests: 1800 },
        { hour: "10", requests: 2100 },
        { hour: "11", requests: 2300 },
        { hour: "12", requests: 2400 },
        { hour: "13", requests: 2350 },
        { hour: "14", requests: 2280 },
        { hour: "15", requests: 2150 },
        { hour: "16", requests: 1950 },
        { hour: "17", requests: 1750 },
        { hour: "18", requests: 1500 },
        { hour: "19", requests: 1250 },
        { hour: "20", requests: 980 },
        { hour: "21", requests: 780 },
        { hour: "22", requests: 590 },
        { hour: "23", requests: 420 },
      ],
      tokenUsage: {
        total: 12840523,
        input: 4290341,
        output: 8550182,
        trend: 7.2,
        data: [
          { date: "Mon", input: 350000, output: 720000 },
          { date: "Tue", input: 420000, output: 850000 },
          { date: "Wed", input: 580000, output: 1150000 },
          { date: "Thu", input: 680000, output: 1420000 },
          { date: "Fri", input: 790000, output: 1630000 },
          { date: "Sat", input: 820000, output: 1690000 },
          { date: "Sun", input: 650000, output: 1090000 },
        ]
      },
      topTools: [
        { name: "Document Search", requests: 42350, growth: 12 },
        { name: "Data Analysis", requests: 38720, growth: 8 },
        { name: "Code Generation", requests: 27890, growth: 15 },
        { name: "Content Summarization", requests: 25120, growth: -3 },
        { name: "Image Analysis", requests: 19340, growth: 5 },
      ],
      averageRequestDuration: {
        value: 1.8,
        data: [
          { name: "Document Search", value: 2.3 },
          { name: "Data Analysis", value: 3.1 },
          { name: "Code Generation", value: 2.7 },
          { name: "Content Summarization", value: 1.5 },
          { name: "Image Analysis", value: 0.9 },
        ]
      },
    },
    performance: {
      serverPerformance: [
        { name: "Server 1", cpu: 65, memory: 72, requests: 3240 },
        { name: "Server 2", cpu: 48, memory: 58, requests: 2180 },
        { name: "Server 3", cpu: 72, memory: 84, requests: 4130 },
        { name: "Server 4", cpu: 35, memory: 42, requests: 1780 },
      ],
      responseTimeDistribution: [
        { range: "0-200ms", count: 45 },
        { range: "201-500ms", count: 30 },
        { range: "501-1000ms", count: 15 },
        { range: "1001-2000ms", count: 7 },
        { range: ">2000ms", count: 3 },
      ],
      errorTypes: [
        { name: "Rate Limited", value: 42 },
        { name: "Input Validation", value: 28 },
        { name: "Auth Failure", value: 12 },
        { name: "Server Error", value: 10 },
        { name: "Timeout", value: 8 },
      ],
      performanceTrend: [
        { date: "Week 1", p50: 180, p90: 450, p99: 980 },
        { date: "Week 2", p50: 195, p90: 520, p99: 1050 },
        { date: "Week 3", p50: 210, p90: 580, p99: 1120 },
        { date: "Week 4", p50: 205, p90: 560, p99: 1080 },
        { date: "Week 5", p50: 185, p90: 490, p99: 990 },
        { date: "Week 6", p50: 175, p90: 470, p99: 950 },
      ],
    }
  };

  // Use mock data for now (in a real app, replace with analytics)
  const data = mockData;

  return (
    <>
      <DashboardHeader
        title="Analytics"
        subtitle="Monitor usage patterns, performance metrics, and system health"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <div className="flex justify-between items-center mb-6">
        <Tabs 
          defaultValue="overview" 
          className="w-full"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                <span>Usage</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-1">
                <Cpu className="h-4 w-4" />
                <span>Performance</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <Select
                value={period}
                onValueChange={setPeriod}
              >
                <SelectTrigger className="w-[140px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" className="gap-1">
                <FileText className="h-4 w-4" />
                <span>Export</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Request Count Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(data.overview.requestCount.total)}
                      </div>
                      {getTrendIndicator(data.overview.requestCount.trend)}
                    </div>
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Share2 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Average Latency Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg. Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-2xl font-bold">
                        {data.overview.averageLatency.value} ms
                      </div>
                      {getTrendIndicator(data.overview.averageLatency.trend, false)}
                    </div>
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Error Rate Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Error Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-2xl font-bold">
                        {data.overview.errorRate.value}%
                      </div>
                      {getTrendIndicator(data.overview.errorRate.trend, false)}
                    </div>
                    <div className="p-2 bg-primary/10 rounded-full">
                      <AlertCircle className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Active Users Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-2xl font-bold">
                        {formatNumber(data.overview.activeUsers.total)}
                      </div>
                      {getTrendIndicator(data.overview.activeUsers.trend)}
                    </div>
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Request Trend Chart */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Request Trends</CardTitle>
                  <CardDescription>
                    Total requests over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.overview.requestCount.data}
                      margin={{
                        top: 10,
                        right: 30,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="var(--chart-1)"
                        fill="var(--chart-1)"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              {/* Tool Usage Distribution */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Tool Usage Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of tool usage by percentage
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={data.overview.toolUsageDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.overview.toolUsageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
            {/* System Health Card */}
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>
                  Current system performance and health metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-1 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">CPU Usage</span>
                        <span className="text-sm">{data.overview.systemHealth.cpu}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${data.overview.systemHealth.cpu}%` }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Memory Usage</span>
                        <span className="text-sm">{data.overview.systemHealth.memory}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-secondary rounded-full"
                          style={{ width: `${data.overview.systemHealth.memory}%` }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Disk Usage</span>
                        <span className="text-sm">{data.overview.systemHealth.disk}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${data.overview.systemHealth.disk}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-1 space-y-4 flex flex-col justify-between">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">Services</div>
                        <div className="text-xs text-muted-foreground">Status</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">{data.overview.systemHealth.services.total}</div>
                        <div className="text-xs px-2 py-1 bg-success/10 text-success rounded-full">
                          {data.overview.systemHealth.services.healthy} healthy
                        </div>
                      </div>
                      {data.overview.systemHealth.services.degraded > 0 && (
                        <div className="mt-1 text-xs px-2 py-1 bg-warning/10 text-warning rounded-full inline-block">
                          {data.overview.systemHealth.services.degraded} degraded
                        </div>
                      )}
                      {data.overview.systemHealth.services.unhealthy > 0 && (
                        <div className="mt-1 text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-full inline-block">
                          {data.overview.systemHealth.services.unhealthy} unhealthy
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-1 space-y-2">
                    <div className="p-3 border rounded-lg flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">Server Uptime</div>
                        <div className="text-2xl font-bold">99.98%</div>
                      </div>
                      <div className="p-2 bg-success/10 rounded-full">
                        <Server className="h-5 w-5 text-success" />
                      </div>
                    </div>
                    
                    <div className="p-3 border rounded-lg flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">Average Load</div>
                        <div className="text-2xl font-bold">0.57</div>
                      </div>
                      <div className="p-2 bg-blue-500/10 rounded-full">
                        <Activity className="h-5 w-5 text-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="usage" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Token Usage Chart */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Token Usage</CardTitle>
                  <CardDescription>
                    Input and output tokens over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.usage.tokenUsage.data}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="input" stackId="a" fill="var(--chart-1)" name="Input Tokens" />
                      <Bar dataKey="output" stackId="a" fill="var(--chart-2)" name="Output Tokens" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
                <CardFooter className="border-t">
                  <div className="grid grid-cols-3 w-full gap-4 text-center">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
                      <p className="text-lg font-bold">{formatNumber(data.usage.tokenUsage.total)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Input</p>
                      <p className="text-lg font-bold">{formatNumber(data.usage.tokenUsage.input)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Output</p>
                      <p className="text-lg font-bold">{formatNumber(data.usage.tokenUsage.output)}</p>
                    </div>
                  </div>
                </CardFooter>
              </Card>
              
              {/* Requests by Hour */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Requests by Hour</CardTitle>
                  <CardDescription>
                    24-hour distribution of requests
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.usage.requestsByHour}
                      margin={{
                        top: 10,
                        right: 30,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="var(--chart-3)"
                        fill="var(--chart-3)"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Top Tools Table */}
              <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                  <CardTitle>Top Tools</CardTitle>
                  <CardDescription>
                    Most frequently used tools and their growth
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.usage.topTools.map((tool, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white mr-3">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{tool.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatNumber(tool.requests)} requests
                            </div>
                          </div>
                        </div>
                        <div className={`text-sm ${tool.growth >= 0 ? 'text-success' : 'text-destructive'} flex items-center`}>
                          {tool.growth >= 0 ? 
                            <ArrowUp className="h-3 w-3 mr-1" /> : 
                            <ArrowDown className="h-3 w-3 mr-1" />
                          }
                          {Math.abs(tool.growth)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Average Request Duration */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Avg. Request Duration</CardTitle>
                  <CardDescription>
                    By tool type (seconds)
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.usage.averageRequestDuration.data}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="performance" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Server Performance */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Server Performance</CardTitle>
                  <CardDescription>
                    Resource utilization across servers
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.performance.serverPerformance}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="cpu" name="CPU %" fill="var(--chart-1)" />
                      <Bar dataKey="memory" name="Memory %" fill="var(--chart-2)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              {/* Performance Trends */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                  <CardDescription>
                    Response time percentiles over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={data.performance.performanceTrend}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="p50" 
                        name="p50 (ms)" 
                        stroke="var(--chart-1)" 
                        activeDot={{ r: 8 }}
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="p90" 
                        name="p90 (ms)" 
                        stroke="var(--chart-3)" 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="p99" 
                        name="p99 (ms)" 
                        stroke="var(--chart-4)" 
                        strokeWidth={2}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Error Types */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Error Types</CardTitle>
                  <CardDescription>
                    Distribution of error categories
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={data.performance.errorTypes}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        fill="#8884d8"
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.performance.errorTypes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              {/* Response Time Distribution */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Response Time Distribution</CardTitle>
                  <CardDescription>
                    Percentage of requests by response time
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.performance.responseTimeDistribution}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="Percentage %" fill="var(--chart-2)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}