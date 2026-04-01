# 响应式断点使用规范

> 本文档定义 LexiCapture 项目的响应式设计断点标准

## 断点定义

本项目使用 Tailwind CSS 默认断点：

| 断点 | 宽度 | 用途 |
|------|------|------|
| (默认) | < 640px | 移动端（基础样式） |
| `sm:` | ≥ 640px | 小屏手机横屏/大手机 |
| `md:` | ≥ 768px | 平板/大屏手机 |
| `lg:` | ≥ 1024px | 小桌面/笔记本 |
| `xl:` | ≥ 1280px | 桌面显示器 |

## 设计原则：移动优先

所有样式默认针对移动端，然后通过断点逐步增强：

```tsx
// 正确示例
<div className="flex flex-col sm:flex-row gap-2">
  {/* 移动端垂直排列，sm以上水平排列 */}
</div>

// 正确示例
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {/* 移动端单列，sm以上双列 */}
</div>

// 正确示例
<div className="px-4 md:px-6 py-3 md:py-4">
  {/* 移动端小内边距，md以上大内边距 */}
</div>
```

## 常见模式

### 1. 布局方向
```tsx
// Flex布局切换
className="flex flex-col sm:flex-row"

// Grid列数切换
className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
```

### 2. 元素尺寸
```tsx
// 宽度调整
className="w-full sm:w-auto"

// 最大宽度限制
className="max-w-full sm:max-w-[560px]"

// 字号调整
className="text-sm sm:text-base"
className="text-xl sm:text-2xl"
```

### 3. 间距
```tsx
// 内边距
className="p-4 sm:p-6"
className="px-4 md:px-6 py-3 md:py-4"

// 外边距
className="-mx-4 md:-mx-6"
```

### 4. 显示/隐藏
```tsx
// 小屏隐藏，大屏显示
className="hidden sm:block"

// 小屏显示，大屏隐藏
className="sm:hidden"
```

## 组件级约定

### Card 组件
- 内边距：`p-4 sm:p-6`
- 标题字号：`text-xl sm:text-2xl`

### Dialog/Sheet
- 小屏全宽，大屏限制最大宽度
- 关闭按钮始终 44×44px

### 表单布局
- 移动端：垂直堆叠（flex-col）
- sm以上：可水平排列（flex-row）

### 导航
- 侧边栏：移动端抽屉，桌面常驻
- 进度条：lg以下隐藏

## 断点选择指南

| 场景 | 推荐断点 | 说明 |
|------|----------|------|
| 两列布局 | `sm:` | 640px以上有足够空间 |
| 三列布局 | `md:` 或 `lg:` | 需要更多宽度 |
| 增加内边距 | `md:` | 平板以上有更多空间 |
| 显示/隐藏元素 | `sm:` 或 `md:` | 根据内容复杂度 |
| 字号调整 | `sm:` | 小屏使用较小字号 |

## 审核结果

### 2026-04-01 审核
- **总断点使用**: 117处
- **主要断点**: `sm:` (最常见), `md:` (中等), `lg:` (较少)
- **整体评分**: ✅ 符合移动优先原则

### 修复项
1. ✅ `article-reading-view.tsx`: 统一 `md:grid-cols-2` → `sm:grid-cols-2`

### 保留的例外
- `essay-review-view.tsx:1038`: `md:grid-cols-2` 保留，因为对比区域需要足够宽度
- `page.tsx:1008`: `lg:inline-flex` 保留，等级进度条在中等屏幕隐藏

## 验证方式

```bash
# 统计断点使用
npm run typecheck

# Chrome DevTools 测试
# 1. 打开 DevTools
# 2. 切换设备模拟（iPhone SE 375px）
# 3. 检查布局是否正常
# 4. 逐步增宽测试断点切换
```
