import React, { useRef } from 'react';
import { AnnotationLayer } from './annotation-layer';
import { cn } from '@/lib/utils';

interface AnnotatableContentProps {
  targetType: string;
  targetId: string;
  workspaceId?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * AnnotatableContent wraps any content and adds annotation capabilities
 * 
 * Usage example:
 * 
 * ```tsx
 * <AnnotatableContent 
 *   targetType="document" 
 *   targetId="123"
 *   workspaceId={user.activeWorkspaceId}
 * >
 *   <div className="prose">
 *     <h2>Document Title</h2>
 *     <p>This is a paragraph that can be annotated...</p>
 *   </div>
 * </AnnotatableContent>
 * ```
 */
export function AnnotatableContent({
  targetType,
  targetId,
  workspaceId,
  children,
  className
}: AnnotatableContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className={cn("relative", className)}>
      {/* The actual content */}
      <div ref={contentRef} className="annotatable-content-container">
        {children}
      </div>
      
      {/* The annotation layer */}
      <AnnotationLayer
        targetType={targetType}
        targetId={targetId}
        workspaceId={workspaceId}
        contentRef={contentRef}
      />
    </div>
  );
}