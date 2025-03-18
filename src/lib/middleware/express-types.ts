
// Mock Express types to avoid needing to install express
export interface Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  [key: string]: any;
}

export interface Response {
  status(code: number): Response;
  json(data: any): Response;
  [key: string]: any;
}

export interface NextFunction {
  (error?: any): void;
}
