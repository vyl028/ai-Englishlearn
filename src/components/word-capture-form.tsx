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
import { defineTermAutoAction, extractWordAndDefineAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { CapturedWord } from "@/lib/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateId } from "@/lib/utils";

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
      const result = await extractWordAndDefineAction(dataUri);

      if (token !== imageAnalysisTokenRef.current) return;
      if (result.success && result.data) {
        const wordsFound = result.data;

        const capturedAt = new Date();
        const newWords: CapturedWord[] = wordsFound.map(foundWord => ({
          id: generateId(),
          word: foundWord.word,
          partOfSpeech: foundWord.partOfSpeech,
          definition: foundWord.definition,
          enrichment: foundWord.enrichment,
          capturedAt,
          photoDataUri: dataUri,
        }));
        onMultipleWordsAdded(newWords);
        
        form.reset();
        toast({
          title: `已识别 ${wordsFound.length} 个单词`,
          description: `已从图片中识别并生成释义。`,
        });
        // setActiveTab('text'); // Don't switch tab, let user decide.
      } else {
        toast({
          variant: "destructive",
          title: "识别失败",
          description: result.error || "无法从图片中识别到单词。",
        });
      }
    } catch (error) {
      if (token !== imageAnalysisTokenRef.current) return;
      console.error("Image analysis error:", error);
      toast({
        variant: "destructive",
        title: "识别出错",
        description: "图片识别过程中发生未知错误。",
      });
    } finally {
      if (token === imageAnalysisTokenRef.current) setIsAnalyzing(false);
    }
  };


  React.useEffect(() => {
    if (activeTab !== "camera") return;
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
        } catch (fallbackError) {
          console.error("Error accessing camera:", fallbackError);
          setHasCameraPermission(false);
          toast({
            variant: "destructive",
            title: "无法访问摄像头",
            description: "请在浏览器设置中允许摄像头权限后再使用此功能。",
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
  }, [activeTab, cameraFacingMode, toast]);

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
          const result = await defineTermAutoAction({ term });
          if (!result.success || !result.data) {
            failed.push({ term, reason: result.error || "生成失败" });
            continue;
          }

          const capturedAt = new Date();
          const seenPos = new Set<string>();
          const newWords: CapturedWord[] = [];

          for (const it of result.data) {
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text" disabled={isAnalyzing}>手动输入</TabsTrigger>
                <TabsTrigger value="camera" disabled={isAnalyzing}><Camera className="w-4 h-4 mr-2"/>拍照</TabsTrigger>
                <TabsTrigger value="upload" disabled={isAnalyzing}><Upload className="w-4 h-4 mr-2"/>上传</TabsTrigger>
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
                  <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  {hasCameraPermission === false && (
                    <Alert variant="destructive">
                      <AlertTitle>需要摄像头权限</AlertTitle>
                      <AlertDescription>
                        请允许摄像头访问权限后再使用此功能。
                      </AlertDescription>
                    </Alert>
                  )}
                  {hasCameraPermission === true && (
                    <div className="text-center text-sm text-muted-foreground">默认优先后置摄像头。</div>
                  )}
                  {canSwitchCamera && hasCameraPermission === true && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSwitchCamera}
                      disabled={isAnalyzing}
                      className="w-full"
                      aria-label="切换摄像头"
                      title="切换前后摄像头"
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      切换摄像头
                    </Button>
                  )}
                  <Button type="button" onClick={handleCapture} disabled={!hasCameraPermission || isAnalyzing} className="w-full">
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在识别...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        拍照并识别
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="upload">
                <div className="space-y-4 mt-4">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    {uploadPreviewDataUri && (
                      <div className="rounded-md border overflow-hidden">
                        <img src={uploadPreviewDataUri} alt="图片预览" className="w-full h-auto" />
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
