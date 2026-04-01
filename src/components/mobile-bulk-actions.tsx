"use client";

import React, { useState } from 'react';
import { X, Trash2, FolderInput, MoreVertical } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface BulkAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  color?: 'default' | 'destructive' | 'primary';
  onClick: () => void;
}

interface MobileBulkActionsProps {
  isActive: boolean;
  selectedCount: number;
  onClose: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export function MobileBulkActions({
  isActive,
  selectedCount,
  onClose,
  onSelectAll,
  onClearSelection,
  actions,
  className,
}: MobileBulkActionsProps) {
  const isMobile = useIsMobile();
  const [showMenu, setShowMenu] = useState(false);

  if (!isActive || !isMobile) return null;

  const mainAction = actions[0];
  const moreActions = actions.slice(1);

  return (
    <>
      {/* Selection bar */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg animate-in slide-in-from-bottom duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          {/* Selection info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              aria-label="退出批量选择"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <span className="font-medium">已选择 {selectedCount} 项</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button
                  onClick={onSelectAll}
                  className="hover:text-foreground transition-colors"
                >
                  全选
                </button>
                <span>·</span>
                <button
                  onClick={onClearSelection}
                  className="hover:text-foreground transition-colors"
                >
                  清空
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {mainAction && (
              <Button
                size="sm"
                className={cn(
                  "h-11 px-4",
                  mainAction.color === 'destructive' && "bg-destructive hover:bg-destructive/90"
                )}
                onClick={mainAction.onClick}
              >
                {mainAction.icon}
                <span className="ml-1 hidden sm:inline">{mainAction.label}</span>
              </Button>
            )}

            {moreActions.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => setShowMenu(!showMenu)}
                  aria-label="更多操作"
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>

                {/* Dropdown menu */}
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/20 animate-in fade-in duration-150"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute bottom-full right-0 mb-2 z-50 min-w-[160px] bg-popover rounded-lg shadow-lg border overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-100">
                      {moreActions.map((action, index) => (
                        <button
                          key={action.id}
                          onClick={() => {
                            action.onClick();
                            setShowMenu(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent",
                            action.color === 'destructive' && "text-destructive hover:text-destructive",
                            index !== moreActions.length - 1 && "border-b"
                          )}
                        >
                          {action.icon}
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Safe area padding for mobile */}
        <div className="h-safe-area-inset-bottom bg-background/95" />
      </div>
    </>
  );
}

// Hook to calculate safe area inset
export function useSafeAreaInset() {
  const [inset, setInset] = useState({ top: 0, bottom: 0 });

  React.useEffect(() => {
    // Get safe area insets from CSS environment variables
    const style = getComputedStyle(document.documentElement);
    const top = parseInt(style.getPropertyValue('--sat') || '0', 10);
    const bottom = parseInt(style.getPropertyValue('--sab') || '0', 10);
    setInset({ top, bottom });
  }, []);

  return inset;
}
