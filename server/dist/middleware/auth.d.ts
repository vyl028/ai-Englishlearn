import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function generateToken(userId: string): string;
//# sourceMappingURL=auth.d.ts.map