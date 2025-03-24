import { UserRole } from '@/lib/types';
import { Request, Response, NextFunction } from 'express';

export const checkAdminRole = (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.user?.role;
  
  if (!userRole || userRole !== UserRole.ADMIN) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to perform this action. Admin access required.'
    });
  }
  
  next();
};

export const checkSupervisorOrAdminRole = (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.user?.role;
  
  if (!userRole || (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERVISOR)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to perform this action. Supervisor or Admin access required.'
    });
  }
  
  next();
}; 