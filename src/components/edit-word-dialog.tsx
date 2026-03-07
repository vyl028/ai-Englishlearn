
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import type { CapturedWord } from "@/lib/types";

const formSchema = z.object({
  id: z.string(),
  word: z.string().min(1, "请输入单词。").max(50, "单词长度不能超过 50 个字符。"),
  partOfSpeech: z.string().min(1, "请选择词性。"),
  definition: z.string().min(1, "请输入释义。"),
  capturedAt: z.date(),
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

interface EditWordDialogProps {
  word: CapturedWord | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onWordUpdated: (updatedWord: CapturedWord) => void;
}

export function EditWordDialog({ word, isOpen, onOpenChange, onWordUpdated }: EditWordDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      word: "",
      partOfSpeech: "",
      definition: "",
    },
  });

  React.useEffect(() => {
    if (word) {
      form.reset(word);
    }
  }, [word, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    // Here we would typically have an async action, but for now we'll just update locally
    await new Promise(resolve => setTimeout(resolve, 500)); 
    onWordUpdated({ ...(word || ({} as any)), ...values } as CapturedWord);
    setIsSubmitting(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>编辑单词</DialogTitle>
          <DialogDescription>
            在这里修改你的单词信息，完成后点击保存。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="word"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>单词</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>词性</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择..." />
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
            <FormField
              control={form.control}
              name="definition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>释义</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
