"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResetLocalData: () => void;
  busy?: boolean;
};

export function SettingsSheet({ open, onOpenChange, onResetLocalData, busy = false }: SettingsSheetProps) {
  const [confirmResetOpen, setConfirmResetOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>设置</SheetTitle>
          <SheetDescription>外观、数据与隐私相关选项。</SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 overflow-y-auto space-y-6 pr-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">外观</CardTitle>
              <CardDescription>浅色/深色模式切换。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">主题</div>
                  <div className="text-xs text-muted-foreground">点击按钮切换浅色/深色模式。</div>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">使用习惯</CardTitle>
              <CardDescription>一些提升使用效率的小设置。</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">记住上次打开的模块</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    已启用：刷新后会回到你上次停留的主要模块（清单 2）。
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">已启用</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">备份与导入</CardTitle>
              <CardDescription>后续可在此导出/导入本机数据（对应清单 80/81）。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" disabled className="w-full sm:w-auto">
                导出备份（待实现）
              </Button>
              <Button type="button" variant="outline" disabled className="w-full sm:w-auto">
                导入备份（待实现）
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI</CardTitle>
              <CardDescription>提供商与模型由服务端环境变量配置。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" disabled className="w-full sm:w-auto">
                查看当前配置（待实现）
              </Button>
              <Button type="button" variant="outline" disabled className="w-full sm:w-auto">
                切换提供商/模型（待实现）
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">隐私与数据</CardTitle>
              <CardDescription>清空本机 localStorage 数据（不可撤销）。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="text-sm text-muted-foreground">
                将清空：单词本、分组、成长数据、主题与上次打开的模块等本机数据。
              </div>
              <div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirmResetOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  清空本机数据
                </Button>
                {busy && <div className="text-xs text-muted-foreground mt-2">AI 请求进行中时不可清空。</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空本机数据？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。建议清空前先完成备份功能（清单 80/81），或确认你不再需要当前数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onResetLocalData();
                setConfirmResetOpen(false);
                onOpenChange(false);
              }}
            >
              清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
