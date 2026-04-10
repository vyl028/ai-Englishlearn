"use client";

import * as React from "react";
import { Download, FileWarning, HardDrive, LogOut, Upload, Trash2, Wrench, User } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  applyBackup,
  createBackup,
  getLocalStorageUsageEstimate,
  type LexiCaptureBackupV1,
  normalizeBackupPayload,
  scanKnownStorageIssues,
  tryRepairJsonText,
  tryRepairKnownStorageIssues,
  type BackupScope,
  type ImportStrategy,
  BACKUP_SCHEMA_V1,
} from "@/lib/backup";

type SettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResetLocalData: () => void;
  busy?: boolean;
};

export function SettingsSheet({ open, onOpenChange, onResetLocalData, busy = false }: SettingsSheetProps) {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [confirmResetStep1Open, setConfirmResetStep1Open] = React.useState(false);
  const [confirmResetStep2Open, setConfirmResetStep2Open] = React.useState(false);

  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportScope, setExportScope] = React.useState<BackupScope>("full");
  const [exportWarnings, setExportWarnings] = React.useState<string[]>([]);

  const [importOpen, setImportOpen] = React.useState(false);
  const [importStrategy, setImportStrategy] = React.useState<ImportStrategy>("overwrite");
  const [importFileName, setImportFileName] = React.useState<string | null>(null);
  const [importRawText, setImportRawText] = React.useState<string | null>(null);
  const [importParseError, setImportParseError] = React.useState<string | null>(null);
  const [importRepairHint, setImportRepairHint] = React.useState<string | null>(null);
  const [importWarnings, setImportWarnings] = React.useState<string[]>([]);
  const [importBackup, setImportBackup] = React.useState<LexiCaptureBackupV1 | null>(null);

  const [repairOpen, setRepairOpen] = React.useState(false);
  const [storageIssues, setStorageIssues] = React.useState<Array<{ key: string; reason: string; raw: string }>>([]);

  const [usage, setUsage] = React.useState(() => getLocalStorageUsageEstimate());

  React.useEffect(() => {
    if (!open) return;
    setUsage(getLocalStorageUsageEstimate());
  }, [open]);

  const quotaBytes = 5 * 1024 * 1024;
  const usagePercent = Math.min(100, Math.round((usage.totalBytes / quotaBytes) * 100));
  const usageLevel: "ok" | "warn" | "danger" = usagePercent >= 90 ? "danger" : usagePercent >= 75 ? "warn" : "ok";

  const formatBytes = (bytes: number) => {
    const b = Math.max(0, Math.floor(bytes));
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  const downloadTextFile = (params: { filename: string; content: string; mime: string }) => {
    const blob = new Blob([params.content], { type: params.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = params.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const downloadJsonFile = (params: { filename: string; json: unknown }) => {
    const content = JSON.stringify(params.json, null, 2);
    downloadTextFile({ filename: params.filename, content, mime: "application/json;charset=utf-8" });
  };

  const refreshStorageStatus = () => {
    setUsage(getLocalStorageUsageEstimate());
    setStorageIssues(scanKnownStorageIssues());
  };

  const startExport = (scope: BackupScope) => {
    const { backup, warnings } = createBackup(scope);
    setExportWarnings(warnings);

    const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
    const filename =
      scope === "full"
        ? `lexi-backup-${safeTs}.json`
        : scope === "words"
          ? `lexi-words-${safeTs}.json`
          : `lexi-growth-${safeTs}.json`;

    downloadJsonFile({ filename, json: backup });
    toast({
      title: "已导出备份",
      description: warnings.length > 0 ? `已导出，但有 ${warnings.length} 条提示（可在弹窗中查看）。` : "已生成并下载 JSON 文件。",
    });
  };

  const resetImportState = () => {
    setImportFileName(null);
    setImportRawText(null);
    setImportParseError(null);
    setImportRepairHint(null);
    setImportWarnings([]);
    setImportBackup(null);
    setImportStrategy("overwrite");
  };

  const parseImportText = (text: string) => {
    setImportRawText(text);
    setImportParseError(null);
    setImportRepairHint(null);
    setImportWarnings([]);
    setImportBackup(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error: any) {
      setImportParseError(error?.message || "JSON 解析失败");
      setImportRepairHint("提示：可尝试“修复 JSON”（截取可能的 JSON 主体）后再解析。");
      return;
    }

    const normalized = normalizeBackupPayload(parsed);
    if (!normalized.ok) {
      setImportParseError(normalized.error);
      return;
    }

    setImportWarnings(normalized.warnings);
    setImportBackup(normalized.backup);
  };

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
              <CardDescription>导出/导入本机 localStorage 数据（JSON）。建议在清空/换设备前先导出。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span>本机数据占用（估算）</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(usage.totalBytes)} / 5.00 MB（约 {usagePercent}%）
                  </div>
                </div>
                <Progress value={usagePercent} className={usageLevel === "danger" ? "bg-destructive/20" : undefined} />
                <div className="text-xs text-muted-foreground">
                  注：不同浏览器配额不同。接近上限时建议先导出备份，再清理历史或分批导入。
                </div>
                {usagePercent >= 75 ? (
                  <div className={usageLevel === "danger" ? "text-xs text-destructive" : "text-xs text-amber-600 dark:text-amber-500"}>
                    {usageLevel === "danger" ? "已接近容量上限，建议立即导出备份并清理数据。" : "容量偏高，建议尽快导出备份。"}
                  </div>
                ) : null}
              </div>

              {usage.topKeys.length > 0 ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>占用较大的 key（Top {usage.topKeys.length}）</span>
                  </div>
                  <ul className="space-y-1">
                    {usage.topKeys.map((k) => (
                      <li key={k.key} className="flex items-center justify-between gap-3">
                        <span className="truncate">{k.key}</span>
                        <span className="shrink-0">{formatBytes(k.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setExportScope("full");
                    setExportWarnings([]);
                    setExportOpen(true);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出备份
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => {
                    resetImportState();
                    setImportOpen(true);
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  导入备份
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    refreshStorageStatus();
                    setRepairOpen(true);
                  }}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  数据修复
                </Button>
              </div>

              {busy && <div className="text-xs text-muted-foreground">AI 请求进行中时不可导入或清空数据。</div>}
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
                  onClick={() => setConfirmResetStep1Open(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  清空本机数据
                </Button>
                {busy && <div className="text-xs text-muted-foreground mt-2">AI 请求进行中时不可清空。</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">账号</CardTitle>
              <CardDescription>管理当前登录账号。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    当前登录：<span className="font-medium text-foreground">{user.username}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={logout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">未登录</div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>

      <AlertDialog open={confirmResetStep1Open} onOpenChange={setConfirmResetStep1Open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空本机数据？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。建议清空前先完成备份功能（清单 80/81），或确认你不再需要当前数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button type="button" variant="secondary" onClick={() => startExport("full")}>
              先导出备份
            </Button>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmResetStep1Open(false);
                setConfirmResetStep2Open(true);
              }}
            >
              继续清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmResetStep2Open} onOpenChange={setConfirmResetStep2Open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>再次确认：真的要清空吗？</AlertDialogTitle>
            <AlertDialogDescription>
              清空后将移除本机所有学习数据与设置，且无法撤销。若你还没有备份，建议先点击上一步的“先导出备份”。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onResetLocalData();
                setConfirmResetStep2Open(false);
                onOpenChange(false);
              }}
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出备份</DialogTitle>
            <DialogDescription>导出为 JSON 文件（schema：{BACKUP_SCHEMA_V1}）。</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">导出范围</div>
              <RadioGroup value={exportScope} onValueChange={(v) => setExportScope(v as BackupScope)} className="grid gap-2">
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <RadioGroupItem id="export-full" value="full" />
                  <Label htmlFor="export-full" className="cursor-pointer">全量（推荐）</Label>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <RadioGroupItem id="export-words" value="words" />
                  <Label htmlFor="export-words" className="cursor-pointer">仅单词（单词本/分组）</Label>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <RadioGroupItem id="export-growth" value="growth" />
                  <Label htmlFor="export-growth" className="cursor-pointer">仅成长（等级/曲线/时间线/听说训练）</Label>
                </div>
              </RadioGroup>
            </div>

            {exportWarnings.length > 0 ? (
              <div className="rounded-md border p-3 bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileWarning className="h-4 w-4 text-muted-foreground" />
                  <span>导出提示（{exportWarnings.length}）</span>
                </div>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  {exportWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExportOpen(false)}>取消</Button>
            <Button
              type="button"
              onClick={() => {
                startExport(exportScope);
                refreshStorageStatus();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(next) => {
          setImportOpen(next);
          if (!next) resetImportState();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导入备份</DialogTitle>
            <DialogDescription>选择备份 JSON 文件，校验后导入（导入后将刷新页面）。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>备份文件</Label>
              <Input
                type="file"
                accept="application/json"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  setImportFileName(file.name);
                  try {
                    const text = await file.text();
                    parseImportText(text);
                  } catch (error: any) {
                    setImportParseError(error?.message || "读取文件失败");
                  }
                }}
              />
              {importFileName ? <div className="text-xs text-muted-foreground">已选择：{importFileName}</div> : null}
            </div>

            {importParseError ? (
              <div className="rounded-md border p-3 bg-muted/20 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileWarning className="h-4 w-4 text-muted-foreground" />
                  <span>解析失败</span>
                </div>
                <div className="text-xs text-muted-foreground">{importParseError}</div>
                {importRepairHint ? <div className="text-xs text-muted-foreground">{importRepairHint}</div> : null}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!importRawText}
                    onClick={() => {
                      if (!importRawText) return;
                      const repaired = tryRepairJsonText(importRawText);
                      if (!repaired) {
                        toast({ variant: "destructive", title: "修复失败", description: "未能从文本中提取有效 JSON。" });
                        return;
                      }
                      parseImportText(repaired);
                      toast({ title: "已尝试修复", description: "已用修复后的 JSON 重新解析。" });
                    }}
                  >
                    修复 JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!importRawText}
                    onClick={() => {
                      if (!importRawText) return;
                      const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
                      downloadTextFile({
                        filename: `lexi-import-raw-${safeTs}.txt`,
                        content: importRawText,
                        mime: "text/plain;charset=utf-8",
                      });
                      toast({ title: "已导出原始文本", description: "已下载 .txt 文件。" });
                    }}
                  >
                    导出原始文本
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setImportOpen(false);
                      setConfirmResetStep1Open(true);
                    }}
                  >
                    重置全部数据
                  </Button>
                </div>
                {importRawText ? (
                  <Textarea readOnly value={importRawText.slice(0, 2000)} className="mt-2 h-32 text-xs" />
                ) : null}
              </div>
            ) : null}

            {importBackup ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-sm font-medium">备份摘要</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>范围：{importBackup.scope}</div>
                  <div>时间：{importBackup.exportedAt}</div>
                  {Array.isArray(importBackup.data?.words) ? <div>单词：{importBackup.data.words.length}</div> : null}
                  {Array.isArray(importBackup.data?.groups) ? <div>分组：{importBackup.data.groups.length}</div> : null}
                  {importBackup.data?.gamification ? <div>成长：已包含</div> : null}
                </div>
                {importWarnings.length > 0 ? (
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                    {importWarnings.map((w: string, idx: number) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium">导入策略</div>
              <RadioGroup value={importStrategy} onValueChange={(v) => setImportStrategy(v as ImportStrategy)} className="grid gap-2">
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <RadioGroupItem id="import-overwrite" value="overwrite" />
                  <Label htmlFor="import-overwrite" className="cursor-pointer">覆盖导入（会先清空同范围数据）</Label>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <RadioGroupItem id="import-merge" value="merge" />
                  <Label htmlFor="import-merge" className="cursor-pointer">合并导入（尽量不覆盖现有设置）</Label>
                </div>
              </RadioGroup>
              <div className="text-xs text-muted-foreground">
                覆盖：适合“清空后恢复”。合并：适合“从另一份备份补充数据”，不会主动替换你当前的主题/模块偏好等设置。
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
            <Button
              type="button"
              disabled={busy || !importBackup}
              onClick={() => {
                if (!importBackup) return;
                const result = applyBackup({ backup: importBackup, strategy: importStrategy });
                const desc = result.writtenKeys.length > 0 ? `已写入 ${result.writtenKeys.length} 个 key，页面将刷新以生效。` : "未写入任何 key。";
                toast({ title: "导入完成", description: desc });
                window.setTimeout(() => window.location.reload(), 350);
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              导入并刷新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={repairOpen}
        onOpenChange={(next) => {
          setRepairOpen(next);
          if (next) refreshStorageStatus();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>数据修复</DialogTitle>
            <DialogDescription>扫描本机存储是否损坏，支持尝试修复/导出原始文本/重置。</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileWarning className="h-4 w-4 text-muted-foreground" />
                  <span>扫描结果</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={refreshStorageStatus}>
                  重新扫描
                </Button>
              </div>
              {storageIssues.length === 0 ? (
                <div className="text-sm text-muted-foreground">未发现已知 key 的 JSON 损坏。</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">发现 {storageIssues.length} 个可能损坏的 key：</div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {storageIssues.map((it) => (
                      <li key={it.key} className="flex items-center justify-between gap-3">
                        <span className="truncate">{it.key}</span>
                        <span className="shrink-0">{it.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const { repairedCount, failedCount } = tryRepairKnownStorageIssues();
                  refreshStorageStatus();
                  if (repairedCount > 0) {
                    toast({ title: "已尝试修复", description: `修复成功 ${repairedCount}，失败 ${failedCount}。` });
                    return;
                  }
                  toast({ variant: "destructive", title: "修复失败", description: failedCount > 0 ? `失败 ${failedCount}。` : "没有可修复项。" });
                }}
                disabled={storageIssues.length === 0}
              >
                <Wrench className="mr-2 h-4 w-4" />
                尝试修复
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (storageIssues.length === 0) return;
                  const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
                  const content = storageIssues
                    .map((it) => `# ${it.key}\n# ${it.reason}\n${it.raw}\n`)
                    .join("\n");
                  downloadTextFile({ filename: `lexi-storage-raw-${safeTs}.txt`, content, mime: "text/plain;charset=utf-8" });
                  toast({ title: "已导出原始文本", description: "已下载 .txt 文件。" });
                }}
                disabled={storageIssues.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                导出原始文本
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setRepairOpen(false);
                  setConfirmResetStep1Open(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                重置全部数据
              </Button>
            </div>

            <div className="text-xs text-muted-foreground flex items-start gap-2">
              <FileWarning className="h-4 w-4 mt-0.5" />
              <div>
                修复策略：尝试从原始文本中截取可能的 JSON 主体并重新序列化写回。若仍失败，建议先导出原始文本再重置。
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRepairOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
