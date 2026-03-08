"use client";

import * as React from "react";
import { Loader2, RotateCcw, Upload } from "lucide-react";

import { extractTextFromFileAction, studyArticleAction } from "@/app/actions";
import type { StudyArticleOutput } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ReadingQuestionsView } from "@/components/reading-questions-view";

export function ArticleReadingView() {
  const { toast } = useToast();

  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [includeQuestions, setIncludeQuestions] = React.useState(false);
  const [questionCount, setQuestionCount] = React.useState(6);

  const [result, setResult] = React.useState<StudyArticleOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isParsingFile, setIsParsingFile] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setTitle("");
    setText("");
    setIncludeQuestions(false);
    setQuestionCount(6);
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

  const handleAnalyze = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "请输入文章", description: "请粘贴或上传英文文章正文后再开始分析。" });
      return;
    }

    if (trimmed.length > 16000) {
      toast({
        variant: "destructive",
        title: "文章过长",
        description: "当前正文过长（> 16000 字符）。建议分段提交以避免超时或输出被截断。",
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    try {
      const res = await studyArticleAction({
        title: title.trim() || undefined,
        text: trimmed,
        includeQuestions,
        questionCount,
      });

      if (res.success && res.data) {
        setResult(res.data);
        toast({ title: "分析完成", description: "已生成结构、句法、难句拆解与词汇提取结果。" });
      } else {
        toast({
          variant: "destructive",
          title: "分析失败",
          description: res.error || "文章分析失败，请稍后重试。",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "分析出错",
        description: e?.message || "文章分析时发生未知错误。",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderStructure = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">文章结构分析</CardTitle>
          <CardDescription>段落主旨 + 段落间逻辑关系</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">全文主旨</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.structure.overallMainIdeaZh}</div>
          </div>

          {r.structure.outlineZh && (
            <div className="space-y-1">
              <div className="text-sm font-medium">结构提纲</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.structure.outlineZh}</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">段落主旨</div>
            <div className="space-y-2">
              {r.structure.paragraphs.map((p) => (
                <div key={p.index} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">第 {p.index} 段</Badge>
                    {p.roleZh && <Badge variant="outline">{p.roleZh}</Badge>}
                    {p.logicToPrevZh && <Badge variant="outline">与前文：{p.logicToPrevZh}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.mainIdeaZh}</div>
                </div>
              ))}
            </div>
          </div>

          {(r.structure.relations?.length || 0) > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">逻辑关系（补充）</div>
              <div className="space-y-2">
                {r.structure.relations!.slice(0, 12).map((rel, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    第 {rel.from} 段 → 第 {rel.to} 段：{rel.relationZh}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderSyntax = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">句法结构解析</CardTitle>
          <CardDescription>从句 / 时态 / 语态 / 修饰结构等</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.syntax.overviewZh}</div>

          {(r.syntax.highlights?.length || 0) > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">代表性句子讲解</div>
              <div className="space-y-2">
                {r.syntax.highlights!.map((h, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-2">
                    <div className="text-sm font-medium whitespace-pre-wrap">{h.sentenceEn}</div>
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      {h.pointsZh.slice(0, 6).map((pt, j) => (
                        <li key={j} className="whitespace-pre-wrap">{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderHardSentences = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">难句拆解与重组</CardTitle>
          <CardDescription>主干提取 + 从句拆解 + 简化与重写示范</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          {r.hardSentences.map((s, i) => (
            <div key={i} className="rounded-md border p-3 space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">原句</div>
                <div className="text-sm whitespace-pre-wrap">{s.originalEn}</div>
                {s.translationZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">中文：{s.translationZh}</div>}
              </div>

              {(s.coreStructureEn || s.tenseVoiceZh) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {s.coreStructureEn && (
                    <div className="text-sm">
                      <div className="font-medium">主干</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.coreStructureEn}</div>
                    </div>
                  )}
                  {s.tenseVoiceZh && (
                    <div className="text-sm">
                      <div className="font-medium">时态/语态</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.tenseVoiceZh}</div>
                    </div>
                  )}
                </div>
              )}

              {(s.clauses?.length || 0) > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">从句/结构拆解</div>
                  <div className="space-y-2">
                    {s.clauses!.slice(0, 10).map((c, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="whitespace-pre-wrap">{c.clauseEn}</div>
                        <div className="text-muted-foreground whitespace-pre-wrap">{c.functionZh}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {s.explanationZh && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{s.explanationZh}</div>
              )}

              {(s.simplifiedEn || s.rebuiltEn) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {s.simplifiedEn && (
                    <div className="text-sm">
                      <div className="font-medium">简化表达</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.simplifiedEn}</div>
                    </div>
                  )}
                  {s.rebuiltEn && (
                    <div className="text-sm">
                      <div className="font-medium">重组/更地道表达</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.rebuiltEn}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderVocabulary = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">关键词与核心短语</CardTitle>
          <CardDescription>提取文章中的关键词、核心搭配与短语</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">关键词</div>
            <div className="space-y-2">
              {r.keywords.map((k, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{k.term}</span>
                    {k.pos && <Badge variant="outline">{k.pos}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{k.meaningZh}</div>
                  {k.noteZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{k.noteZh}</div>}
                  {k.exampleEn && (
                    <div className="text-sm whitespace-pre-wrap">
                      <span className="text-muted-foreground">例句：</span>
                      {k.exampleEn}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {(r.phrases?.length || 0) > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">核心短语</div>
              <div className="space-y-2">
                {r.phrases!.map((p, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-2">
                    <div className="font-medium">{p.phrase}</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.meaningZh}</div>
                    {p.noteZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.noteZh}</div>}
                    {p.exampleEn && (
                      <div className="text-sm whitespace-pre-wrap">
                        <span className="text-muted-foreground">例句：</span>
                        {p.exampleEn}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderQuestions = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      {(r.questions?.length || 0) > 0 ? (
        <ReadingQuestionsView questions={r.questions!} />
      ) : (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">题目</CardTitle>
            <CardDescription>可在上方开启“生成题目”后重新分析。</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-sm text-muted-foreground">本次未生成题目。</div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>文章阅读</CardTitle>
        <CardDescription>
          上传或粘贴英文文章，AI 将提供结构分析、句法讲解、难句拆解、关键词/短语提取，并可选生成题目帮助理解。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            文章内容会发送到大语言模型进行分析，请勿上传包含隐私或敏感信息的内容。PDF 若为扫描版可能无法正确提取文本。
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="text-sm font-medium">上传文章文件</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleFilePick} disabled={isParsingFile || isAnalyzing} className="w-full sm:w-auto">
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
            <Input readOnly value={text ? `已载入正文（${text.length} 字符）` : "未载入"} className="text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">文章标题（可选）</div>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setResult(null);
            }}
            placeholder="例如：The Future of Education"
            disabled={isAnalyzing || isParsingFile}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">文章正文（英文）</div>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            placeholder="在此粘贴英文文章正文..."
            className="min-h-[240px]"
            disabled={isAnalyzing || isParsingFile}
          />
        </div>

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">生成题目（可选）</div>
              <div className="text-xs text-muted-foreground">生成阅读理解题，便于检验理解与学习效果。</div>
            </div>
            <Switch
              checked={includeQuestions}
              onCheckedChange={(v) => {
                setIncludeQuestions(!!v);
                setResult(null);
              }}
              disabled={isAnalyzing || isParsingFile}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="questionCount">题目数量</Label>
              <Input
                id="questionCount"
                type="number"
                min={1}
                max={12}
                value={questionCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setQuestionCount(Math.max(1, Math.min(12, Math.floor(n))));
                  setResult(null);
                }}
                disabled={!includeQuestions || isAnalyzing || isParsingFile}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              建议 6 题左右；文章较长时可适当增加。
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" onClick={handleAnalyze} disabled={isAnalyzing || isParsingFile} className="w-full sm:w-auto">
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在分析...
              </>
            ) : (
              "开始分析"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={resetAll} disabled={isAnalyzing || isParsingFile} className="w-full sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            清空
          </Button>
        </div>

        {result && (
          <Tabs defaultValue="structure" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="structure">结构</TabsTrigger>
              <TabsTrigger value="syntax">句法</TabsTrigger>
              <TabsTrigger value="hard">难句</TabsTrigger>
              <TabsTrigger value="vocab">词汇</TabsTrigger>
              <TabsTrigger value="questions">题目</TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="mt-4">
              {renderStructure(result)}
            </TabsContent>
            <TabsContent value="syntax" className="mt-4">
              {renderSyntax(result)}
            </TabsContent>
            <TabsContent value="hard" className="mt-4">
              {renderHardSentences(result)}
            </TabsContent>
            <TabsContent value="vocab" className="mt-4">
              {renderVocabulary(result)}
            </TabsContent>
            <TabsContent value="questions" className="mt-4">
              {renderQuestions(result)}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

