"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import {
  Shirt,
  RefreshCw,
  Scissors,
  HelpCircle,
  Copy,
  Video,
  Sofa,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureMode } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS: {
  id: FeatureMode;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "vton",
    label: "Virtual Try-On",
    icon: Shirt,
    description: "AI fashion photography",
  },
  {
    id: "model-swap",
    label: "Model Swap",
    icon: RefreshCw,
    description: "Replace model in photos",
  },
  {
    id: "room-staging",
    label: "Room Staging",
    icon: Sofa,
    description: "AI interior product photography",
  },
  {
    id: "swatch",
    label: "Swatch",
    icon: Scissors,
    description: "Extract fabric swatches",
  },
  {
    id: "replicate",
    label: "Replicate Fast",
    icon: Copy,
    description: "Recreate from reference layout",
  },
  {
    id: "product-video",
    label: "Product Video",
    icon: Video,
    description: "AI product videos",
  },
];

interface AppSidebarProps {
  featureMode: FeatureMode;
  onFeatureModeChange: (mode: FeatureMode) => void;
  disabled?: boolean;
}

export function AppSidebar({
  featureMode,
  onFeatureModeChange,
  disabled,
}: AppSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pt-5 pb-3">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <img
            src="https://cdn-catalogus.s3.ap-south-1.amazonaws.com/assets/logo.png"
            alt="Catalogus"
            className="h-9 w-9 shrink-0 object-contain"
          />
          <img
            src="https://cdn-catalogus.s3.ap-south-1.amazonaws.com/assets/catalogus.png"
            alt="Catalogus"
            className={cn(
              "h-7 object-contain transition-all duration-300 dark:invert",
              isCollapsed && "opacity-0 w-0"
            )}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = featureMode === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      onClick={() => onFeatureModeChange(item.id)}
                      disabled={disabled}
                      className={cn(
                        "relative h-auto py-2.5 px-3 rounded-xl transition-all duration-200 group/nav",
                        isActive
                          ? "bg-primary/10 text-foreground font-medium"
                          : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-primary to-primary/60" />
                      )}
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground group-hover/nav:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      {!isCollapsed && (
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm truncate">{item.label}</span>
                          <span
                            className={cn(
                              "text-[11px] leading-tight truncate transition-colors",
                              isActive
                                ? "text-muted-foreground"
                                : "text-muted-foreground/50"
                            )}
                          >
                            {item.description}
                          </span>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 mt-auto">
        <div
          className={cn(
            "flex items-center gap-1",
            isCollapsed ? "justify-center" : "justify-end"
          )}
        >
          {!isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://catalogus.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top">Help & Support</TooltipContent>
            </Tooltip>
          )}
          <ThemeToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
