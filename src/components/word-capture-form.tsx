"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, PlusCircle, Camera, Upload, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { aiApi } from "@/lib/api-client";
import { withRetry, isRetryableError } from "@/lib/ai-retry";
import { useToast } from "@/hooks/use-toast";
import type { CapturedWord } from "@/lib/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateId } from "@/lib/utils";
import { getAiCache, hashAiCachePayload, setAiCache } from "@/lib/ai-cache";
import { LazyImage } from "@/components/lazy-image";
import { extractTextFromImage, extractWordsFromText } from "@/lib/ocr-utils";

const formSchema = z.object({
  word: z
    .string()
    .min(1, "请输入单词或短语（支持换行/逗号分隔批量添加）。")
    .max(2000, "长度不能超过 2000 个字符。"),
});

interface WordCaptureFormProps {
  onWordAdded: (word: CapturedWord) => void;
  onMultipleWordsAdded: (words: CapturedWord[]) => void;
}

export function WordCaptureForm({ onWordAdded, onMultipleWordsAdded }: WordCaptureFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitProgress, setSubmitProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const { toast } = useToast();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = React.useState<"user" | "environment">("environment");
  const [canSwitchCamera, setCanSwitchCamera] = React.useState(false);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const [activeTab, setActiveTab] = React.useState("text");
  const [cameraActive, setCameraActive] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadPreviewDataUri, setUploadPreviewDataUri] = React.useState<string | null>(null);
  const imageAnalysisTokenRef = React.useRef(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      word: "",
    },
  });

  const handleImageAnalysis = async (dataUri: string) => {
    const token = ++imageAnalysisTokenRef.current;
    setIsAnalyzing(true);
    try {
      // 步骤 1: 使用前端 OCR 提取图片中的文字
      console.log("[ImageAnalysis] Step 1: OCR text extraction");
      const extractedText = await extractTextFromImage(dataUri);

      if (!extractedText || extractedText.length < 3) {
        toast({
          variant: "destructive",
          title: "识别失败",
          description: "未能从图片中识别到文字，请尝试更清晰的图片。",
        });
        return;
      }

      // 步骤 2: 从文本中提取可能的单词
      console.log("[ImageAnalysis] Step 2: Extracting words from text");
      const extractedWords = extractWordsFromText(extractedText);

      if (extractedWords.length === 0) {
        toast({
          variant: "destructive",
          title: "识别失败",
          description: "未能从图片中提取到有效单词。",
        });
        return;
      }

      console.log("[ImageAnalysis] Extracted words:", extractedWords);

      // 步骤 3: 为每个单词获取定义
      const capturedAt = new Date();
      const newWords: CapturedWord[] = [];
      const failed: string[] = [];

      for (const word of extractedWords) {
        if (token !== imageAnalysisTokenRef.current) return;

        try {
          const defineCacheHash = hashAiCachePayload({ term: word.trim().toLowerCase() });
          type DefinitionItem = { word: string; partOfSpeech: string; definition: string; enrichment?: any };
          const cached = getAiCache<DefinitionItem[]>(
            'define',
            defineCacheHash
          );
          const result = cached
            ? { success: true as const, data: { definitions: cached } }
            : await aiApi.define(word);

          if (!result.success || !result.data?.definitions) {
            failed.push(word);
            continue;
          }

          if (!cached) {
            setAiCache('define', defineCacheHash, result.data.definitions);
          }

          const seenPos = new Set<string>();
          for (const it of result.data.definitions) {
            const rawPos = String(it.partOfSpeech || "").trim();
            const partOfSpeech = rawPos || ( /\s/.test(word) ? "phrase" : "noun");
            const posKey = partOfSpeech.toLowerCase();
            if (seenPos.has(posKey)) continue;
            seenPos.add(posKey);

            const definition = String(it.definition || "").trim();
            if (!definition) continue;

            newWords.push({
              id: generateId(),
              word: word,
              partOfSpeech,
              definition,
              enrichment: it.enrichment,
              capturedAt,
              photoDataUri: dataUri,
            });
          }
        } catch (error) {
          console.error(`[ImageAnalysis] Failed to define word "${word}":`, error);
          failed.push(word);
        }
      }

      if (token !== imageAnalysisTokenRef.current) return;

      if (newWords.length === 0) {
        toast({
          variant: "destructive",
          title: "识别失败",
          description: "未能从图片中识别到有效单词。",
        });
        return;
      }

      onMultipleWordsAdded(newWords);
      form.reset();

      const failMsg = failed.length > 0 ? `（${failed.length} 个单词未成功）` : '';
      toast({
        title: `已识别 ${newWords.length} 个单词${failMsg}`,
        description: `从图片中识别并生成了 ${newWords.length} 个单词的释义。`,
      });

    } catch (error) {
      if (token !== imageAnalysisTokenRef.current) return;
      console.error("Image analysis error:", error);

      const errorMessage = error instanceof Error ? error.message : "图片识别过程中发生未知错误。";

      toast({
        variant: "destructive",
        title: "识别出错",
        description: errorMessage,
      });
    } finally {
      if (token === imageAnalysisTokenRef.current) setIsAnalyzing(false);
    }
  };


  React.useEffect(() => {
    if (activeTab !== "camera" || !cameraActive) return;
    let cancelled = false;

    const stop = () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };

    const start = async () => {
      stop();
      setCanSwitchCamera(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: cameraFacingMode } },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (cancelled) return;
          const videoInputs = devices.filter((d) => d.kind === "videoinput");
          setCanSwitchCamera(videoInputs.length > 1);
        } catch {
          setCanSwitchCamera(false);
        }
      } catch (error) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          cameraStreamRef.current = stream;
          setHasCameraPermission(true);
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (fallbackError: any) {
          console.error("[Camera] Error accessing camera:", fallbackError);
          const errorMsg = fallbackError?.name || fallbackError?.message || String(fallbackError);
          setCameraError(`摄像头错误: ${errorMsg}`);
          setHasCameraPermission(false);
          toast({
            variant: "destructive",
            title: "无法访问摄像头",
            description: `错误: ${errorMsg}。请检查浏览器权限设置。`,
          });
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      stop();
      setCanSwitchCamera(false);
    };
  }, [activeTab, cameraActive, cameraFacingMode, toast]);

  const handleSwitchCamera = () => {
    setCameraFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUri = canvas.toDataURL('image/jpeg');
        void handleImageAnalysis(dataUri);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setUploadPreviewDataUri(dataUri);
        void handleImageAnalysis(dataUri);
      };
      reader.readAsDataURL(file);
    }
     // Reset file input to allow same file selection again
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleClearUpload = () => {
    imageAnalysisTokenRef.current += 1;
    setIsAnalyzing(false);
    setUploadPreviewDataUri(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setSubmitProgress(null);
    try {
      const cleanTerm = (raw: string) =>
        String(raw || "")
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^[\s"'“”‘’()[\]{}<>.,!?;:]+|[\s"'“”‘’()[\]{}<>.,!?;:]+$/g, "");

      const rawInput = String(values.word || "");
      const terms = rawInput
        .split(/[\n,，]+/g)
        .map(cleanTerm)
        .filter(Boolean);

      if (terms.length === 0) {
        toast({ variant: "destructive", title: "请输入单词", description: "单词或短语不能为空。" });
        return;
      }

      if (terms.length > 1) setSubmitProgress({ current: 0, total: terms.length });

      const failed: { term: string; reason: string }[] = [];
      const allNewWords: CapturedWord[] = [];

      for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        if (terms.length > 1) setSubmitProgress({ current: i + 1, total: terms.length });

        if (term.length > 100) {
          failed.push({ term, reason: "长度超过 100 个字符" });
          continue;
        }

        try {
          const defineCacheHash = hashAiCachePayload({ term: term.trim().toLowerCase() });
          type DefinitionItem = { word: string; partOfSpeech: string; definition: string; enrichment?: any };
          const cached = getAiCache<DefinitionItem[]>(
            'define',
            defineCacheHash
          );
          const result = cached
            ? { success: true as const, data: { definitions: cached } }
            : await aiApi.define(term);
          if (!result.success || !result.data?.definitions) {
            failed.push({ term, reason: result.error?.message || "生成失败" });
            continue;
          }

          if (!cached) {
            setAiCache('define', defineCacheHash, result.data.definitions);
          }

          const capturedAt = new Date();
          const seenPos = new Set<string>();
          const newWords: CapturedWord[] = [];

          for (const it of result.data.definitions) {
            const rawPos = String(it.partOfSpeech || "").trim();
            const partOfSpeech = rawPos || (/\s/.test(term) ? "phrase" : "noun");
            const posKey = partOfSpeech.toLowerCase();
            if (seenPos.has(posKey)) continue;
            seenPos.add(posKey);

            const definition = String(it.definition || "").trim();
            if (!definition) continue;

            newWords.push({
              id: generateId(),
              word: term,
              partOfSpeech,
              definition,
              enrichment: it.enrichment,
              capturedAt,
            });
          }

          if (newWords.length === 0) {
            failed.push({ term, reason: "模型未返回有效结果" });
            continue;
          }

          allNewWords.push(...newWords);
        } catch (error) {
          console.error("Define term error:", error);
          failed.push({ term, reason: "发生未知错误" });
        }
      }

      if (allNewWords.length === 0) {
        const first = failed[0];
        toast({
          variant: "destructive",
          title: "添加失败",
          description: first ? `“${first.term}”：${first.reason}` : "发生未知错误，请稍后重试。",
        });
        return;
      }

      if (allNewWords.length === 1) onWordAdded(allNewWords[0]);
      else onMultipleWordsAdded(allNewWords);

      form.reset();

      if (terms.length === 1) {
        const term = terms[0];
        const posLabel =
          allNewWords.length > 1 ? `（${allNewWords.map((w) => w.partOfSpeech).join(" / ")}）` : "";
        toast({
          title: "已生成词条",
          description: `已生成：${term}${posLabel}，正在加入单词本...`,
        });
        return;
      }

      const okCount = terms.length - failed.length;
      const failCount = failed.length;
      const failedPreview = failed
        .slice(0, 3)
        .map((f) => `“${f.term}”`)
        .join("、");
      toast({
        title: "批量生成完成",
        description:
          failCount > 0
            ? `成功 ${okCount}，失败 ${failCount}（如：${failedPreview}）。正在加入单词本...`
            : `成功 ${okCount}，正在加入单词本...`,
      });
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(null);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>新增单词</CardTitle>
        <CardDescription>
          你可以手动输入单词，也可以拍照/上传图片，让 AI 帮你识别并生成释义。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v);
              if (v !== "camera") {
                setCameraActive(false);
                cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
                cameraStreamRef.current = null;
              }
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-3 min-h-11">
                <TabsTrigger value="text" disabled={isAnalyzing} className="text-sm sm:text-base">手动输入</TabsTrigger>
                <TabsTrigger value="camera" disabled={isAnalyzing} className="text-sm sm:text-base"><Camera className="w-4 h-4 mr-1 sm:mr-2 shrink-0"/>拍照</TabsTrigger>
                <TabsTrigger value="upload" disabled={isAnalyzing} className="text-sm sm:text-base"><Upload className="w-4 h-4 mr-1 sm:mr-2 shrink-0"/>上传</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                 {isAnalyzing && (
                    <div className="flex items-center justify-center space-x-2 my-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-muted-foreground">正在识别图片...</span>
                    </div>
                )}
                <FormField
                  control={form.control}
                  name="word"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>单词/短语</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={"例如：\nephemeral, take off\nlook up"}
                          className="min-h-[96px]"
                          inputMode="text"
                          autoCapitalize="off"
                          autoComplete="off"
                          spellCheck="false"
                          {...field}
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground">支持换行或逗号分隔，可一次添加多条。</div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmitting || isAnalyzing} className="w-full sm:w-auto mt-6">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {submitProgress ? `正在添加... (${submitProgress.current}/${submitProgress.total})` : "正在添加..."}
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      添加单词
                    </>
                  )}
                </Button>
              </TabsContent>
              <TabsContent value="camera">
                <div className="space-y-4 mt-4">
                  {/* 启动摄像头按钮 - 需要用户手势触发权限请求 */}
                  {!cameraActive && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="text-sm text-muted-foreground text-center">
                        点击按钮启动摄像头权限
                      </div>
                      <Button
                        type="button"
                        onClick={() => setCameraActive(true)}
                        disabled={isAnalyzing}
                        className="w-full sm:w-auto"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        启动摄像头
                      </Button>
                    </div>
                  )}

                  {/* 视频预览区 - 移动端优化 */}
                  <div className={`relative rounded-lg overflow-hidden bg-muted ${!cameraActive ? 'hidden' : ''}`}>
                    <video
                      ref={videoRef}
                      className="w-full aspect-[4/3] sm:aspect-video object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                    {canSwitchCamera && hasCameraPermission === true && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={handleSwitchCamera}
                        disabled={isAnalyzing}
                        className="absolute top-3 right-3 h-12 w-12 rounded-full shadow-lg bg-background/90 hover:bg-background"
                        aria-label="切换摄像头"
                        title="切换前后摄像头"
                      >
                        <RefreshCcw className="h-5 w-5" />
                      </Button>
                    )}
                    {hasCameraPermission === true && (
                      <div className="absolute bottom-3 left-3 text-xs text-white/90 bg-black/50 px-2 py-1 rounded">
                        {cameraFacingMode === 'environment' ? '后置摄像头' : '前置摄像头'}
                      </div>
                    )}
                  </div>
                  {hasCameraPermission === false && (
                    <Alert variant="destructive">
                      <AlertTitle>需要摄像头权限</AlertTitle>
                      <AlertDescription>
                        {cameraError || "请允许摄像头访问权限后再使用此功能。"}
                        <div className="mt-2 text-xs text-muted-foreground">
                          提示：手机浏览器通常需要 HTTPS 或用户手势才能请求摄像头权限。
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 拍照按钮 - 大圆形设计 */}
                  <div className="flex justify-center py-2">
                    <Button
                      type="button"
                      onClick={handleCapture}
                      disabled={!hasCameraPermission || isAnalyzing}
                      className="h-16 w-16 rounded-full shadow-lg"
                      aria-label="拍照"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Camera className="h-6 w-6" />
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="upload">
                <div className="space-y-4 mt-4">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    {uploadPreviewDataUri && (
                      <div className="rounded-md border overflow-hidden">
                        <LazyImage
                          src={uploadPreviewDataUri}
                          alt="图片预览"
                          className="w-full h-auto"
                          containerClassName="w-full"
                          priority
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex-1">
                         {isAnalyzing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            正在识别...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            {uploadPreviewDataUri ? "重新选择" : "选择图片并识别"}
                          </>
                        )}
                      </Button>
                      {uploadPreviewDataUri && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearUpload}
                          className="flex-1"
                          aria-label="清空已选图片"
                          title="清空"
                        >
                          清空
                        </Button>
                      )}
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      <p>{uploadPreviewDataUri ? "可重新选择或清空当前图片。" : "点击上方按钮，从设备中选择图片进行识别。"}</p>
                    </div>
                  </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
