import { Response } from 'express';
export declare function successResponse<T>(res: Response, data: T, statusCode?: number): Response<any, Record<string, any>>;
export declare function errorResponse(res: Response, code: string, message: string, statusCode?: number): Response<any, Record<string, any>>;
//# sourceMappingURL=response.d.ts.map