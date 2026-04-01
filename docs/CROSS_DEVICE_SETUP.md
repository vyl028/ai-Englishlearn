# LexiCapture 跨设备访问实施方案

**创建时间**：2026-04-01  
**目标**：使项目在开发阶段即可通过电脑 IP 地址让手机访问，并确保核心功能在移动端正常工作，为后续响应式优化打好基础。

> 本方案与 `docs/MULTI_DEVICE_PLAN.md` 互补：该文档关注界面与交互的响应式优化，本文档解决**网络可达性**与**环境适配**问题。

## 1. 当前架构与限制分析

### 1.1 服务架构
LexiCapture 采用**双服务架构**：
- **Next.js 主应用**：端口 `9002`（开发），提供 UI 与 Server Actions
- **AI 服务（Express）**：端口 `3400`（可选），处理图片识别与单词定义

### 1.2 当前限制
1. **网络监听限制**：默认只监听 `localhost`（127.0.0.1），局域网设备无法访问
2. **防火墙阻挡**：Windows 防火墙可能阻止外部访问端口
3. **API 跨域问题**：手机访问电脑 IP 时，前端请求可能被浏览器阻止
4. **移动端特有 API 要求**：
   - 摄像头/麦克风：需 HTTPS 或 `localhost`（开发环境可用）
   - Web Speech API（ASR/TTS）：iOS Safari 要求 HTTPS
   - Service Worker：PWA 功能要求 HTTPS 或 `localhost`

### 1.3 可访问性矩阵
| 场景 | 电脑浏览器 | 手机（同一 WiFi） | 生产环境 |
|------|------------|------------------|----------|
| **localhost:9002** | ✅ | ❌（需网络可达） | ❌ |
| **电脑IP:9002** | ✅（需配置） | ✅（需配置） | ❌ |
| **AI 服务 (3400)** | ✅（localhost） | ❌（需配置） | ✅（部署后） |

## 2. 修改步骤（开发环境）

### 2.1 修改 Next.js 开发服务器监听所有接口

#### 修改文件：`package.json`
```diff
{
  "scripts": {
-    "dev": "node --require ./scripts/node-preload.cjs scripts/next-safe.cjs dev --turbopack -p 9002",
+    "dev": "node --require ./scripts/node-preload.cjs scripts/next-safe.cjs dev --turbopack -p 9002 --hostname 0.0.0.0",
    ...
  }
}
```

**作用**：`--hostname 0.0.0.0` 让 Next.js 监听所有网络接口，允许局域网设备连接。

#### 修改文件：`next.config.ts`（可选）
若开发时遇到 CORS 问题，可临时放宽 `allowedDevOrigins`：
```diff
const nextConfig: NextConfig = {
  ...
  allowedDevOrigins: [
    'http://10.21.250.55:9002',
+    'http://<你的电脑IP>:9002', // 添加你的电脑IP
+    'http://localhost:9002',
  ],
  ...
};
```

> **注意**：`10.21.250.55` 是原文档中的 IP，可根据你的网络环境保留或移除。

### 2.2 修改 AI 服务监听所有接口

#### 修改文件：`src/ai/server.ts`
```diff
app.listen(port, () => {
-  console.log(`[AI Service] Custom server listening on http://localhost:${port}`);
+  console.log(`[AI Service] Custom server listening on http://0.0.0.0:${port}`);
-});
+}, '0.0.0.0');
```

**作用**：让 AI 服务（端口 3400）也允许局域网访问。

#### 修改文件：`src/app/actions.ts`（如需）
如果前端需要调用 AI 服务的局域网地址，可检查以下常量：
```typescript
// 检查是否有 GENKIT_API_URL 或 AI_USE_LOCAL 配置
// 当前代码直接 import 调用，无需修改
```

### 2.3 配置防火墙（Windows）

允许端口通过防火墙，使外部设备可访问：

#### 方法 A：PowerShell（管理员权限）
```powershell
# 允许 Next.js 端口 9002
netsh advfirewall firewall add rule name="Next.js Dev (9002)" dir=in action=allow protocol=TCP localport=9002

