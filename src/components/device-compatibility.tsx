"use client";

import React, { useState, useEffect } from "react";
import { Camera, Mic, AlertTriangle, CheckCircle, XCircle, Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDeviceCapabilities,
  useCameraPermission,
  useMicrophonePermission,
  useLowEndDevice,
} from "@/hooks/use-device-detection";

interface FeatureRequirement {
  id: string;
  name: string;
  icon: React.ReactNode;
  check: () => boolean;
  description: string;
  fallback?: string;
}

/**
 * 设备兼容性检查组件
 * 检查并展示设备能力
 */
export function DeviceCompatibilityCheck({
  children,
  requiredFeatures = ["camera"],
  className,
}: {
  children: React.ReactNode;
  requiredFeatures?: string[];
  className?: string;
}) {
  const capabilities = useDeviceCapabilities();
  const [isOpen, setIsOpen] = useState(false);
  const [missingFeatures, setMissingFeatures] = useState<FeatureRequirement[]>([]);

  const features: FeatureRequirement[] = [
    {
      id: "camera",
      name: "摄像头",
      icon: <Camera className="h-5 w-5" />,
      check: () => capabilities.camera,
      description: "用于拍照识别单词",
      fallback: "您可以使用手动输入或图片上传功能",
    },
    {
      id: "microphone",
      name: "麦克风",
      icon: <Mic className="h-5 w-5" />,
      check: () => capabilities.microphone,
      description: "用于语音朗读和跟读",
      fallback: "您可以使用文本输入功能",
    },
    {
      id: "touch",
      name: "触摸屏",
      icon: <Smartphone className="h-5 w-5" />,
      check: () => capabilities.touch,
      description: "用于触摸交互",
      fallback: "请使用鼠标和键盘操作",
    },
  ];

  useEffect(() => {
    const missing = features.filter(
      (f) => requiredFeatures.includes(f.id) && !f.check()
    );
    setMissingFeatures(missing);
    if (missing.length > 0) {
      setIsOpen(true);
    }
  }, [capabilities, requiredFeatures]);

  if (missingFeatures.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              设备功能受限
            </DialogTitle>
            <DialogDescription>
              您的设备缺少以下功能，可能影响使用体验：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {missingFeatures.map((feature) => (
              <div
                key={feature.id}
                className="flex items-start gap-3 p-3 bg-muted rounded-lg"
              >
                <div className="text-muted-foreground">{feature.icon}</div>
                <div className="flex-1">
                  <p className="font-medium">{feature.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                  {feature.fallback && (
                    <p className="text-sm text-amber-600 mt-1">
                      💡 {feature.fallback}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setIsOpen(false)}>我知道了</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * 摄像头权限提示
 */
export function CameraPermissionPrompt({
  onPermissionGranted,
  className,
}: {
  onPermissionGranted?: () => void;
  className?: string;
}) {
  const { permission, isSupported, requestPermission } = useCameraPermission();
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isSupported) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-6 bg-muted rounded-lg",
          className
        )}
      >
        <XCircle className="h-12 w-12 text-destructive mb-3" />
        <p className="text-muted-foreground">您的设备不支持摄像头功能</p>
        <p className="text-sm text-muted-foreground mt-1">
          请使用手动输入或图片上传
        </p>
      </div>
    );
  }

  if (permission === "granted") {
    onPermissionGranted?.();
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 bg-muted rounded-lg",
        className
      )}
    >
      <Camera className="h-12 w-12 text-primary mb-3" />
      <p className="font-medium">需要摄像头权限</p>
      <p className="text-sm text-muted-foreground mt-1 text-center">
        请允许访问摄像头以使用拍照识别功能
      </p>
      {permission === "denied" ? (
        <div className="mt-4 text-center">
          <p className="text-sm text-destructive">
            摄像头权限已被拒绝
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            请在浏览器设置中手动开启权限
          </p>
        </div>
      ) : (
        <Button
          className="mt-4"
          disabled={isRequesting}
          onClick={async () => {
            setIsRequesting(true);
            await requestPermission();
            setIsRequesting(false);
          }}
        >
          {isRequesting ? "请求中..." : "允许访问"}
        </Button>
      )}
    </div>
  );
}

/**
 * 低端设备提示
 */
export function LowEndDeviceWarning({ className }: { className?: string }) {
  const isLowEnd = useLowEndDevice();
  const [dismissed, setDismissed] = useState(false);

  if (!isLowEnd || dismissed) return null;

  return (
    <div
      className={cn(
        "bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">
            设备性能提示
          </p>
          <p className="text-xs text-amber-700 mt-1">
            检测到您的设备性能较低，已自动降低动画效果以提升流畅度。
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-100 shrink-0"
          onClick={() => setDismissed(true)}
        >
          知道了
        </Button>
      </div>
    </div>
  );
}

/**
 * 浏览器兼容性提示
 */
export function BrowserCompatibilityWarning({ className }: { className?: string }) {
  const capabilities = useDeviceCapabilities();
  const [dismissed, setDismissed] = useState(false);

  // 只针对 Safari 和 IE 显示提示
  const needsWarning =
    capabilities.browser.isSafari ||
    capabilities.browser.name === "unknown";

  if (!needsWarning || dismissed) return null;

  return (
    <div
      className={cn(
        "bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Monitor className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">
            浏览器兼容性提示
          </p>
          <p className="text-xs text-blue-700 mt-1">
            您正在使用 {capabilities.browser.name}{" "}
            {capabilities.browser.version}。
            为了获得最佳体验，建议使用最新版 Chrome 或 Edge 浏览器。
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-blue-700 hover:text-blue-800 hover:bg-blue-100 shrink-0"
          onClick={() => setDismissed(true)}
        >
          知道了
        </Button>
      </div>
    </div>
  );
}

/**
 * 功能降级包装器
 * 根据设备能力自动降级功能
 */
export function FeatureFallback({
  feature,
  fallback,
  children,
}: {
  feature: "camera" | "microphone" | "speech" | "touch";
  fallback: React.ReactNode;
  children: React.ReactNode;
}) {
  const capabilities = useDeviceCapabilities();

  const isSupported = {
    camera: capabilities.camera,
    microphone: capabilities.microphone,
    speech: capabilities.speechRecognition,
    touch: true, // 触摸总是有替代方案
  }[feature];

  if (!isSupported) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
