/**
 * API Key Authentication Middleware
 * 
 * This middleware handles API key authentication for upstream clients.
 * It supports both header-based and URL-based API key transmission methods:
 * 
 * 1. Header-based: Authorization: Bearer <api_key>
 * 2. URL-based: ?api_key=<api_key>
 * 
 * The API key is validated against the database, and if valid, the user
 * is attached to the request object for use in subsequent middleware/handlers.
 */

import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/apiKeyService';
import { createAuditLog } from '../services/auditLogService';

// Extend Express Request type to include API key information
declare module 'express' {
    interface Request {
        apiKey?: {
            id: number;
            userId: number;
            workspaceId?: number;
            scopes: string[];
        };
    }
}

/**
 * Extracts API key from various sources in the request
 */
export function extractApiKey(req: Request): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Check X-API-Key header (common convention)
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) {
        return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    }

    // Check URL query parameter
    if (req.query.api_key) {
        return req.query.api_key as string;
    }

    return null;
}

/**
 * Middleware that requires API key authentication
 * Used for machine-to-machine API access
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key is required. Provide either an Authorization Bearer header or api_key query parameter.',
            docs: 'https://docs.nexusmcp.com/api-authentication'
        });
    }

    // Validate the API key
    apiKeyService.verifyApiKey(apiKey)
        .then(result => {
            if (!result) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid or expired API key'
                });
            }

            // Attach the API key info to the request for use in subsequent handlers
            req.apiKey = {
                id: result.keyId,
                userId: result.userId,
                workspaceId: result.workspaceId,
                scopes: result.scopes
            };

            // Create audit log entry for API key usage
            createAuditLog({
                userId: result.userId,
                action: 'api_key_used',
                resourceType: 'api_key',
                resourceId: result.keyId.toString(),
                workspaceId: result.workspaceId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string,
                details: {
                    method: req.method,
                    path: req.path,
                    query: req.query
                }
            }).catch(error => {
                console.error('Error creating audit log for API key usage:', error);
            });

            next();
        })
        .catch(error => {
            console.error('Error validating API key:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'An error occurred while validating the API key'
            });
        });
}

/**
 * Middleware for API key authentication with specific scopes
 * @param requiredScopes Array of required permission scopes
 */
export function requireApiKeyWithScopes(requiredScopes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        // First perform basic API key authentication
        requireApiKey(req, res, (err) => {
            if (err) return next(err);

            // Check if authenticated with API key
            if (!req.apiKey) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'API key authentication required'
                });
            }

            // Check for wildcard scope which grants access to everything
            if (req.apiKey.scopes.includes('*')) {
                return next();
            }

            // Check if the API key has all required scopes
            const missingScopes = requiredScopes.filter(scope => !req.apiKey!.scopes.includes(scope));

            if (missingScopes.length > 0) {
                // Create audit log entry for insufficient permissions
                createAuditLog({
                    userId: req.apiKey.userId,
                    action: 'api_key_insufficient_permissions',
                    resourceType: 'api_key',
                    resourceId: req.apiKey.id.toString(),
                    workspaceId: req.apiKey.workspaceId,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'] as string,
                    details: {
                        requiredScopes,
                        missingScopes,
                        method: req.method,
                        path: req.path
                    }
                }).catch(err => {
                    console.error('Error creating audit log for insufficient permissions:', err);
                });

                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'API key does not have the required permissions',
                    requiredScopes,
                    missingScopes,
                    docs: 'https://docs.nexusmcp.com/api-scopes'
                });
            }

            next();
        });
    };
}