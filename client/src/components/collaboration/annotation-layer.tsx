import { useRef, useState, useEffect, RefObject } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { X, MessageSquare, Send, Eye, EyeOff } from 'lucide-react';
import { Annotation, AnnotationPosition, getAnnotations, createAnnotation, deleteAnnotation } from '@/api/collaboration';
import { AnnotationItem } from './annotation-item';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AnnotationLayerProps {
  targetType: string;
  targetId: string;
  workspaceId?: number;
  contentRef: RefObject<HTMLElement>;
}

export function AnnotationLayer({
  targetType,
  targetId,
  workspaceId,
  contentRef
}: AnnotationLayerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState<AnnotationPosition | null>(null);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isGloballyDisabled, setIsGloballyDisabled] = useState(false);
  const selectedAreaRef = useRef<HTMLDivElement>(null);
  
  // Fetch annotations
  const {
    data: annotations = [],
    isLoading,
    error
  } = useQuery<Annotation[]>({
    queryKey: ['/api/collaboration/annotations', targetType, targetId, workspaceId],
    queryFn: () => getAnnotations(targetType, targetId, workspaceId),
    refetchInterval: 30000,  // Refetch every 30 seconds
  });
  
  // Create annotation mutation
  const createAnnotationMutation = useMutation({
    mutationFn: createAnnotation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/collaboration/annotations', targetType, targetId, workspaceId],
      });
      setNewAnnotation('');
      setSelectedText('');
      setSelectionPosition(null);
      toast({
        title: 'Annotation created',
        description: 'Your annotation has been successfully created',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create annotation: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Delete annotation mutation
  const deleteAnnotationMutation = useMutation({
    mutationFn: deleteAnnotation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/collaboration/annotations', targetType, targetId, workspaceId],
      });
      toast({
        title: 'Annotation deleted',
        description: 'The annotation has been successfully deleted',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete annotation: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Handle text selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isGloballyDisabled) return;
      
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !contentRef.current) return;
      
      const selectedText = selection.toString().trim();
      if (!selectedText) return;
      
      let targetNode = selection.anchorNode;
      // Make sure we're working with an element node
      while (targetNode && targetNode.nodeType !== Node.ELEMENT_NODE) {
        targetNode = targetNode.parentNode;
      }
      
      // Check if the selection is within our content container
      const isWithinContent = contentRef.current.contains(targetNode);
      if (!isWithinContent) return;
      
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = contentRef.current.getBoundingClientRect();
      
      // Calculate position relative to the content container
      const position: AnnotationPosition = {
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
        height: rect.height,
        xpath: getXPath(targetNode as Element, contentRef.current),
      };
      
      setSelectedText(selectedText);
      setSelectionPosition(position);
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [contentRef, isGloballyDisabled]);
  
  const handleCreateAnnotation = () => {
    if (!newAnnotation.trim() || !selectionPosition || !user) return;
    
    createAnnotationMutation.mutate({
      targetType,
      targetId,
      content: newAnnotation,
      position: selectionPosition,
      isPrivate,
      workspaceId,
    });
  };
  
  // Helper to create XPath for the node
  function getXPath(element: Element, contextNode: Element): string {
    const paths = [];
    let currentNode: Element | null = element;
    
    while (currentNode !== contextNode && currentNode && currentNode.parentNode) {
      let index = 0;
      let hasFollowingSiblings = false;
      
      for (let sibling = currentNode.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === currentNode.nodeName) {
          index++;
        }
      }
      
      for (let sibling = currentNode.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === currentNode.nodeName) {
          hasFollowingSiblings = true;
        }
      }
      
      const tagName = currentNode.nodeName.toLowerCase();
      const pathIndex = index || hasFollowingSiblings ? `[${index + 1}]` : '';
      paths.unshift(tagName + pathIndex);
      
      currentNode = currentNode.parentNode as Element;
    }
    
    return paths.length ? '/' + paths.join('/') : '';
  }
  
  // Cancel annotation
  const cancelAnnotation = () => {
    setSelectedText('');
    setSelectionPosition(null);
    setNewAnnotation('');
  };
  
  // Toggle global annotations (for demonstration)
  const toggleAnnotations = () => {
    setIsGloballyDisabled(!isGloballyDisabled);
  };
  
  if (error) {
    return (
      <div className="annotation-error p-4 bg-destructive/10 text-destructive rounded">
        Failed to load annotations: {(error as Error).message}
      </div>
    );
  }
  
  return (
    <>
      {/* Annotation toggle */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "rounded-full w-10 h-10 shadow-md",
            isGloballyDisabled ? "bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={toggleAnnotations}
        >
          {isGloballyDisabled ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
      </div>
      
      {/* Selection popover */}
      {!isGloballyDisabled && selectedText && selectionPosition && (
        <div 
          ref={selectedAreaRef}
          className="absolute z-30 pointer-events-none"
          style={{
            top: `${selectionPosition.top}px`,
            left: `${selectionPosition.left}px`,
            width: `${selectionPosition.width}px`,
            height: `${selectionPosition.height}px`,
          }}
        >
          <Popover open={!!selectedText}>
            <PopoverTrigger asChild>
              <div className="h-full w-full pointer-events-none"></div>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 p-3 pointer-events-auto"
              align="start"
              alignOffset={-10}
              sideOffset={10}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium">New Annotation</div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={cancelAnnotation}
                >
                  <X size={16} />
                </Button>
              </div>
              
              <div className="mb-2 text-sm text-muted-foreground pb-2 border-b">
                <span className="font-medium">Selected text:</span> "{selectedText}"
              </div>
              
              <Textarea
                placeholder="Add your annotation..."
                value={newAnnotation}
                onChange={(e) => setNewAnnotation(e.target.value)}
                className="mb-2 resize-none"
                rows={3}
              />
              
              <div className="flex justify-between items-center">
                <label className="flex items-center text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isPrivate}
                    onChange={() => setIsPrivate(!isPrivate)}
                    className="mr-2"
                  />
                  Private
                </label>
                
                <Button 
                  size="sm" 
                  onClick={handleCreateAnnotation}
                  disabled={!newAnnotation.trim() || createAnnotationMutation.isPending}
                >
                  {createAnnotationMutation.isPending ? (
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Send size={14} className="mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
      
      {/* Existing annotations */}
      {!isGloballyDisabled && !isLoading && annotations.map((annotation) => (
        <AnnotationItem
          key={annotation.id}
          annotation={annotation}
          contentRef={contentRef}
          onDelete={(id) => deleteAnnotationMutation.mutate(id)}
        />
      ))}
      
      {/* Loading state overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/20 flex items-center justify-center z-10">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </>
  );
}