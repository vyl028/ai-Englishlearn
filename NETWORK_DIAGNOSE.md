# LexiCapture 手机访问诊断指南

## 问题现象
手机无法访问 http://192.168.168.1:9002

## 检查清单

### 1. 确认手机和电脑连接同一个WiFi
- 检查手机和电脑的WiFi名称是否相同
- 如果不确定，尝试手机开热点给电脑连接

### 2. 确认IP地址正确
在电脑上打开命令提示符，运行：
```cmd
ipconfig
```
找到你的WiFi适配器的IPv4地址（通常是192.168.x.x）

如果IP不是 `192.168.168.1`，需要更新以下文件：
- `src/lib/api-client.ts` - 修改API_BASE_URL
- `server/src/index.ts` - 修改CORS origin
- `next.config.ts` - 修改allowedDevOrigins

### 3. 测试网络连通性
在手机上安装 "网络百宝箱" 或类似APP：
1. 尝试ping电脑IP：192.168.168.1
2. 尝试访问 http://192.168.168.1:4000/health

### 4. 检查防火墙
确保Windows防火墙允许以下端口：
- 9002 (前端)
- 4000 (后端)

以管理员身份运行PowerShell：
```powershell
# 查看规则
netsh advfirewall firewall show rule name="Next.js Dev (9002)"
netsh advfirewall firewall show rule name="LexiCapture AI (4000)"

# 如果规则不存在，添加规则
netsh advfirewall firewall add rule name="Next.js Dev (9002)" dir=in action=allow protocol=TCP localport=9002
netsh advfirewall firewall add rule name="LexiCapture AI (4000)" dir=in action=allow protocol=TCP localport=4000
```

### 5. 确认服务运行状态
在浏览器访问：
- http://localhost:9002 (电脑本机)
- http://192.168.168.1:4000/health (后端健康检查)

## 常见解决方案

### 方案A：关闭Windows防火墙（临时测试）
以管理员身份运行：
```cmd
netsh advfirewall set allprofiles state off
```
测试完成后记得开启：
```cmd
netsh advfirewall set allprofiles state on
```

### 方案B：使用手机热点
1. 手机开启个人热点
2. 电脑连接手机热点
3. 查看电脑新的IP地址（ipconfig）
4. 更新配置文件中的IP地址
5. 重启服务

### 方案C：检查路由器AP隔离
有些路由器开启 "AP隔离" 或 "客户端隔离"，会阻止设备间通信。
登录路由器管理页面关闭此功能。

## 验证步骤

1. 电脑浏览器访问 http://localhost:9002 - 应该正常
2. 电脑浏览器访问 http://192.168.168.1:9002 - 应该正常
3. 手机浏览器访问 http://192.168.168.1:4000/health - 应该返回JSON
4. 手机浏览器访问 http://192.168.168.1:9002 - 应该显示登录页

如果第3步失败，说明手机和电脑网络不通。
如果第3步成功但第4步失败，可能是前端配置问题。
