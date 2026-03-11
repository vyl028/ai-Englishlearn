"use client";

import * as React from "react";
import { ClipboardCopy, Loader2, RotateCcw, Upload } from "lucide-react";

import { reviewEssayAction, extractTextFromFileAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { ReviewEssayOutput, EssayIssueCategory, EssayIssueSeverity } from "@/lib/types";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function categoryLabel(category: EssayIssueCategory) {
  switch (category) {
    case "grammar":
      return "语法";
    case "spelling":
      return "拼写";
    case "tense":
      return "时态";
    case "logic":
      return "逻辑";
    case "coherence":
      return "衔接";
    case "task_response":
      return "任务回应";
    case "word_choice":
      return "用词";
    case "punctuation":
      return "标点";
    case "style":
      return "风格";
    case "other":
    default:
      return "其他";
  }
}

function severityLabel(severity: EssayIssueSeverity) {
  switch (severity) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
    default:
      return "低";
  }
}

function formatBand(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(1).replace(/\.0$/, ".0");
}

export function EssayReviewView() {
  const { toast } = useToast();
  const [taskPrompt, setTaskPrompt] = React.useState("");
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<ReviewEssayOutput | null>(null);
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [isParsingFile, setIsParsingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setTaskPrompt("");
    setText("");
    setResult(null);
  };

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsParsingFile(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await extractTextFromFileAction(formData);
      if (res.success && res.data?.text) {
        setText(res.data.text);

        const warningText = (res.data.warnings || []).filter(Boolean).join("；");
        toast({
          title: "已读取文件",
          description: warningText ? warningText : `已读取：${res.data.filename || file.name}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "读取失败",
          description: res.error || "无法读取该文件，请重试。",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "读取出错",
        description: e?.message || "读取文件时发生未知错误。",
      });
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleReview = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "请输入作文", description: "请粘贴或上传英文作文正文后再开始批改。" });
      return;
    }

    if (trimmed.length > 12000) {
      toast({
        variant: "destructive",
        title: "文本过长",
        description: "当前正文过长（> 12000 字符）。建议删减或分段提交。",
      });
      return;
    }

    setIsReviewing(true);
    setResult(null);
    try {
      const res = await reviewEssayAction({ text: trimmed, taskPrompt: taskPrompt.trim() || undefined });
      if (res.success && res.data) {
        setResult(res.data);
        toast({ title: "批改完成", description: "已生成评分、问题清单与优化建议。" });
      } else {
        toast({
          variant: "destructive",
          title: "批改失败",
          description: res.error || "作文批改失败，请稍后重试。",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "批改出错",
        description: e?.message || "作文批改时发生未知错误。",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const copyRevised = async () => {
    if (!result?.revisedTextEn) return;
    try {
      await navigator.clipboard.writeText(result.revisedTextEn);
      toast({ title: "已复制", description: "优化后的作文已复制到剪贴板。" });
    } catch {
      toast({ variant: "destructive", title: "复制失败", description: "浏览器可能不允许复制，请手动选择复制。" });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>作文批改（雅思写作任务 2）</CardTitle>
        <CardDescription>
          支持粘贴或上传作文（.txt / .md / .docx / .pdf / 图片 OCR），AI 将给出评分、错误点、优化建议与示范句，并输出修改前后对照。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            作文内容会发送到大语言模型进行分析，请勿上传包含隐私或敏感信息的内容。PDF 若为扫描版可能无法正确提取文本；图片会进行 OCR 识别，建议检查识别结果并按需手动修正。
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="text-sm font-medium">上传作文文件/图片</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleFilePick} disabled={isParsingFile || isReviewing} className="w-full sm:w-auto">
              {isParsingFile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在读取...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  选择文件
                </>
              )}
            </Button>
            <Input
              readOnly
              value={text ? `已载入正文（${text.length} 字符）` : "未载入"}
              className="text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">题目（可选）</div>
          <Textarea
            value={taskPrompt}
            onChange={(e) => {
              setTaskPrompt(e.target.value);
              setResult(null);
            }}
            placeholder="粘贴写作题目（英文）。留空则按通用雅思写作任务 2 要求评估。"
            className="min-h-[80px]"
            disabled={isReviewing || isParsingFile}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">作文正文（英文）</div>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            placeholder="在此粘贴英文作文正文..."
            className="min-h-[220px]"
            disabled={isReviewing || isParsingFile}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" onClick={handleReview} disabled={isReviewing || isParsingFile} className="w-full sm:w-auto">
            {isReviewing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在批改...
              </>
            ) : (
              "开始批改"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={resetAll} disabled={isReviewing || isParsingFile} className="w-full sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            清空
          </Button>
        </div>

        {result && (
          <Tabs defaultValue="score" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="score" className="shrink-0">评分</TabsTrigger>
              <TabsTrigger value="issues" className="shrink-0">问题</TabsTrigger>
              <TabsTrigger value="revised" className="shrink-0">优化后</TabsTrigger>
              <TabsTrigger value="compare" className="shrink-0">对照</TabsTrigger>
            </TabsList>

            <TabsContent value="score" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">总分</CardTitle>
                    <CardDescription>雅思写作任务 2（仅供参考）</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="text-3xl font-bold">{formatBand(result.overallBand)}</div>
                    {result.level?.cefr && (
                      <div className="text-sm text-muted-foreground mt-1">
                        分级：{result.level.cefr}
                        {result.level.commentZh ? `（${result.level.commentZh}）` : ""}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">分项</CardTitle>
                    <CardDescription>TR / CC / LR / GRA</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>任务回应（TR）</span>
                      <span className="font-medium">{formatBand(result.scores.taskResponse)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>连贯与衔接（CC）</span>
                      <span className="font-medium">{formatBand(result.scores.coherenceCohesion)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>词汇资源（LR）</span>
                      <span className="font-medium">{formatBand(result.scores.lexicalResource)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>语法范围与准确性（GRA）</span>
                      <span className="font-medium">{formatBand(result.scores.grammaticalRangeAccuracy)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">总体反馈</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{result.summaryZh}</div>

                  {(result.strengthsZh?.length || 0) > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">优点</div>
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        {result.strengthsZh!.slice(0, 8).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(result.weaknessesZh?.length || 0) > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">可改进点</div>
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        {result.weaknessesZh!.slice(0, 8).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="issues" className="space-y-3 mt-4">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">问题清单与建议</CardTitle>
                  <CardDescription>包含语法/拼写/时态/逻辑等；可直接套用示范句。</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  {result.issues?.length ? (
                    <div className="space-y-3">
                      {result.issues.slice(0, 24).map((it, idx) => (
                        <div key={idx} className="rounded-md border p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{categoryLabel(it.category)}</Badge>
                            {it.severity && <Badge variant="outline">严重度：{severityLabel(it.severity)}</Badge>}
                          </div>
                          {it.original && (
                            <div className="text-sm">
                              <div className="font-medium">原句/片段</div>
                              <div className="text-muted-foreground whitespace-pre-wrap">{it.original}</div>
                            </div>
                          )}
                          <div className="text-sm">
                            <div className="font-medium">建议改写</div>
                            <div className="whitespace-pre-wrap">{it.suggestion}</div>
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{it.explanationZh}</div>
                          {(it.exampleEn || it.exampleZh) && (
                            <div className="text-sm space-y-1">
                              <div className="font-medium">示范句</div>
                              {it.exampleEn && <div className="whitespace-pre-wrap">{it.exampleEn}</div>}
                              {it.exampleZh && <div className="text-muted-foreground whitespace-pre-wrap">{it.exampleZh}</div>}
                            </div>
                          )}
                        </div>
                      ))}
                      {result.issues.length > 24 && (
                        <div className="text-sm text-muted-foreground">
                          已显示前 24 条问题（共 {result.issues.length} 条）。
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">模型未返回问题清单。</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="revised" className="space-y-3 mt-4">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">优化后的作文（英文）</CardTitle>
                  <CardDescription>保留原意并提升雅思写作任务 2 的表达、结构与准确性。</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={copyRevised} className="w-full sm:w-auto">
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                      复制优化版
                    </Button>
                  </div>
                  <Textarea readOnly value={result.revisedTextEn} className="min-h-[260px]" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compare" className="space-y-3 mt-4">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">修改前后对照</CardTitle>
                  <CardDescription>原文 vs 优化文 + 关键改写对照。</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">修改前</div>
                      <Textarea readOnly value={text.trim()} className="min-h-[260px]" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">修改后</div>
                      <Textarea readOnly value={result.revisedTextEn} className="min-h-[260px]" />
                    </div>
                  </div>

                  {(result.beforeAfter?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">关键改写对照</div>
                      <div className="space-y-2">
                        {result.beforeAfter!.slice(0, 12).map((p, i) => (
                          <div key={i} className="rounded-md border p-3 space-y-2">
                            <div className="text-sm">
                              <div className="font-medium">Before</div>
                              <div className="text-muted-foreground whitespace-pre-wrap">{p.before}</div>
                            </div>
                            <div className="text-sm">
                              <div className="font-medium">After</div>
                              <div className="whitespace-pre-wrap">{p.after}</div>
                            </div>
                            {p.reasonZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.reasonZh}</div>}
                          </div>
                        ))}
                        {result.beforeAfter!.length > 12 && (
                          <div className="text-sm text-muted-foreground">
                            已显示前 12 条关键改写（共 {result.beforeAfter!.length} 条）。
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
