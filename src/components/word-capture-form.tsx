"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, PlusCircle, Camera, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { defineTermAutoAction, extractWordAndDefineAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { CapturedWord } from "@/lib/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateId } from "@/lib/utils";

const formSchema = z.object({
  word: z.string().min(1, "请输入单词或短语。").max(100, "长度不能超过 100 个字符。"),
});

interface WordCaptureFormProps {
  onWordAdded: (word: CapturedWord) => void;
  onMultipleWordsAdded: (words: CapturedWord[]) => void;
}

export function WordCaptureForm({ onWordAdded, onMultipleWordsAdded }: WordCaptureFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const { toast } = useToast();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [activeTab, setActiveTab] = React.useState("text");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      word: "",
    },
  });

  const handleImageAnalysis = async (dataUri: string) => {
    setIsAnalyzing(true);

    try {
      const result = await extractWordAndDefineAction(dataUri);
      
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
      console.error("Image analysis error:", error);
      toast({
        variant: "destructive",
        title: "识别出错",
        description: "图片识别过程中发生未知错误。",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };


  React.useEffect(() => {
    if (activeTab === 'camera') {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: '无法访问摄像头',
            description: '请在浏览器设置中允许摄像头权限后再使用此功能。',
          });
        }
      };

      getCameraPermission();
      
      // Cleanup function to stop camera stream
      return () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [activeTab, toast]);

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
        handleImageAnalysis(dataUri);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        handleImageAnalysis(dataUri);
      };
      reader.readAsDataURL(file);
    }
     // Reset file input to allow same file selection again
    if (event.target) {
      event.target.value = "";
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const cleaned = String(values.word || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^[\s"'“”‘’()[\]{}<>.,!?;:]+|[\s"'“”‘’()[\]{}<>.,!?;:]+$/g, '');

      if (!cleaned) {
        toast({ variant: "destructive", title: "请输入单词", description: "单词或短语不能为空。" });
        return;
      }

      const result = await defineTermAutoAction({ term: cleaned });
      if (result.success && result.data) {
        const capturedAt = new Date();
        const seenPos = new Set<string>();
        const newWords: CapturedWord[] = [];

        for (const it of result.data) {
          const rawPos = String(it.partOfSpeech || '').trim();
          const partOfSpeech = rawPos || (/\s/.test(cleaned) ? 'phrase' : 'noun');
          const posKey = partOfSpeech.toLowerCase();
          if (seenPos.has(posKey)) continue;
          seenPos.add(posKey);

          const definition = String(it.definition || '').trim();
          if (!definition) continue;

          newWords.push({
            id: generateId(),
            word: cleaned,
            partOfSpeech,
            definition,
            enrichment: it.enrichment,
            capturedAt,
          });
        }

        if (newWords.length === 0) {
          toast({ variant: "destructive", title: "添加失败", description: "模型未返回有效结果，请稍后重试。" });
          return;
        }

        if (newWords.length === 1) onWordAdded(newWords[0]);
        else onMultipleWordsAdded(newWords);

        form.reset();
        toast({
          title: "已添加到单词本",
          description: newWords.length === 1 ? `已添加：${cleaned}` : `已添加：${cleaned}（${newWords.map((w) => w.partOfSpeech).join(' / ')}）`,
        });
        // setActiveTab('text');
        return;
      }

      toast({
        variant: "destructive",
        title: "添加失败",
        description: result.error || "发生未知错误，请稍后重试。",
      });
    } finally {
      setIsSubmitting(false);
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
                        <Input placeholder="例如：ephemeral / take off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmitting || isAnalyzing} className="w-full sm:w-auto mt-6">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在添加...
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
                    <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="w-full">
                       {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          正在识别...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          选择图片并识别
                        </>
                      )}
                    </Button>
                    <div className="text-center text-sm text-muted-foreground">
                      <p>点击上方按钮，从设备中选择图片进行识别。</p>
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
