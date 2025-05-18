import { useState } from 'react';
import { AnnotationReply, updateReply, deleteReply } from '@/api/collaboration';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistance } from 'date-fns';
import { Pencil, Trash2, X } from 'lucide-react';

interface ReplyItemProps {
  reply: AnnotationReply;
  annotationId: number;
}

export function ReplyItem({ reply, annotationId }: ReplyItemProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const queryClient = useQueryClient();
  
  // Update reply mutation
  const updateReplyMutation = useMutation({
    mutationFn: (content: string) => updateReply(reply.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/collaboration/annotations'],
      });
      setIsEditing(false);
      toast({
        title: 'Reply updated',
        description: 'Your reply has been successfully updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update reply: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Delete reply mutation
  const deleteReplyMutation = useMutation({
    mutationFn: () => deleteReply(reply.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/collaboration/annotations'],
      });
      toast({
        title: 'Reply deleted',
        description: 'Your reply has been successfully deleted',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete reply: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Handle reply update
  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    updateReplyMutation.mutate(editContent);
  };
  
  // Handle reply delete
  const handleDelete = () => {
    deleteReplyMutation.mutate();
  };
  
  // Check if the current user is the creator of the reply
  const isOwner = user?.id === reply.userId;
  
  // Format date for display
  const formattedDate = formatDistance(
    new Date(reply.updatedAt || reply.createdAt), 
    new Date(), 
    { addSuffix: true }
  );
  
  // Determine avatar initials
  const initials = reply.user?.fullName
    ? reply.user.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
    : reply.user?.username?.substring(0, 2).toUpperCase() || 'U';
  
  return (
    <div className="bg-muted/50 p-2 rounded-md">
      {/* Header with user info */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={reply.user?.avatarUrl} />
            <AvatarFallback className="text-[0.5rem]">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-xs font-medium">
            {reply.user?.fullName || reply.user?.username || 'Unknown user'}
          </div>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
        
        {isOwner && !isEditing && (
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 rounded-sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil size={10} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 size={10} />
            </Button>
          </div>
        )}
        
        {isEditing && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 rounded-sm"
            onClick={() => setIsEditing(false)}
          >
            <X size={10} />
          </Button>
        )}
      </div>
      
      {/* Content */}
      {isEditing ? (
        <>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="mb-1 resize-none text-xs min-h-[2rem] py-1"
            rows={2}
          />
          <div className="flex justify-end">
            <Button 
              size="sm" 
              className="h-6 text-xs px-2"
              onClick={handleSaveEdit}
              disabled={updateReplyMutation.isPending}
            >
              {updateReplyMutation.isPending ? (
                <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="text-xs">{reply.content}</div>
      )}
    </div>
  );
}