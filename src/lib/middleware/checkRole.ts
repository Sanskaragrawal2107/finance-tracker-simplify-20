
import { UserRole } from '../types';

// Define minimal Express types to avoid dependency on express
interface Request {
  user?: {
    role?: UserRole;
    [key: string]: any;
  };
  [key: string]: any;
}

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  [key: string]: any;
}

type NextFunction = () => void;

export const checkRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};
