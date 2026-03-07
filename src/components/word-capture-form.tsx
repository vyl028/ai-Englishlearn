"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, PlusCircle, Camera, Upload, X } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getDefinitionAction, extractWordAndDefineAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { CapturedWord } from "@/lib/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateId } from "@/lib/utils";

const formSchema = z.object({
  word: z.string().min(1, "Please enter a word.").max(50, "Word must be 50 characters or less."),
  partOfSpeech: z.string().min(1, "Please select a part of speech."),
  photoDataUri: z.string().optional(),
});

const partsOfSpeech = [
  "noun",
  "pronoun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "interjection",
];

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
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      word: "",
      partOfSpeech: "",
      photoDataUri: "",
    },
  });

  const handleImageAnalysis = async (dataUri: string) => {
    setIsAnalyzing(true);
    setCapturedImage(dataUri);
    // We don't set photoDataUri in the form anymore for auto-analysis
    // form.setValue('photoDataUri', dataUri);

    try {
      console.log('Starting image analysis with dataUri length:', dataUri.length);
      const result = await extractWordAndDefineAction(dataUri);
      console.log('extractWordAndDefineAction result:', result);
      
      if (result.success && result.data) {
        const wordsFound = result.data;
        console.log('Words found:', wordsFound);
        
        const newWords: CapturedWord[] = wordsFound.map(foundWord => ({
          id: generateId(),
          word: foundWord.word,
          partOfSpeech: foundWord.partOfSpeech,
          definition: foundWord.definition,
          capturedAt: new Date(),
          photoDataUri: dataUri,
        }));
        console.log('New words created:', newWords);
        onMultipleWordsAdded(newWords);
        
        form.reset();
        setCapturedImage(null);
        form.setValue('photoDataUri', undefined);
        toast({
          title: `Captured ${wordsFound.length} ${wordsFound.length > 1 ? 'words' : 'word'}!`,
          description: `Successfully identified and defined words from the image.`,
        });
        // setActiveTab('text'); // Don't switch tab, let user decide.
      } else {
        toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: result.error || "Could not extract word from image.",
        });
        // Clear image on failure so user can try again
        setCapturedImage(null);
        form.setValue('photoDataUri', undefined);
      }
    } catch (error) {
      console.error("Image analysis error:", error);
      toast({
        variant: "destructive",
        title: "Analysis Error",
        description: "An unexpected error occurred during image analysis.",
      });
      // Clear image on error so user can try again
      setCapturedImage(null);
      form.setValue('photoDataUri', undefined);
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
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this app.',
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
  
  React.useEffect(() => {
    // When capturedImage is set, also set it in the form for manual submission
    form.setValue('photoDataUri', capturedImage || undefined);
  }, [capturedImage, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const result = await getDefinitionAction(values);

    if (result.success && result.data) {
      onWordAdded(result.data);
      form.reset();
      setCapturedImage(null);
      form.setValue('photoDataUri', undefined);
      // setActiveTab('text');
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "Something went wrong.",
      });
    }
    setIsSubmitting(false);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Capture a New Word</CardTitle>
        <CardDescription>
          Enter a word manually, or use your camera or upload an image to have AI identify it for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text" disabled={isAnalyzing}>Text</TabsTrigger>
                <TabsTrigger value="camera" disabled={isAnalyzing}><Camera className="w-4 h-4 mr-2"/>Camera</TabsTrigger>
                <TabsTrigger value="upload" disabled={isAnalyzing}><Upload className="w-4 h-4 mr-2"/>Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                 {isAnalyzing && (
                    <div className="flex items-center justify-center space-x-2 my-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-muted-foreground">Analyzing image...</span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="word"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Word</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 'ephemeral'" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="partOfSpeech"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Part of Speech</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {partsOfSpeech.map((pos) => (
                              <SelectItem key={pos} value={pos} className="capitalize">
                                {pos.charAt(0).toUpperCase() + pos.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 {capturedImage && !isAnalyzing && (
                  <div className="space-y-2 pt-4">
                    <FormLabel>Image Preview (Optional)</FormLabel>
                    <div className="relative">
                      <img src={capturedImage} alt="Captured preview" className="rounded-md max-h-48 w-auto" />
                       <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 bg-background/50 hover:bg-background/75" onClick={() => { setCapturedImage(null); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <Button type="submit" disabled={isSubmitting || isAnalyzing} className="w-full sm:w-auto mt-6">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Capturing...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Word
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
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>
                        Please allow camera access to use this feature.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button type="button" onClick={handleCapture} disabled={!hasCameraPermission || isAnalyzing} className="w-full">
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Capture & Analyze
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
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Select & Analyze Image
                        </>
                      )}
                    </Button>
                    <div className="text-center text-sm text-muted-foreground">
                      <p>Click the button to select an image from your device.</p>
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
