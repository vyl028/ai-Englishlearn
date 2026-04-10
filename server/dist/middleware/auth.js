"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.generateToken = generateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const response_1 = require("../utils/response");
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-chars';
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return (0, response_1.errorResponse)(res, 'UNAUTHORIZED', '缺少认证令牌', 401);
    }
    const token = authHeader.substring(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    }
    catch {
        return (0, response_1.errorResponse)(res, 'UNAUTHORIZED', '无效的认证令牌', 401);
    }
}
function generateToken(userId) {
    return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}
//# sourceMappingURL=auth.js.map