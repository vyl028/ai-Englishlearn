"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
function successResponse(res, data, statusCode = 200) {
    const response = {
        success: true,
        data,
    };
    return res.status(statusCode).json(response);
}
function errorResponse(res, code, message, statusCode = 400) {
    const response = {
        success: false,
        error: {
            code,
            message,
        },
    };
    return res.status(statusCode).json(response);
}
//# sourceMappingURL=response.js.map