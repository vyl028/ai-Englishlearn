"use client";

import { useEffect, useState } from "react";

export function PwaClient() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort only.
    });
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-3 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-md border bg-background/95 px-3 py-2 text-sm shadow backdrop-blur">
      当前处于离线状态：已加载内容仍可查看，AI 生成等功能暂不可用。
    </div>
  );
}

