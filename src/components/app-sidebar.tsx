"use client";

import * as React from "react";
import { BookCopy, BookOpen, BookText, FileText, Mic, PlusSquare, type LucideIcon } from "lucide-react";

import { getPrimaryNavView, type AppView } from "@/lib/app-view";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  id: AppView;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { id: "capture", label: "新增单词", icon: PlusSquare },
  { id: "review", label: "单词本", icon: BookOpen },
  { id: "speaking", label: "听说训练", icon: Mic },
  { id: "article", label: "文章阅读", icon: BookText },
  { id: "essay", label: "作文批改", icon: FileText },
];

export function AppSidebar({
  view,
  onNavigate,
  busy = false,
}: {
  view: AppView;
  onNavigate: (view: AppView) => void;
  busy?: boolean;
}) {
  const active = getPrimaryNavView(view);
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="pt-3">
        <div className="flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookCopy className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-semibold leading-tight truncate">LexiCapture</div>
            <div className="text-xs text-muted-foreground truncate">AI 辅助英语学习</div>
          </div>
        </div>
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>功能</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={active === item.id}
                      tooltip={item.label}
                      disabled={busy}
                      onClick={() => {
                        onNavigate(item.id);
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-3">
        <div className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          快捷键：Ctrl/Cmd + B 切换侧边栏
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

