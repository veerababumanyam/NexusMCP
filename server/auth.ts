/**
 * Authentication and Authorization Middleware
 * 
 * Provides middleware functions for securing API routes:
 * - requireAuth: Ensures a user is authenticated
 * - requireAdmin: Ensures a user is authenticated and has admin privileges
 * - setupAuth: Sets up Passport.js authentication
 */

import { Request, Response, NextFunction, Express } from 'express';
import passport from 'passport';
import session from 'express-session';
import { Strategy as LocalStrategy } from 'passport-local';

/**
 * Setup authentication for the Express application
 * 
 * @param app - Express application instance
 * @returns Object containing authentication middleware functions
 */
export function setupAuth(app: Express) {
  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'nexus-mcp-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Initialize Passport and session management
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure local strategy (username/password)
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        // In a real implementation, you would fetch the user from the database
        // and verify the password

        // For now, accept a demo account
        if (username === 'admin' && password === 'admin') {
          return done(null, { id: 1, username: 'admin', isAdmin: true } as Express.User);
        }
        
        return done(null, false, { message: 'Invalid credentials' });
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Serialize user into the session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user from the session
  passport.deserializeUser((user: Express.User, done) => {
    done(null, user);
  });

  // Define authentication routes
  app.post('/api/auth/local', (req: Request, res: Response, next: NextFunction) => {
    // Set cookie expiration based on rememberMe flag
    if (req.body.rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    } else {
      req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours (default)
    }
    
    next();
  }, passport.authenticate('local', {
    failWithError: true
  }), (req: Request, res: Response) => {
    // If we got here, authentication succeeded
    res.json({
      user: req.user
    });
  }, (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Authentication failed
    res.status(401).json({ error: 'Authentication failed', message: err.message });
  });
  
  // Keep original route for backward compatibility
  app.post('/api/login', (req: Request, res: Response, next: NextFunction) => {
    // Set cookie expiration based on rememberMe flag
    if (req.body.rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    } else {
      req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours (default)
    }
    
    next();
  }, passport.authenticate('local', {
    failWithError: true
  }), (req: Request, res: Response) => {
    res.json({ 
      user: req.user 
    });
  }, (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Authentication failed
    res.status(401).json({ error: 'Authentication failed', message: err.message });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });
  
  // Keep original route for backward compatibility
  app.post('/api/logout', (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });

  app.get('/api/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Unauthorized", message: 'Authentication required' });
    }
  });
  
  // Keep original route for backward compatibility
  app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Unauthorized", message: 'Authentication required' });
    }
  });
  
  // Return the middleware functions
  return {
    requireAuth,
    requireAdmin,
    requirePermission,
    requireWorkspaceAdmin
  };
}

/**
 * Middleware to require authentication for protected routes
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // For now, this is a simplified implementation
  // In a real implementation, this would check session tokens or JWT
  
  // If we have a user object on the request, assume authenticated
  // This would be set by passport or auth service
  if (req.user) {
    return next();
  }
  
  // Check for an API key in the headers
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    // In a real implementation, validate the API key against the database
    // For now, accept any non-empty API key
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      return next();
    }
  }
  
  return res.status(401).json({ message: 'Authentication required' });
}

/**
 * Middleware to require admin role for protected routes
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // First ensure the user is authenticated
  requireAuth(req, res, () => {
    // Check if the user has admin privileges
    // In a real implementation, this would check the user's roles
    // For now, this is a simplified implementation that assumes
    // admin status is stored on the user object
    
    if (req.user && (req.user as any).isAdmin) {
      return next();
    }
    
    // Check for admin API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey === process.env.ADMIN_API_KEY) {
      return next();
    }
    
    return res.status(403).json({ message: 'Admin privileges required' });
  });
}

/**
 * Middleware to require specific permissions for protected routes
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // First ensure the user is authenticated
    requireAuth(req, res, () => {
      // In a real implementation, this would check if the user has the required permission
      // For now, we'll simplify and allow any authenticated user
      return next();
    });
  };
}

/**
 * Middleware to require workspace admin privileges
 */
export function requireWorkspaceAdmin(req: Request, res: Response, next: NextFunction) {
  // First ensure the user is authenticated
  requireAuth(req, res, () => {
    // In a real implementation, this would check if the user is a workspace admin
    // For now, assume any user with admin privileges is a workspace admin
    if (req.user && (req.user as any).isAdmin) {
      return next();
    }
    
    return res.status(403).json({ message: 'Workspace admin privileges required' });
  });
}