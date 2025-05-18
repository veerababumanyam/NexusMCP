import { useState, useRef, RefObject, useEffect } from 'react';
import { Annotation, updateAnnotation } from '@/api/collaboration';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistance } from 'date-fns';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, MessageCircle, MoreVertical, Pencil, Trash2, X, Send } from 'lucide-react';
import { ReplyItem } from './reply-item';
import { addReply } from '@/api/collaboration';

interface AnnotationItemProps {
  annotation: Annotation;
  contentRef: RefObject<HTMLElement>;
  onDelete: (id: number) => void;
}

export function AnnotationItem({ annotation, contentRef, onDelete }: AnnotationItemProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(annotation.content);
  const [isPrivate, setIsPrivate] = useState(annotation.isPrivate);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newReply, setNewReply] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const replies = annotation.replies || [];
  const replyCount = replies.length;
  
  useEffect(() => {
    positionAnnotation();
    window.addEventListener('resize', positionAnnotation);
    
    return () => {
      window.removeEventListener('resize', positionAnnotation);
    };
  }, [annotation.position, contentRef.current]);
  
  // Function to position the annotation marker based on the annotation position
  const positionAnnotation = () => {
    if (!markerRef.current || !contentRef.current) return;
    
    const containerRect = contentRef.current.getBoundingClientRect();
    
    // Position the marker at the original annotation position
    markerRef.current.style.top = `${annotation.position.top}px`;
    markerRef.current.style.left = `${annotation.position.left}px`;
    markerRef.current.style.width = `${annotation.position.width}px`;
    markerRef.current.style.height = `${annotation.position.height}px`;
    
    // Add a highlight effect by using a pseudo-element or background
    markerRef.current.style.backgroundColor = "rgba(255, 220, 0, 0.2)";
    markerRef.current.style.border = "1px solid rgba(255, 220, 0, 0.5)";
    
    // For better visibility in dark mode
    if (document.documentElement.classList.contains('dark')) {
      markerRef.current.style.backgroundColor = "rgba(255, 220, 0, 0.3)";
      markerRef.current.style.border = "1px solid rgba(255, 220, 0, 0.6)";
    }
  };
  
  // Update annotation mutation
  const updateAnnotationMutation = useMutation({
    mutationFn: (data: { id: number; content?: string; isPrivate?: boolean }) =>
      updateAnnotation(data.id, { content: data.content, isPrivate: data.isPrivate }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/collaboration/annotations', annotation.targetType, annotation.targetId, annotation.workspaceId],
      });
      setIsEditing(false);
      toast({
        title: 'Annotation updated',
        description: 'Your annotation has been successfully updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update annotation: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Add reply mutation
  const addReplyMutation = useMutation({
    mutationFn: (content: string) => addReply(annotation.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/collaboration/annotations', annotation.targetType, annotation.targetId, annotation.workspaceId],
      });
      setNewReply('');
      toast({
        title: 'Reply added',
        description: 'Your reply has been successfully added',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to add reply: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Handle annotation update
  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    
    updateAnnotationMutation.mutate({
      id: annotation.id,
      content: editContent,
      isPrivate,
    });
  };
  
  // Handle annotation delete
  const handleDelete = () => {
    onDelete(annotation.id);
  };
  
  // Handle reply submission
  const handleAddReply = () => {
    if (!newReply.trim()) return;
    addReplyMutation.mutate(newReply);
  };
  
  // Check if the current user is the creator of the annotation
  const isOwner = user?.id === annotation.creatorId;
  
  // Format date for display
  const formattedDate = formatDistance(
    new Date(annotation.updatedAt || annotation.createdAt), 
    new Date(), 
    { addSuffix: true }
  );
  
  // Determine visibility status text
  const visibilityStatus = annotation.isPrivate ? "Private" : "Public";
  
  // Determine avatar initials
  const initials = annotation.creator?.fullName
    ? annotation.creator.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
    : annotation.creator?.username?.substring(0, 2).toUpperCase() || 'U';
  
  return (
    <>
      {/* Annotation marker */}
      <div 
        ref={markerRef}
        className="absolute cursor-pointer z-10 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      ></div>
      
      {/* Annotation popover */}
      <Popover open={isExpanded} onOpenChange={setIsExpanded}>
        <PopoverTrigger asChild>
          <div 
            className={cn(
              "absolute z-20 bg-primary text-primary-foreground rounded-full shadow-md cursor-pointer",
              "flex items-center justify-center h-6 w-6 text-xs font-semibold",
              annotation.isPrivate && "bg-muted text-muted-foreground"
            )}
            style={{
              top: `${annotation.position.top - 10}px`,
              left: `${annotation.position.left + annotation.position.width}px`,
            }}
          >
            {annotation.isPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
          </div>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-80 p-0 shadow-lg"
          align="start"
          sideOffset={10}
        >
          <div className="flex flex-col">
            {/* Header with user info */}
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={annotation.creator?.avatarUrl} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">
                    {annotation.creator?.fullName || annotation.creator?.username || 'Unknown user'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formattedDate} • {visibilityStatus}
                  </div>
                </div>
              </div>
              
              {isOwner && !isEditing && (
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                      setIsExpanded(false);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
              
              {isEditing && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => setIsEditing(false)}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
            
            {/* Content */}
            <div className="p-3">
              {isEditing ? (
                <>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="mb-2 resize-none"
                    rows={3}
                  />
                  <div className="flex justify-between items-center mb-2">
                    <label className="flex items-center text-xs cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isPrivate}
                        onChange={() => setIsPrivate(!isPrivate)}
                        className="mr-1"
                      />
                      Private
                    </label>
                    <Button 
                      size="sm" 
                      onClick={handleSaveEdit}
                      disabled={updateAnnotationMutation.isPending}
                    >
                      {updateAnnotationMutation.isPending ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm">{annotation.content}</div>
              )}
            </div>
            
            {/* Replies section */}
            {!isEditing && (
              <div className="border-t">
                <div 
                  className="p-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-muted/50"
                  onClick={() => setShowReplies(!showReplies)}
                >
                  <MessageCircle size={14} />
                  <span>
                    {replyCount === 0
                      ? 'Add a reply...'
                      : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                  </span>
                </div>
                
                {showReplies && (
                  <div className="px-3 pb-3">
                    {/* Existing replies */}
                    {replies.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {replies.map(reply => (
                          <ReplyItem 
                            key={reply.id}
                            reply={reply}
                            annotationId={annotation.id}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Add reply input */}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add a reply..."
                        value={newReply}
                        onChange={(e) => setNewReply(e.target.value)}
                        className="resize-none text-xs min-h-[2.5rem] py-1"
                        rows={1}
                      />
                      <Button 
                        size="icon" 
                        className="h-8 w-8 shrink-0 self-end"
                        disabled={!newReply.trim() || addReplyMutation.isPending}
                        onClick={handleAddReply}
                      >
                        {addReplyMutation.isPending ? (
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        ) : (
                          <Send size={14} />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}