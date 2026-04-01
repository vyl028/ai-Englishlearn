"use client";

import * as React from "react";
import { CheckCircle, Circle, Eye, EyeOff, Pencil, Trash2, FolderInput, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { CapturedWord } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MobileWordCardProps {
  word: CapturedWord;
  variants?: CapturedWord[];
  isMastered?: boolean;
  isDefinitionOpen?: boolean;
  isSelected?: boolean;
  showCheckbox?: boolean;
  onToggleMastered?: () => void;
  onToggleDefinition?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  onSelect?: (selected: boolean) => void;
  onWordClick?: () => void;
  className?: string;
}

/**
 * 移动端优化的单词卡片组件
 * - 更紧凑的布局
 * - 折叠/展开详情区域
 * - 移动端优先的操作按钮布局
 * - 批量选择模式支持
 */
export function MobileWordCard({
  word,
  variants = [],
  isMastered = false,
  isDefinitionOpen = false,
  isSelected = false,
  showCheckbox = false,
  onToggleMastered,
  onToggleDefinition,
  onEdit,
  onDelete,
  onMove,
  onSelect,
  onWordClick,
  className,
}: MobileWordCardProps) {
  const isMobile = useIsMobile();
  const [showDetails, setShowDetails] = React.useState(false);

  // 使用传入的状态或内部状态
  const definitionVisible = isDefinitionOpen || showDetails;

  const toggleDefinition = () => {
    if (onToggleDefinition) {
      onToggleDefinition();
    } else {
      setShowDetails(!showDetails);
    }
  };

  // 桌面端使用标准卡片
  if (!isMobile) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {showCheckbox && onSelect && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onSelect}
                  className="shrink-0"
                />
              )}
              <span
                className="font-bold text-lg cursor-pointer hover:underline truncate"
                onClick={onWordClick}
              >
                {word.word}
              </span>
              {isMastered && (
                <Badge
                  variant="secondary"
                  className="h-6 px-2 text-xs bg-primary/10 text-primary hover:bg-primary/10 shrink-0"
                >
                  已掌握
                </Badge>
              )}
              <Badge variant="secondary" className="capitalize shrink-0">
                {word.partOfSpeech}
              </Badge>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-11 w-11", isMastered ? "text-primary" : "text-muted-foreground")}
                onClick={onToggleMastered}
              >
                {isMastered ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={toggleDefinition}
              >
                {definitionVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-11 w-11">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onMove}>
                    <FolderInput className="mr-2 h-4 w-4" />
                    移动分组
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {definitionVisible && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <p className="text-muted-foreground">{word.definition}</p>
              {word.enrichment && (
                <div className="text-sm space-y-1">
                  {word.enrichment.level?.cefr && (
                    <p className="text-xs text-muted-foreground">
                      CEFR: {word.enrichment.level.cefr}
                    </p>
                  )}
                  {Array.isArray(word.enrichment.examples) && word.enrichment.examples.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">例句</p>
                      <ul className="space-y-1">
                        {word.enrichment.examples.slice(0, 2).map((ex, i) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            {ex.en}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 移动端紧凑卡片
  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardContent className="p-3">
        {/* 头部：单词信息和主要操作 */}
        <div className="flex items-start gap-2">
          {showCheckbox && onSelect && (
            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="h-5 w-5"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* 单词和词性 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-bold text-lg cursor-pointer hover:underline"
                onClick={onWordClick}
              >
                {word.word}
              </span>
              <Badge variant="secondary" className="text-xs capitalize h-5">
                {word.partOfSpeech}
              </Badge>
              {isMastered && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-primary/10 text-primary hover:bg-primary/10 h-5"
                >
                  已掌握
                </Badge>
              )}
            </div>

            {/* 释义（始终显示，但可折叠） */}
            <p className={cn(
              "text-sm text-muted-foreground mt-1",
              !definitionVisible && "line-clamp-2"
            )}>
              {word.definition}
            </p>
          </div>
        </div>

        {/* 操作按钮栏 */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t">
          <div className="flex items-center gap-1">
            {/* 掌握状态切换 */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-2 text-xs",
                isMastered ? "text-primary" : "text-muted-foreground"
              )}
              onClick={onToggleMastered}
            >
              {isMastered ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  已掌握
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4 mr-1" />
                  未掌握
                </>
              )}
            </Button>

            {/* 展开/折叠详情 */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-muted-foreground"
              onClick={toggleDefinition}
            >
              {definitionVisible ? (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  详情
                </>
              )}
            </Button>
          </div>

          {/* 更多操作菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMove}>
                <FolderInput className="mr-2 h-4 w-4" />
                移动分组
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 展开的详情区域 */}
        {definitionVisible && word.enrichment && (
          <div className="mt-3 pt-3 border-t space-y-3 animate-in slide-in-from-top-2 duration-200">
            {word.enrichment.level?.cefr && (
              <div>
                <span className="text-xs text-muted-foreground">难度</span>
                <p className="text-sm">{word.enrichment.level.cefr}</p>
              </div>
            )}

            {Array.isArray(word.enrichment.collocations) && word.enrichment.collocations.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">常见搭配</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {word.enrichment.collocations.slice(0, 4).map((col, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {col.phrase}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(word.enrichment.examples) && word.enrichment.examples.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">例句</span>
                <ul className="space-y-1 mt-1">
                  {word.enrichment.examples.slice(0, 2).map((ex, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
                      {ex.en}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(word.enrichment.synonyms) && word.enrichment.synonyms.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">同义词</span>
                <p className="text-sm mt-1">
                  {word.enrichment.synonyms.slice(0, 5).join(", ")}
                </p>
              </div>
            )}

            {Array.isArray(word.enrichment.antonyms) && word.enrichment.antonyms.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">反义词</span>
                <p className="text-sm mt-1">
                  {word.enrichment.antonyms.slice(0, 5).join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 移动端单词卡片列表
 * 优化长列表的渲染性能
 */
export interface MobileWordCardListProps {
  words: Array<{
    word: CapturedWord;
    isMastered: boolean;
    isDefinitionOpen: boolean;
    isSelected: boolean;
  }>;
  showCheckbox?: boolean;
  onToggleMastered: (word: CapturedWord) => void;
  onToggleDefinition: (word: CapturedWord) => void;
  onEdit: (word: CapturedWord) => void;
  onDelete: (word: CapturedWord) => void;
  onMove: (word: CapturedWord) => void;
  onSelect?: (word: CapturedWord, selected: boolean) => void;
  onWordClick?: (word: string) => void;
  className?: string;
}

export function MobileWordCardList({
  words,
  showCheckbox = false,
  onToggleMastered,
  onToggleDefinition,
  onEdit,
  onDelete,
  onMove,
  onSelect,
  onWordClick,
  className,
}: MobileWordCardListProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {words.map(({ word, isMastered, isDefinitionOpen, isSelected }) => (
        <MobileWordCard
          key={word.id}
          word={word}
          isMastered={isMastered}
          isDefinitionOpen={isDefinitionOpen}
          isSelected={isSelected}
          showCheckbox={showCheckbox}
          onToggleMastered={() => onToggleMastered(word)}
          onToggleDefinition={() => onToggleDefinition(word)}
          onEdit={() => onEdit(word)}
          onDelete={() => onDelete(word)}
          onMove={() => onMove(word)}
          onSelect={onSelect ? (selected) => onSelect(word, selected === true) : undefined}
          onWordClick={() => onWordClick?.(word.word)}
        />
      ))}
    </div>
  );
}
