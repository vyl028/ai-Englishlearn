import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function errorHandler(err: Error, req: Request | AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
//# sourceMappingURL=error.d.ts.map