// Note: This middleware is for server-side usage and should be removed if not needed
// Since we're using a client-side application with Supabase, this middleware isn't needed
// But we'll keep a stub to prevent build errors

// Mocked types to avoid requiring express
interface Request {
  user?: {
    role?: string
  }
}

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
}

interface NextFunction {
  (err?: any): void;
}

export const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const hasRole = allowedRoles.includes(req.user.role || '');
    if (!hasRole) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
};

export default checkRole;