# 允许 AI 服务端口 3400（如使用）
netsh advfirewall firewall add rule name="LexiCapture AI (3400)" dir=in action=allow protocol=TCP localport=3400
```

#### 方法 B：Windows Defender 防火墙图形界面
1. 打开「Windows Defender 防火墙」
2. 「高级设置」→「入站规则」→「新建规则」
3. 选择「端口」→「TCP」→「特定本地端口」输入 `9002,3400`
4. 「允许连接」→ 勾选所有网络类型 → 命名保存

### 2.4 获取电脑 IP 地址

#### Windows 命令提示符
```cmd
ipconfig
```
在输出中找到：
- **IPv4 地址**：如 `192.168.1.100`（家庭网络通常为 `192.168.x.x`）
- **无线局域网适配器 WLAN** 或 **以太网适配器 以太网** 下的地址

#### 检查网络连接
确保手机与电脑连接**同一 WiFi 网络**（同一子网）。

## 3. 启动与测试流程

### 3.1 启动所有服务
```bash
# 终端 1：启动 Next.js 主应用
npm run dev

# 终端 2：启动 AI 服务（如需独立 AI 服务）
npm run ai:dev
```

### 3.2 手机访问步骤
1. **手机连接同一 WiFi**
2. **浏览器访问**：
   ```
   http://<你的电脑IP>:9002
   ```
   例如：`http://192.168.1.100:9002`

3. **测试核心功能**：
   - [ ] 页面加载正常（无空白或错误）
   - [ ] 导航切换模块
   - [ ] 「新增单词」→「拍照」摄像头权限
   - [ ] 「听说训练」麦克风权限
   - [ ] 单词本操作（点击、滚动）

### 3.3 常见问题排查

#### 问题 1：手机无法访问（连接被拒绝）
- **检查**：电脑防火墙是否允许端口 9002
- **检查**：Next.js 启动日志是否显示 `http://0.0.0.0:9002`
- **检查**：手机与电脑是否同一网络（可尝试互相 ping）

#### 问题 2：摄像头/麦克风权限失败
- **原因**：部分浏览器要求 HTTPS 或 `localhost`
- **解决**：Chrome/Edge 开发环境支持 `localhost` 或 IP 访问；iOS Safari 限制较多，建议使用 Chrome for Android 或 Edge for iOS 测试

#### 问题 3：AI 功能失败（图片识别、单词定义）
- **检查**：AI 服务是否启动（`npm run ai:dev`）
- **检查**：浏览器开发者工具 Network 面板，查看请求是否发送到正确地址
- **注意**：当前架构中 Server Actions 直接调用本地函数，不依赖 HTTP AI 服务，此步仅当使用独立 AI 服务时需要

#### 问题 4：跨域错误（CORS）
- **表现**：浏览器控制台出现 `Access-Control-Allow-Origin` 错误
- **解决**：确保 `next.config.ts` 的 `allowedDevOrigins` 包含手机访问的地址

## 4. 生产环境部署方案

### 4.1 简易部署选项（推荐）

#### 选项 A：Vercel（最简）
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel deploy
```
**优势**：自动 HTTPS、CDN、全球加速、无需配置服务器

#### 选项 B：Firebase Hosting（项目已有配置）
```bash
# 安装 Firebase CLI
npm i -g firebase-tools
firebase login
firebase init hosting

# 部署
npm run build
firebase deploy
```
**优势**：与 Firebase 生态集成，项目已有 `apphosting.yaml`

#### 选项 C：Docker + 云服务器
```dockerfile
# Dockerfile 示例
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 4.2 生产环境配置要点
1. **HTTPS 必须**：所有现代浏览器要求 HTTPS 才能使用摄像头/麦克风/Service Worker
2. **环境变量**：生产环境需设置 `GOOGLE_API_KEY` 等 AI 密钥
3. **数据库迁移**：当前 localStorage 仅限单设备，生产需换为 Firestore/PostgreSQL
4. **AI 服务部署**：如需独立 AI 服务，需一并部署或换用云 AI API

