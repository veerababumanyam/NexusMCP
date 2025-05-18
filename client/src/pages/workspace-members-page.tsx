import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Users, PlusCircle, Search, MoreHorizontal, UserPlus, Shield, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
// Commented out RadioGroup due to hook errors
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// Form schema for inviting members
const inviteFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.string().min(1, "Please select a role"),
  message: z.string().optional(),
  sendInvite: z.boolean().default(true),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface WorkspaceMember {
  id: number;
  userId: number;
  workspaceId: number;
  status: string;
  invitedBy?: number;
  invitedAt: string;
  acceptedAt?: string;
  expiresAt?: string;
  lastAccessed?: string;
  isDefault: boolean;
  user: {
    id: number;
    username: string;
    displayName?: string;
    email: string;
    avatarUrl?: string;
  };
  inviter?: {
    id: number;
    username: string;
    displayName?: string;
  };
}

interface Workspace {
  id: number;
  name: string;
  description?: string;
  status: string;
}

interface Role {
  id: number;
  name: string;
  description?: string;
}

export default function WorkspaceMembersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("members");
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);

  // Form for inviting members
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: "",
      message: "",
      sendInvite: true,
    },
  });

  // Get workspaces
  const { data: workspaces, isLoading: isLoadingWorkspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
    enabled: !!user,
  });

  // Get roles for workspace
  const { data: roles, isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    enabled: !!user,
  });

  // Get workspace members
  const { data: members, isLoading: isLoadingMembers } = useQuery<WorkspaceMember[]>({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "members"],
    enabled: !!selectedWorkspaceId,
  });

  // Mutation to invite member
  const inviteMemberMutation = useMutation({
    mutationFn: async (data: InviteFormValues) => {
      const response = await apiRequest("POST", `/api/workspaces/${selectedWorkspaceId}/members/invite`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspaceId, "members"] });
      toast({
        title: "Invitation sent",
        description: "The user has been invited to the workspace.",
      });
      setIsInviteDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      await apiRequest("DELETE", `/api/workspaces/${selectedWorkspaceId}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspaceId, "members"] });
      toast({
        title: "Member removed",
        description: "The member has been removed from the workspace.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to change member role
  const changeMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, roleId }: { memberId: number; roleId: string }) => {
      const response = await apiRequest(
        "PATCH", 
        `/api/workspaces/${selectedWorkspaceId}/members/${memberId}`,
        { roleId }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspaceId, "members"] });
      toast({
        title: "Role updated",
        description: "The member's role has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set initial workspace ID from URL or first available workspace
  useEffect(() => {
    if (workspaces?.length && !selectedWorkspaceId) {
      // Check if URL has workspace ID
      const urlParams = new URLSearchParams(window.location.search);
      const workspaceIdFromURL = urlParams.get("id");
      
      if (workspaceIdFromURL && workspaces.some(w => w.id === parseInt(workspaceIdFromURL))) {
        setSelectedWorkspaceId(parseInt(workspaceIdFromURL));
      } else {
        setSelectedWorkspaceId(workspaces[0].id);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

  // Update URL when selected workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set("id", selectedWorkspaceId.toString());
      setLocation(`/workspaces/members?${searchParams.toString()}`, { replace: true });
    }
  }, [selectedWorkspaceId, setLocation]);

  // Handle invite form submission
  const onSubmit = (data: InviteFormValues) => {
    inviteMemberMutation.mutate(data);
  };

  // Handle member removal
  const handleRemoveMember = (memberId: number) => {
    if (window.confirm("Are you sure you want to remove this member from the workspace?")) {
      removeMemberMutation.mutate(memberId);
    }
  };

  // Handle role change
  const handleRoleChange = (memberId: number, roleId: string) => {
    changeMemberRoleMutation.mutate({ memberId, roleId });
  };

  // Filter and search members
  const filteredMembers = members?.filter(member => {
    // Apply status filter
    if (filter !== "all" && member.status !== filter) return false;
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        member.user?.displayName?.toLowerCase().includes(searchLower) ||
        member.user?.username?.toLowerCase().includes(searchLower) ||
        member.user?.email?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workspace Members</h1>
          <p className="text-muted-foreground">
            Manage members and permissions for your workspaces
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={selectedWorkspaceId?.toString()}
            onValueChange={(value) => setSelectedWorkspaceId(parseInt(value))}
            disabled={isLoadingWorkspaces || !workspaces?.length}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces?.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id.toString()}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="ml-2">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Member</DialogTitle>
                <DialogDescription>
                  Invite a user to join this workspace. They will receive an email with instructions to access the workspace.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="user@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          The email address of the user you want to invite
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles?.map((role) => (
                              <SelectItem key={role.id} value={role.id.toString()}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The role determines what permissions this user will have
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Add a personal message to the invitation email"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Add a custom message to the invitation email
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="sendInvite"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Send Email Invitation</FormLabel>
                          <FormDescription>
                            Send an email with a link to join the workspace
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsInviteDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteMemberMutation.isPending}>
                      {inviteMemberMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select
          value={filter}
          onValueChange={setFilter}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invitations">Pending Invitations</TabsTrigger>
          <TabsTrigger value="settings">Access Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Workspace Members</CardTitle>
              <CardDescription>
                Manage users who have access to this workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMembers || isLoadingWorkspaces ? (
                <div className="flex justify-center my-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedWorkspaceId ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Select a workspace to view its members</p>
                </div>
              ) : filteredMembers?.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                  <h3 className="mt-4 text-lg font-semibold">No members found</h3>
                  <p className="text-muted-foreground">
                    {search ? "Try adjusting your search or filter criteria" : "This workspace doesn't have any members yet"}
                  </p>
                  {!search && (
                    <Button
                      className="mt-4"
                      onClick={() => setIsInviteDialogOpen(true)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Invite Members
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers?.filter(member => member.status !== "invited").map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.user?.avatarUrl || ""} alt={member.user?.displayName || member.user?.username || "User"} />
                              <AvatarFallback>
                                {member.user?.displayName || member.user?.username 
                                  ? (member.user.displayName || member.user.username).substring(0, 2)
                                  : "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium">{member.user?.displayName || member.user?.username || "Unknown User"}</span>
                              <span className="text-xs text-muted-foreground">{member.user?.email || "No email"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.user?.id === user?.id ? (
                            <Badge variant="secondary">You</Badge>
                          ) : (
                            <Select
                              defaultValue={"member"}
                              onValueChange={(roleId) => handleRoleChange(member.id, roleId)}
                              disabled={changeMemberRoleMutation.isPending}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles?.map((role) => (
                                  <SelectItem key={role.id} value={role.id.toString()}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={member.status === "active" ? "secondary" : member.status === "suspended" ? "destructive" : "outline"}
                            className={member.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900" : ""}
                          >
                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.lastAccessed ? format(new Date(member.lastAccessed), "MMM d, yyyy") : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          {member.user?.id !== user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleRemoveMember(member.id)}>
                                  <X className="mr-2 h-4 w-4" />
                                  Remove from workspace
                                </DropdownMenuItem>
                                {member.status === "active" ? (
                                  <DropdownMenuItem onClick={() => changeMemberRoleMutation.mutate({ 
                                    memberId: member.id, 
                                    roleId: "suspended" 
                                  })}>
                                    <X className="mr-2 h-4 w-4" />
                                    Suspend member
                                  </DropdownMenuItem>
                                ) : member.status === "suspended" ? (
                                  <DropdownMenuItem onClick={() => changeMemberRoleMutation.mutate({ 
                                    memberId: member.id, 
                                    roleId: "active" 
                                  })}>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Restore access
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 px-6 py-3">
              <div className="text-xs text-muted-foreground">
                {filteredMembers?.length ?? 0} members in workspace
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                View and manage invitations that haven't been accepted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMembers || isLoadingWorkspaces ? (
                <div className="flex justify-center my-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedWorkspaceId ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Select a workspace to view its pending invitations</p>
                </div>
              ) : filteredMembers?.filter(m => m.status === "invited").length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                  <h3 className="mt-4 text-lg font-semibold">No pending invitations</h3>
                  <p className="text-muted-foreground">
                    All invitations have been accepted or there are no invitations sent yet
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => setIsInviteDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Invite Members
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Date Sent</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers?.filter(member => member.status === "invited").map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <span>{invitation.user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {invitation.inviter ? (
                            invitation.inviter.displayName || invitation.inviter.username
                          ) : (
                            "System"
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invitation.invitedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {invitation.expiresAt ? format(new Date(invitation.expiresAt), "MMM d, yyyy") : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMember(invitation.id)}
                          >
                            Cancel Invitation
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Access Settings</CardTitle>
              <CardDescription>
                Configure access controls and permissions for this workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Workspace Access</h3>
                
                <div className="grid gap-4">
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">
                        Allow users to request access
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Users can request to join this workspace
                      </p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">
                        Auto-approve workspace access
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Automatically approve access requests from certain domains
                      </p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                  
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">
                        Require approval for all external sharing
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Workspace admins must approve all content sharing outside the workspace
                      </p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-medium">Default Access Level</h3>
                <p className="text-sm text-muted-foreground">
                  Set the default access level for new members joining this workspace
                </p>
                
                <div className="space-y-4">
                <div className="flex items-center space-x-2 rounded-lg border p-4">
                  <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <label className="text-sm font-medium cursor-pointer flex-1">
                    Admin
                    <p className="font-normal text-muted-foreground">
                      Full control over workspace settings and members
                    </p>
                  </label>
                </div>
                
                <div className="flex items-center space-x-2 rounded-lg border p-4">
                  <div className="h-4 w-4 rounded-full border-2 border-primary" />
                  <label className="text-sm font-medium cursor-pointer flex-1">
                    Member
                    <p className="font-normal text-muted-foreground">
                      Can view and contribute to workspace content
                    </p>
                  </label>
                </div>
                
                <div className="flex items-center space-x-2 rounded-lg border p-4">
                  <div className="h-4 w-4 rounded-full border-2 border-primary" />
                  <label className="text-sm font-medium cursor-pointer flex-1">
                    Viewer
                    <p className="font-normal text-muted-foreground">
                      Can only view workspace content
                    </p>
                  </label>
                </div>
              </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="button">
                Save Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}