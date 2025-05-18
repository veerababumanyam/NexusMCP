import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

export type AnnotationTarget = {
  type: string;
  id: string;
};

export type CollaborationEvent = {
  type: string;
  data: any;
  timestamp: string;
};

export function useCollaboration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [activeTarget, setActiveTarget] = useState<AnnotationTarget | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  
  // Event handlers object to store subscribers
  const eventHandlersRef = useRef<Record<string, ((data: any) => void)[]>>({});

  // Connect to the WebSocket server
  const connect = useCallback(() => {
    if (!user) return;
    
    try {
      // Clean up any existing connection
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Clear any pending reconnection attempt
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Determine the WebSocket URL
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;
      
      // Create new WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log("Connected to collaboration service");
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // Send authentication message
        socket.send(JSON.stringify({
          type: "authenticate",
          data: {
            userId: user.id,
            workspaceId: user.activeWorkspaceId
          }
        }));
        
        // Register active target if any
        if (activeTarget) {
          socket.send(JSON.stringify({
            type: "register_target",
            data: activeTarget
          }));
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as CollaborationEvent;
          
          // Handle different types of events
          switch (message.type) {
            case "authentication_success":
              console.log("Authentication successful");
              break;
              
            case "authentication_failed":
              console.error("Authentication failed");
              setError(new Error("Authentication failed"));
              socket.close();
              break;
              
            case "annotation_created":
              if (activeTarget && 
                  message.data.targetType === activeTarget.type && 
                  message.data.targetId === activeTarget.id) {
                setAnnotations(prev => [...prev, message.data]);
                // Dispatch to registered handlers
                dispatchEvent("annotation_created", message.data);
              }
              break;
              
            case "annotation_updated":
              if (activeTarget && 
                  message.data.targetType === activeTarget.type && 
                  message.data.targetId === activeTarget.id) {
                setAnnotations(prev => 
                  prev.map(a => a.id === message.data.id ? message.data : a)
                );
                // Dispatch to registered handlers
                dispatchEvent("annotation_updated", message.data);
              }
              break;
              
            case "annotation_deleted":
              if (activeTarget && 
                  message.data.targetType === activeTarget.type && 
                  message.data.targetId === activeTarget.id) {
                setAnnotations(prev => 
                  prev.filter(a => a.id !== message.data.id)
                );
                // Dispatch to registered handlers
                dispatchEvent("annotation_deleted", message.data);
              }
              break;
              
            case "reply_created":
            case "reply_updated":
            case "reply_deleted":
              // Dispatch to registered handlers
              dispatchEvent(message.type, message.data);
              break;
              
            case "mention_created":
              if (message.data.mentionedUserId === user.id) {
                toast({
                  title: "New Mention",
                  description: "You were mentioned in an annotation or reply",
                  variant: "default"
                });
              }
              // Dispatch to registered handlers
              dispatchEvent("mention_created", message.data);
              break;
              
            default:
              console.log("Unhandled message type:", message.type);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code}`);
        setConnected(false);
        
        // Attempt to reconnect unless this was an intentional close
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * reconnectAttemptsRef.current, 5000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError(new Error("Maximum reconnection attempts reached"));
          toast({
            title: "Connection Lost",
            description: "Could not reconnect to the collaboration service",
            variant: "destructive"
          });
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError(new Error("WebSocket connection error"));
      };
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [user, activeTarget, toast]);
  
  // Register an active target (document, policy, etc.)
  const registerTarget = useCallback((target: AnnotationTarget) => {
    setActiveTarget(target);
    
    // If connected, send registration message
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "register_target",
        data: target
      }));
      
      // Load annotations for the target
      fetchAnnotations(target);
    }
  }, []);
  
  // Fetch annotations for a target
  const fetchAnnotations = useCallback(async (target: AnnotationTarget) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/collaboration/annotations?targetType=${target.type}&targetId=${target.id}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching annotations: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnnotations(data);
    } catch (error) {
      console.error("Error fetching annotations:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      toast({
        title: "Error",
        description: "Failed to load annotations",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);
  
  // Create a new annotation
  const createAnnotation = useCallback(async (data: {
    targetType: string;
    targetId: string;
    content: string;
    position: any;
    isPrivate?: boolean;
    workspaceId?: number;
  }) => {
    if (!user) return null;
    
    try {
      const response = await fetch("/api/collaboration/annotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Error creating annotation: ${response.statusText}`);
      }
      
      const createdAnnotation = await response.json();
      
      // We don't need to add to state as we'll receive the WebSocket event
      return createdAnnotation;
    } catch (error) {
      console.error("Error creating annotation:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      toast({
        title: "Error",
        description: "Failed to create annotation",
        variant: "destructive"
      });
      return null;
    }
  }, [user, toast]);
  
  // Add a reply to an annotation
  const addReply = useCallback(async (annotationId: number, content: string) => {
    if (!user) return null;
    
    try {
      const response = await fetch(`/api/collaboration/annotations/${annotationId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        throw new Error(`Error adding reply: ${response.statusText}`);
      }
      
      const createdReply = await response.json();
      return createdReply;
    } catch (error) {
      console.error("Error adding reply:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      toast({
        title: "Error",
        description: "Failed to add reply",
        variant: "destructive"
      });
      return null;
    }
  }, [user, toast]);
  
  // Subscribe to an event
  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (!eventHandlersRef.current[eventType]) {
      eventHandlersRef.current[eventType] = [];
    }
    
    eventHandlersRef.current[eventType].push(handler);
    
    // Return unsubscribe function
    return () => {
      if (eventHandlersRef.current[eventType]) {
        eventHandlersRef.current[eventType] = eventHandlersRef.current[eventType].filter(
          h => h !== handler
        );
      }
    };
  }, []);
  
  // Dispatch an event to registered handlers
  const dispatchEvent = useCallback((eventType: string, data: any) => {
    if (eventHandlersRef.current[eventType]) {
      eventHandlersRef.current[eventType].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventType} event handler:`, error);
        }
      });
    }
  }, []);
  
  // Connect on mount and when user changes
  useEffect(() => {
    if (user) {
      connect();
    }
    
    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [user, connect]);
  
  // If the active target changes, load annotations for it
  useEffect(() => {
    if (activeTarget && user) {
      fetchAnnotations(activeTarget);
    }
  }, [activeTarget, user, fetchAnnotations]);
  
  return {
    connected,
    isLoading,
    error,
    activeTarget,
    annotations,
    registerTarget,
    createAnnotation,
    addReply,
    subscribe
  };
}