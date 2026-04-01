"use client";

import { memo, useCallback, useState } from "react";
import { CheckCircle, Circle, Eye, EyeOff, Copy, Loader2, RefreshCcw, Pencil, FolderInput, Trash, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { CapturedWord } from "@/lib/types";

// 单词变体选择器
interface VariantSelectorProps {
  variants: CapturedWord[];
  selectedId: string;
  onSelect: (id: string) => void;
  groupKey: string;
}

const VariantSelector = memo(function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps) {
  if (variants.length <= 1) {
    return (
      <Badge variant="secondary" className="capitalize shrink-0">
        {variants[0]?.partOfSpeech}
      </Badge>
    );
  }

  return (
    <>
      {/* 移动端下拉选择 */}
      <div className="sm:hidden shrink-0">
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="h-7 w-[120px]">
            <SelectValue placeholder="词性" />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id} className="capitalize">
                {v.partOfSpeech}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 桌面端按钮组 */}
      <div className="hidden sm:flex flex-wrap items-center gap-1 shrink-0">
        {variants.map((v) => (
          <Button
            key={v.id}
            type="button"
            size="sm"
            variant={v.id === selectedId ? "secondary" : "outline"}
            className="h-6 px-2 text-xs capitalize"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(v.id);
            }}
          >
            {v.partOfSpeech}
          </Button>
        ))}
      </div>
    </>
  );
});

// 操作按钮组
interface ActionButtonsProps {
  isMastered: boolean;
  isDefinitionOpen: boolean;
  isRegenerating: boolean;
  onToggleMastered: () => void;
  onToggleDefinition: () => void;
  onCopyWord: () => void;
  onCopyDefinition: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}

const ActionButtons = memo(function ActionButtons({
  isMastered,
  isDefinitionOpen,
  isRegenerating,
  onToggleMastered,
  onToggleDefinition,
  onCopyWord,
  onCopyDefinition,
  onRegenerate,
  onEdit,
  onMove,
  onDelete,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center flex-shrink-0 ml-2 sm:ml-4 flex-wrap justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-11 w-11", isMastered ? "text-primary" : "text-muted-foreground")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMastered();
            }}
          >
            {isMastered ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isMastered ? "已掌握（点击取消）" : "标记为已掌握"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-11 w-11", isDefinitionOpen ? "text-foreground" : "text-muted-foreground")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleDefinition();
            }}
          >
            {isDefinitionOpen ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isDefinitionOpen ? "隐藏释义" : "显示释义"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onCopyWord();
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>复制单词</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground"
            disabled={isRegenerating}
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
          >
            {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>重新生成</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>编辑</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
          >
            <FolderInput className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>移动分组</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-destructive/70 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>删除</TooltipContent>
      </Tooltip>
    </div>
  );
});

// 单词卡片主组件
export interface WordCardProps {
  word: CapturedWord;
  variants: CapturedWord[];
  isMastered: boolean;
  isDefinitionOpen: boolean;
  isSelected?: boolean;
  showCheckbox?: boolean;
  display: string;
  latestCapturedAt: string;
  onToggleMastered: () => void;
  onToggleDefinition: () => void;
  onCopyWord: () => void;
  onCopyDefinition: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onWordClick: () => void;
  onSelect?: (selected: boolean) => void;
  onVariantSelect: (id: string) => void;
  selectedVariantId: string;
}

export const WordCard = memo(function WordCard({
  word,
  variants,
  isMastered,
  isDefinitionOpen,
  isSelected,
  showCheckbox,
  display,
  latestCapturedAt,
  onToggleMastered,
  onToggleDefinition,
  onCopyWord,
  onCopyDefinition,
  onRegenerate,
  onEdit,
  onMove,
  onDelete,
  onWordClick,
  onSelect,
  onVariantSelect,
  selectedVariantId,
}: WordCardProps) {
  const selected = variants.find((w) => w.id === selectedVariantId) || variants[0];
  const enrichment = selected?.enrichment;

  const hasEnrichmentContent = (() => {
    if (!enrichment) return false;
    const hasLevel = !!(enrichment.level?.cefr || enrichment.level?.usageZh);
    const hasCollocations = Array.isArray(enrichment.collocations) && enrichment.collocations.length > 0;
    const hasSynonyms = Array.isArray(enrichment.synonyms) && enrichment.synonyms.length > 0;
    const hasAntonyms = Array.isArray(enrichment.antonyms) && enrichment.antonyms.length > 0;
    const hasExamples = Array.isArray(enrichment.examples) && enrichment.examples.length > 0;
    return hasLevel || hasCollocations || hasSynonyms || hasAntonyms || hasExamples;
  })();

  return (
    <Card className="w-full">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-grow flex items-center gap-2 overflow-hidden">
            {showCheckbox && onSelect && (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onSelect}
                  aria-label="选择该卡片"
                />
              </div>
            )}
            <span
              className="font-bold text-lg cursor-pointer hover:underline"
              onClick={onWordClick}
            >
              {display}
            </span>
            {isMastered && (
              <Badge
                variant="secondary"
                className="h-6 px-2 text-xs bg-primary/10 text-primary hover:bg-primary/10 shrink-0"
              >
                已掌握
              </Badge>
            )}

            <VariantSelector
              variants={variants}
              selectedId={selectedVariantId}
              onSelect={onVariantSelect}
              groupKey={word.id}
            />

            {isDefinitionOpen && (
              <p className="text-muted-foreground truncate">{selected?.definition}</p>
            )}
          </div>

          <div className="text-xs text-muted-foreground mr-4 hidden sm:block">
            {formatDistanceToNow(new Date(latestCapturedAt), { addSuffix: true })}
          </div>

          <ActionButtons
            isMastered={isMastered}
            isDefinitionOpen={isDefinitionOpen}
            isRegenerating={false}
            onToggleMastered={onToggleMastered}
            onToggleDefinition={onToggleDefinition}
            onCopyWord={onCopyWord}
            onCopyDefinition={onCopyDefinition}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onMove={onMove}
            onDelete={onDelete}
          />
        </div>

        {isDefinitionOpen && enrichment && (
          <Accordion type="single" collapsible className="mt-2">
            <AccordionItem value="details" className="border-none">
              <AccordionTrigger className="py-2 text-sm">了解更多</AccordionTrigger>
              <AccordionContent className="pb-1">
                {!hasEnrichmentContent ? (
                  <p className="text-muted-foreground">
                    暂无 AI 拓展内容（可能是模型返回为空或解析失败）。你可以稍后点击"重新生成"。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(enrichment.level?.cefr || enrichment.level?.usageZh) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground">难度与用法</div>
                        <div className="text-sm">
                          {enrichment.level?.cefr && (
                            <span className="mr-2">CEFR: {enrichment.level.cefr}</span>
                          )}
                          {enrichment.level?.usageZh && (
                            <p className="mt-1 text-muted-foreground">{enrichment.level.usageZh}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {Array.isArray(enrichment.collocations) && enrichment.collocations.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground">常见搭配</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {enrichment.collocations.map((col, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {col.phrase}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(enrichment.examples) && enrichment.examples.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground">例句</div>
                        <ul className="space-y-1 mt-1">
                          {enrichment.examples.map((ex, i) => (
                            <li key={i} className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
                              {ex.en}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
});
