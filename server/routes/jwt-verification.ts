import { Router, Request, Response } from 'express';
import { JwtMiddleware } from '../services/jwt/JwtMiddleware';
import { JwtService } from '../services/jwt/JwtService';
import logger from '../logger';

export const jwtVerificationRouter = Router();
const jwtMiddleware = JwtMiddleware.getInstance();
const jwtService = JwtService.getInstance();

// Endpoint to verify a JWT token
jwtVerificationRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token, audience, issuer, settingsId } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token is required'
      });
    }

    try {
      // Verify the token
      const decodedToken = await jwtService.verifyToken(token, 
        settingsId ? parseInt(settingsId) : undefined);
      
      // Check if token is revoked
      if (decodedToken.jti) {
        const isRevoked = await jwtService.isTokenRevoked(decodedToken.jti);
        if (isRevoked) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token has been revoked',
            verified: false
          });
        }
      }

      // Record token usage if enabled
      if (req.query.record === 'true' && decodedToken.jti) {
        await jwtMiddleware.recordTokenUsage(req, decodedToken.jti);
      }

      // Return successful verification
      return res.status(200).json({
        verified: true,
        token: decodedToken
      });
    } catch (error) {
      logger.error('JWT verification error', { error });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
        verified: false
      });
    }
  } catch (error) {
    logger.error('JWT verification endpoint error', { error });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }
});

// Protected endpoint example
jwtVerificationRouter.get('/protected', 
  jwtMiddleware.createMiddleware(),
  (req: Request, res: Response) => {
    return res.status(200).json({
      message: 'You have access to this protected resource',
      user: req.user,
      token: req.token
    });
  }
);

// Role-protected endpoint example
jwtVerificationRouter.get('/admin', 
  jwtMiddleware.requireAdmin(),
  (req: Request, res: Response) => {
    return res.status(200).json({
      message: 'You have admin access',
      user: req.user
    });
  }
);

// Custom roles endpoint example
jwtVerificationRouter.get('/custom-role', 
  jwtMiddleware.requireRoles(['custom_role', 'admin']),
  (req: Request, res: Response) => {
    return res.status(200).json({
      message: 'You have the required custom role',
      user: req.user
    });
  }
);