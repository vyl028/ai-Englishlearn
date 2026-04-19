"use client";

import * as React from "react";
import { ArrowLeft, Clock, Trash2, Trophy, FileText, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { practiceApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PracticeRecordListItem, PracticeRecordDetail } from "@/lib/api-client";
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

interface PracticeHistoryViewProps {
  onBack?: () => void;
  onViewDetail?: (detail: PracticeRecordDetail) => void;
}

function formatDateTime(isoString: string) {
  const d = new Date(isoString);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PracticeHistoryView({ onBack, onViewDetail }: PracticeHistoryViewProps) {
  const [records, setRecords] = React.useState<PracticeRecordListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<PracticeRecordDetail | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await practiceApi.list({ limit: 50 });
      if (res.success && res.data) {
        setRecords(res.data.records);
      }
    } catch (e) {
      console.error("Failed to load practice records:", e);
      toast({ variant: "destructive", title: "加载失败", description: "无法获取练习历史。" });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadRecords();
  }, []);

  const handleViewDetail = async (id: string) => {
    try {
      const res = await practiceApi.get(id);
      if (res.success && res.data) {
        setDetail(res.data);
        onViewDetail?.(res.data);
      }
    } catch (e) {
      console.error("Failed to load practice detail:", e);
      toast({ variant: "destructive", title: "加载失败", description: "无法获取练习详情。" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await practiceApi.delete(deleteId);
      setRecords((prev) => prev.filter((r) => r.id !== deleteId));
      toast({ title: "已删除", description: "练习记录已删除。" });
    } catch (e) {
      toast({ variant: "destructive", title: "删除失败", description: "请稍后重试。" });
    } finally {
      setDeleteId(null);
    }
  };

  if (detail) {
    return (
      <PracticeDetailView detail={detail} onBack={() => setDetail(null)} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h2 className="text-lg font-semibold">练习历史</h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      )}

      {!loading && records.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>暂无练习记录</p>
            <p className="text-sm">去单词本生成一套练习吧！</p>
          </CardContent>
        </Card>
      )}

      {!loading && records.length > 0 && (
        <div className="space-y-3">
          {records.map((record) => (
            <Card
              key={record.id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-accent/50",
                !record.isSubmitted && "border-dashed"
              )}
              onClick={() => handleViewDetail(record.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="font-medium">
                        {record.questionCount} 道题
                        {record.isSubmitted && (
                          <Badge variant="secondary" className="ml-2">
                            <Trophy className="h-3 w-3 mr-1 inline" />
                            {record.correctCount}/{record.totalCount}
                          </Badge>
                        )}
                        {!record.isSubmitted && (
                          <Badge variant="outline" className="ml-2">未完成</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(record.createdAt)}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(record.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，是否继续？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PracticeDetailView({ detail, onBack }: { detail: PracticeRecordDetail; onBack: () => void }) {
  const questions = React.useMemo(() => {
    try {
      return JSON.parse(detail.questionsJson) as any[];
    } catch {
      return [];
    }
  }, [detail.questionsJson]);

  const answerMap = React.useMemo(() => {
    const map = new Map<number, typeof detail.answers[0]>();
    for (const a of detail.answers) {
      map.set(a.questionIndex, a);
    }
    return map;
  }, [detail.answers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">练习详情</h2>
          <p className="text-xs text-muted-foreground">
            {detail.isSubmitted
              ? `得分：${detail.correctCount}/${detail.totalCount}`
              : "未完成"}
            {" · "}
            {new Date(detail.createdAt).toLocaleString("zh-CN")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q: any, idx: number) => {
          const ans = answerMap.get(idx);
          const isCorrect = ans?.isCorrect ?? false;

          return (
            <Card key={idx} className={cn(isCorrect ? "border-green-200" : "border-red-200")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    第 {idx + 1} 题 · {q.word}
                  </CardTitle>
                  {ans && (
                    <Badge variant={isCorrect ? "default" : "destructive"}>
                      {isCorrect ? "正确" : "错误"}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">{q.promptEn}</CardDescription>
              </CardHeader>
              {ans && (
                <CardContent className="pt-0 text-sm space-y-1">
                  <div className="text-muted-foreground">
                    你的答案：<span className={cn("font-medium", isCorrect ? "text-green-600" : "text-red-600")}>
                      {ans.userAnswer || "-"}
                    </span>
                  </div>
                  {!isCorrect && (
                    <div className="text-muted-foreground">
                      正确答案：<span className="font-medium text-green-600">{ans.correctAnswer || "-"}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground pt-1 border-t mt-2">{q.analysisZh}</div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
