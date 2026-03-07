"use client";

import * as React from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

import type { GenerateStoryOutput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StoryViewProps {
  storyData: GenerateStoryOutput;
  onBack: () => void;
  onExportPdf: () => Promise<void>;
}

export function StoryView({ storyData, onBack, onExportPdf }: StoryViewProps) {
  const [exporting, setExporting] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold font-headline">故事</h2>
            <div className="text-sm text-muted-foreground truncate">{storyData.title}</div>
          </div>
        </div>

        <Button
          onClick={async () => {
            setExporting(true);
            try {
              await onExportPdf();
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          导出 PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{storyData.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap leading-relaxed">{storyData.story}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">中文译文</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{storyData.translation}</div>
        </CardContent>
      </Card>
    </div>
  );
}

