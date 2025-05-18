import { apiRequest } from '@/lib/queryClient';

// Annotation types
export interface AnnotationPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  xpath: string;
}

export interface Annotation {
  id: number;
  targetType: string;
  targetId: string;
  content: string;
  position: AnnotationPosition;
  creatorId: number;
  workspaceId?: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: number;
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
  replies?: AnnotationReply[];
}

export interface AnnotationReply {
  id: number;
  annotationId: number;
  content: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

// API functions for annotations
export async function getAnnotations(targetType: string, targetId: string, workspaceId?: number) {
  const params = new URLSearchParams();
  params.append('targetType', targetType);
  params.append('targetId', targetId);
  if (workspaceId) params.append('workspaceId', workspaceId.toString());
  
  const response = await apiRequest(
    'GET',
    `/api/collaboration/annotations?${params.toString()}`
  );
  
  return response.json();
}

export async function createAnnotation(data: {
  targetType: string;
  targetId: string;
  content: string;
  position: AnnotationPosition;
  isPrivate?: boolean;
  workspaceId?: number;
}) {
  const response = await apiRequest(
    'POST',
    '/api/collaboration/annotations',
    data
  );
  
  return response.json();
}

export async function updateAnnotation(
  id: number,
  data: {
    content?: string;
    isPrivate?: boolean;
  }
) {
  const response = await apiRequest(
    'PATCH',
    `/api/collaboration/annotations/${id}`,
    data
  );
  
  return response.json();
}

export async function deleteAnnotation(id: number) {
  const response = await apiRequest(
    'DELETE',
    `/api/collaboration/annotations/${id}`
  );
  
  return response.json();
}

// API functions for replies
export async function getReplies(annotationId: number) {
  const response = await apiRequest(
    'GET',
    `/api/collaboration/annotations/${annotationId}/replies`
  );
  
  return response.json();
}

export async function addReply(annotationId: number, content: string) {
  const response = await apiRequest(
    'POST',
    `/api/collaboration/annotations/${annotationId}/replies`,
    { content }
  );
  
  return response.json();
}

export async function updateReply(replyId: number, content: string) {
  const response = await apiRequest(
    'PATCH',
    `/api/collaboration/replies/${replyId}`,
    { content }
  );
  
  return response.json();
}

export async function deleteReply(replyId: number) {
  const response = await apiRequest(
    'DELETE',
    `/api/collaboration/replies/${replyId}`
  );
  
  return response.json();
}

// API functions for mentions
export async function getUserMentions() {
  const response = await apiRequest(
    'GET',
    '/api/collaboration/mentions'
  );
  
  return response.json();
}

export async function addMention(data: {
  userId: number;
  mentionedBy: number;
  annotationId?: number;
  replyId?: number;
}) {
  const response = await apiRequest(
    'POST',
    '/api/collaboration/mentions',
    data
  );
  
  return response.json();
}