### 4.3 多设备数据同步考虑
当前 **localStorage** 方案的限制：
- 数据仅存在当前浏览器
- 清缓存即丢失
- 无法跨设备同步

**短期过渡方案**：
- 加强「备份/导入」功能，用户手动导出 JSON 在设备间传输
- 添加「导出到文件」和「从文件导入」快捷操作

**长期方案**：
- 引入用户账号（Firebase Auth）
- 数据存于 Firestore / PostgreSQL
- 实时多端同步

## 5. 移动端专项优化建议

### 5.1 立即可做的优化
1. **触摸目标扩大**：确保所有按钮 ≥44×44px（WCAG 2.1）
2. **移动端视口优化**：检查 `src/app/layout.tsx` 的 viewport 配置
3. **输入框适配**：使用 `inputmode="text"`、`autocapitalize="none"`

### 5.2 与响应式优化计划的衔接
完成本文档的**网络可达性**配置后，可进入 `docs/MULTI_DEVICE_PLAN.md` 的**阶段一**：
1. 全局断点审核与统一
2. 触摸目标达标
3. 关键组件布局修复

## 6. 验证清单

### 开发环境验证
- [ ] Next.js 启动命令已添加 `--hostname 0.0.0.0`
- [ ] 防火墙已开放端口 9002（和 3400）
- [ ] 手机浏览器可访问 `http://<电脑IP>:9002`
- [ ] 核心功能测试通过：
  - [ ] 页面加载与导航
  - [ ] 单词采集（手动输入、拍照、上传）
  - [ ] 单词本操作（搜索、筛选、掌握标记）
  - [ ] 练习与故事生成
  - [ ] 听说训练（麦克风权限）
- [ ] 控制台无跨域错误

### 生产准备验证
- [ ] HTTPS 配置完成（证书、重定向）
- [ ] 环境变量已配置（AI 密钥等）
- [ ] 构建无错误：`npm run build`
- [ ] PWA 功能正常（可添加到主屏幕）

## 7. 故障排除速查表

| 问题现象 | 可能原因 | 解决方案 |
|----------|----------|----------|
| 手机无法访问 | 1. 防火墙阻挡<br>2. 不同网络<br>3. IP 地址错误 | 1. 检查防火墙规则<br>2. 确保同一 WiFi<br>3. 重新运行 `ipconfig` |
| 摄像头/麦克风权限被拒 | 1. 非 HTTPS<br>2. 浏览器限制<br>3. 域名不在白名单 | 1. 开发环境用 Chrome/Edge<br>2. 确保访问地址为 IP 或 localhost<br>3. iOS Safari 限制多，用其他浏览器 |
| AI 功能失败 | 1. AI 服务未启动<br>2. API 密钥未配置<br>3. 网络超时 | 1. 启动 `npm run ai:dev`<br>2. 检查 `.env` 文件<br>3. 增加 `AI_TIMEOUT_MS` |
| 页面样式错乱 | 1. 移动端 CSS 未适配<br>2. 视口设置问题 | 1. 进入响应式优化阶段<br>2. 检查 `viewport` meta 标签 |
| 控制台跨域错误 | 1. `allowedDevOrigins` 未配置<br>2. 请求地址错误 | 1. 更新 `next.config.ts`<br>2. 检查 Network 面板实际请求 |

## 8. 后续步骤建议

### 立即行动（今天）
1. 修改 `package.json` dev 脚本
2. 配置防火墙
3. 测试手机访问基本页面

### 短期跟进（本周）
1. 完成 `docs/MULTI_DEVICE_PLAN.md` 阶段一（基础响应式修复）
2. 强化移动端测试（实际设备）
3. 完善 PWA 体验

### 中期规划（下月）
1. 部署到生产环境（Vercel/Firebase）
2. 实施多设备数据同步方案
3. 根据用户反馈迭代移动端优化

---

**下一步**：确认本方案后，可开始实施第 2.1 节修改（`package.json` 和 `src/ai/server.ts`），然后测试手机访问。

如需调整或对某部分有疑问，请告知。