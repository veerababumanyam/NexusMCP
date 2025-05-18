import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Plus, 
  User, 
  Users, 
  UserCheck,
  Mail,
  Calendar,
  Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

// Simple User type
interface User {
  id: number;
  username: string;
  email?: string;
  fullName?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  roles: Array<{ id: number; name: string }>;
}

// Simple API function to get users
async function getUsers() {
  try {
    console.log("Fetching users...");
    const res = await apiRequest("GET", "/api/users");
    const data = await res.json();
    console.log("Users data:", data);
    return data as User[];
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

export default function UsersPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState("");

  // Fetch users with react-query
  const {
    data: users,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/users"],
    queryFn: getUsers,
  });

  // Refresh user data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Refreshed",
        description: "User data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh user data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users?.filter(user => {
    if (!filter) return true;
    
    const searchTerm = filter.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchTerm) ||
      (user.email?.toLowerCase()?.includes(searchTerm) || false) ||
      (user.fullName?.toLowerCase()?.includes(searchTerm) || false)
    );
  });

  // Get CSS class for role badge
  const getRoleBadgeClass = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-red-500/10 text-red-500";
      case "manager":
        return "bg-blue-500/10 text-blue-500";
      case "user":
        return "bg-green-500/10 text-green-500";
      case "viewer":
        return "bg-violet-600/10 text-violet-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Get CSS class for status badge
  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive 
      ? "bg-green-500/10 text-green-500" 
      : "bg-muted text-muted-foreground";
  };

  return (
    <>
      <DashboardHeader
        title="User Management"
        subtitle="Manage user accounts, roles, and permissions"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Input
            placeholder="Search users..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        
        {hasPermission('users:create') && (
          <Button
            onClick={() => {
              toast({
                title: "Not implemented",
                description: "Add user functionality is coming soon!",
              });
            }}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isRefreshing ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-muted-foreground">
                          Loading users...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground">
                          No users found
                        </span>
                        <Button
                          variant="link"
                          onClick={() => {
                            toast({
                              title: "Not implemented",
                              description: "Add user functionality is coming soon!",
                            });
                          }}
                          className="mt-2"
                        >
                          Add your first user
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-9 w-9 bg-primary rounded-full flex items-center justify-center text-white">
                            {user.fullName ? (
                              user.fullName
                                .split(' ')
                                .map(n => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            ) : (
                              user.username.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="font-medium">{user.fullName || user.username}</div>
                            <div className="text-xs text-muted-foreground">@{user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                          {user.email || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge 
                                key={role.id} 
                                className={getRoleBadgeClass(role.name)}
                                variant="outline"
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                {role.name}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="bg-muted/40 text-muted-foreground">
                              No roles
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={getStatusBadgeClass(user.isActive)}
                        >
                          {user.isActive ? (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            "Inactive"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString() 
                          : "Never"
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}