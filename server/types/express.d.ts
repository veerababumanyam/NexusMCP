import { User } from '@shared/schema';
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: JwtPayload;
    }
  }
}