"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  renderInfographic,
  exportCanvasToDataURL,
  createDefaultUSP,
  createDefaultLogo,
  computeElementBounds,
  hitTest,
  getRendererScale,
  clearImageCache,
} from "@/lib/infographic-renderer";
import type { ElementBounds } from "@/lib/infographic-renderer";
import {
  BADGE_STYLES,
  OVERLAY_POSITIONS,
  PRESET_USPS,
  PRESET_COLORS,
  AI_INFOGRAPHIC_STYLES,
  ASPECT_RATIOS,
} from "@/lib/constants";
import type {
  USPElement,
  LogoElement,
  OverlayPosition,
  BadgeStyle,
  InfographicMode,
  AIInfographicStyle,
  AIInfographicStatus,
  AspectRatio,
} from "@/lib/types";
import { generateAIInfographic } from "@/lib/gemini";
import {
  Download,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  Layers,
  Sparkles,
  X,
  Upload,
  RotateCcw,
  Eye,
  Palette,
  Move,
  GripVertical,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Wand2,
  PenTool,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { EmojiPicker } from "./emoji-picker";

interface InfographicEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseImageSrc: string;
  poseName: string;
  productInfo?: string;
  apiKey?: string;
  /** Called whenever an infographic image is saved (downloaded), so the parent can persist it */
  onSave?: (imageDataUrl: string) => void;
}

interface DragState {
  elementId: string;
  elementType: "usp" | "logo";
  startCanvasX: number;
  startCanvasY: number;
  startOffsetX: number;
  startOffsetY: number;
}

export function InfographicEditor({
  open,
  onOpenChange,
  baseImageSrc,
  poseName,
  productInfo: initialProductInfo = "",
  apiKey = "",
  onSave,
}: InfographicEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Infographic mode: manual or AI
  const [infographicMode, setInfographicMode] = useState<InfographicMode>("manual");

  const [usps, setUSPs] = useState<USPElement[]>([]);
  const [logos, setLogos] = useState<LogoElement[]>([]);
  const [overlayDimming, setOverlayDimming] = useState(0);
  const [selectedUSPId, setSelectedUSPId] = useState<string | null>(null);
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // AI Infographic state
  const [aiProductInfo, setAiProductInfo] = useState(initialProductInfo);
  const [aiBrandName, setAiBrandName] = useState("");
  const [aiLogoFile, setAiLogoFile] = useState<File | null>(null);
  const [aiLogoPreview, setAiLogoPreview] = useState<string | null>(null);
  const [aiStyle, setAiStyle] = useState<AIInfographicStyle>("modern-minimal");
  const [aiAspectRatio, setAiAspectRatio] = useState<AspectRatio>("3:4");
  const [aiCustomInstructions, setAiCustomInstructions] = useState("");
  const [aiStatus, setAiStatus] = useState<AIInfographicStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGeneratedImages, setAiGeneratedImages] = useState<string[]>([]);
  const [aiSelectedImageIdx, setAiSelectedImageIdx] = useState(0);
  const aiLogoInputRef = useRef<HTMLInputElement>(null);

  // AI expanded image view
  const [aiExpandedView, setAiExpandedView] = useState(false);

  // Track previous baseImageSrc to reset AI state when switching images
  const prevBaseImageRef = useRef<string>("");

  // Reset AI generated results when a different base image is opened
  useEffect(() => {
    if (open && baseImageSrc && baseImageSrc !== prevBaseImageRef.current) {
      prevBaseImageRef.current = baseImageSrc;
      setAiGeneratedImages([]);
      setAiSelectedImageIdx(0);
      setAiStatus("idle");
      setAiError(null);
      setAiExpandedView(false);
    }
    if (!open) {
      prevBaseImageRef.current = "";
    }
  }, [open, baseImageSrc]);

  // Sync productInfo when prop changes
  useEffect(() => {
    setAiProductInfo(initialProductInfo);
  }, [initialProductInfo]);

  // Canvas expanded (fullscreen) state
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);

  // Drag-and-drop state
  const dragStateRef = useRef<DragState | null>(null);
  const elementBoundsRef = useRef<ElementBounds[]>([]);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const renderRafRef = useRef<number | null>(null);

  // Refs for current state (to avoid stale closures in event handlers)
  const uspsRef = useRef(usps);
  uspsRef.current = usps;
  const logosRef = useRef(logos);
  logosRef.current = logos;
  const overlayDimmingRef = useRef(overlayDimming);
  overlayDimmingRef.current = overlayDimming;

  const selectedUSP = usps.find((u) => u.id === selectedUSPId) ?? null;
  const selectedLogo = logos.find((l) => l.id === selectedLogoId) ?? null;

  // --- Coordinate conversion ---
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): { canvasX: number; canvasY: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const displayX = clientX - rect.left;
      const displayY = clientY - rect.top;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        canvasX: displayX * scaleX,
        canvasY: displayY * scaleY,
      };
    },
    []
  );

  // --- Re-render canvas ---
  const renderCanvas = useCallback(
    async (highlightId?: string | null) => {
      if (!canvasRef.current || !baseImageSrc) return;
      setIsRendering(true);
      try {
        await renderInfographic(
          canvasRef.current,
          baseImageSrc,
          uspsRef.current,
          logosRef.current,
          overlayDimmingRef.current,
          highlightId
        );
        // Update element bounds for hit-testing
        const bounds = await computeElementBounds(
          canvasRef.current,
          baseImageSrc,
          uspsRef.current,
          logosRef.current
        );
        elementBoundsRef.current = bounds;
      } catch (error) {
        console.error("Failed to render infographic:", error);
      }
      setIsRendering(false);
    },
    [baseImageSrc]
  );

  // Throttled render during drag (uses requestAnimationFrame)
  const requestRender = useCallback(
    (highlightId?: string | null) => {
      if (renderRafRef.current !== null) {
        cancelAnimationFrame(renderRafRef.current);
      }
      renderRafRef.current = requestAnimationFrame(() => {
        renderRafRef.current = null;
        renderCanvas(highlightId);
      });
    },
    [renderCanvas]
  );

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => renderCanvas(null), 100);
      return () => clearTimeout(t);
    } else {
      // Clean up image cache when editor closes
      clearImageCache();
    }
  }, [open, renderCanvas]);

  // Re-render when non-drag state changes
  useEffect(() => {
    if (open && !isDragging) {
      renderCanvas(hoveredElementId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usps, logos, overlayDimming, open]);

  // --- Drag-and-drop: Mouse handlers ---
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = clientToCanvas(e.clientX, e.clientY);
      if (!coords) return;

      const hit = hitTest(elementBoundsRef.current, coords.canvasX, coords.canvasY);
      if (!hit) return;

      e.preventDefault();

      // Find the element to get its current offsets
      let startOffsetX = 0;
      let startOffsetY = 0;
      if (hit.type === "usp") {
        const usp = uspsRef.current.find((u) => u.id === hit.id);
        if (usp) {
          startOffsetX = usp.offsetX;
          startOffsetY = usp.offsetY;
        }
      } else {
        const logo = logosRef.current.find((l) => l.id === hit.id);
        if (logo) {
          startOffsetX = logo.offsetX;
          startOffsetY = logo.offsetY;
        }
      }

      dragStateRef.current = {
        elementId: hit.id,
        elementType: hit.type,
        startCanvasX: coords.canvasX,
        startCanvasY: coords.canvasY,
        startOffsetX,
        startOffsetY,
      };
      setIsDragging(true);
    },
    [clientToCanvas]
  );

  // Double-click on canvas to open properties panel for the element
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = clientToCanvas(e.clientX, e.clientY);
      if (!coords) return;

      const hit = hitTest(elementBoundsRef.current, coords.canvasX, coords.canvasY);
      if (!hit) {
        // Double-click on empty area clears selection
        setSelectedUSPId(null);
        setSelectedLogoId(null);
        return;
      }

      if (hit.type === "usp") {
        setSelectedUSPId(hit.id);
        setSelectedLogoId(null);
      } else {
        setSelectedLogoId(hit.id);
        setSelectedUSPId(null);
      }
    },
    [clientToCanvas]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = clientToCanvas(e.clientX, e.clientY);
      if (!coords) return;

      const drag = dragStateRef.current;

      if (drag) {
        // Dragging -- compute delta in canvas space, convert to logical offset units
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rendererScale = getRendererScale(canvas.width, canvas.height);
        const deltaCanvasX = coords.canvasX - drag.startCanvasX;
        const deltaCanvasY = coords.canvasY - drag.startCanvasY;
        const deltaLogicalX = deltaCanvasX / rendererScale;
        const deltaLogicalY = deltaCanvasY / rendererScale;

        const newOffsetX = Math.round(drag.startOffsetX + deltaLogicalX);
        const newOffsetY = Math.round(drag.startOffsetY + deltaLogicalY);

        if (drag.elementType === "usp") {
          setUSPs((prev) =>
            prev.map((u) =>
              u.id === drag.elementId
                ? { ...u, offsetX: newOffsetX, offsetY: newOffsetY }
                : u
            )
          );
        } else {
          setLogos((prev) =>
            prev.map((l) =>
              l.id === drag.elementId
                ? { ...l, offsetX: newOffsetX, offsetY: newOffsetY }
                : l
            )
          );
        }

        requestRender(drag.elementId);
      } else {
        // Not dragging -- hover detection
        const hit = hitTest(elementBoundsRef.current, coords.canvasX, coords.canvasY);
        const newHoveredId = hit?.id ?? null;
        if (newHoveredId !== hoveredElementId) {
          setHoveredElementId(newHoveredId);
          requestRender(newHoveredId);
        }
      }
    },
    [clientToCanvas, hoveredElementId, requestRender]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (dragStateRef.current) {
      const id = dragStateRef.current.elementId;
      dragStateRef.current = null;
      setIsDragging(false);
      // Final render without highlight
      renderCanvas(null);
      // Keep element selected
      setHoveredElementId(null);
      // Ensure the element stays selected for further editing
      void id;
    }
  }, [renderCanvas]);

  const handleCanvasMouseLeave = useCallback(() => {
    if (!dragStateRef.current) {
      setHoveredElementId(null);
      requestRender(null);
    }
  }, [requestRender]);

  // --- Drag-and-drop: Touch handlers ---
  const handleCanvasTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const coords = clientToCanvas(touch.clientX, touch.clientY);
      if (!coords) return;

      const hit = hitTest(elementBoundsRef.current, coords.canvasX, coords.canvasY);
      if (!hit) return;

      e.preventDefault();

      let startOffsetX = 0;
      let startOffsetY = 0;
      if (hit.type === "usp") {
        const usp = uspsRef.current.find((u) => u.id === hit.id);
        if (usp) {
          startOffsetX = usp.offsetX;
          startOffsetY = usp.offsetY;
        }
      } else {
        const logo = logosRef.current.find((l) => l.id === hit.id);
        if (logo) {
          startOffsetX = logo.offsetX;
          startOffsetY = logo.offsetY;
        }
      }

      dragStateRef.current = {
        elementId: hit.id,
        elementType: hit.type,
        startCanvasX: coords.canvasX,
        startCanvasY: coords.canvasY,
        startOffsetX,
        startOffsetY,
      };
      setIsDragging(true);
    },
    [clientToCanvas]
  );

  const handleCanvasTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const drag = dragStateRef.current;
      if (!drag || e.touches.length !== 1) return;

      e.preventDefault();
      const touch = e.touches[0];
      const coords = clientToCanvas(touch.clientX, touch.clientY);
      if (!coords) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rendererScale = getRendererScale(canvas.width, canvas.height);
      const deltaCanvasX = coords.canvasX - drag.startCanvasX;
      const deltaCanvasY = coords.canvasY - drag.startCanvasY;
      const deltaLogicalX = deltaCanvasX / rendererScale;
      const deltaLogicalY = deltaCanvasY / rendererScale;

      const newOffsetX = Math.round(drag.startOffsetX + deltaLogicalX);
      const newOffsetY = Math.round(drag.startOffsetY + deltaLogicalY);

      if (drag.elementType === "usp") {
        setUSPs((prev) =>
          prev.map((u) =>
            u.id === drag.elementId
              ? { ...u, offsetX: newOffsetX, offsetY: newOffsetY }
              : u
          )
        );
      } else {
        setLogos((prev) =>
          prev.map((l) =>
            l.id === drag.elementId
              ? { ...l, offsetX: newOffsetX, offsetY: newOffsetY }
              : l
          )
        );
      }

      requestRender(drag.elementId);
    },
    [clientToCanvas, requestRender]
  );

  const handleCanvasTouchEnd = useCallback(() => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      setIsDragging(false);
      renderCanvas(null);
      setHoveredElementId(null);
    }
  }, [renderCanvas]);

  // Global mouse up handler (in case mouse leaves canvas while dragging)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        setIsDragging(false);
        renderCanvas(null);
        setHoveredElementId(null);
      }
    };

    if (isDragging) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("touchend", handleGlobalMouseUp);
      return () => {
        window.removeEventListener("mouseup", handleGlobalMouseUp);
        window.removeEventListener("touchend", handleGlobalMouseUp);
      };
    }
  }, [isDragging, renderCanvas]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (renderRafRef.current !== null) {
        cancelAnimationFrame(renderRafRef.current);
      }
    };
  }, []);

  // Escape key to close expanded canvas
  useEffect(() => {
    if (!isCanvasExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // Prevent Dialog from closing
        setIsCanvasExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCanvasExpanded]);

  // Escape key to close expanded AI image view
  useEffect(() => {
    if (!aiExpandedView) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAiExpandedView(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [aiExpandedView]);

  // --- Canvas cursor ---
  const canvasCursor = isDragging ? "grabbing" : hoveredElementId ? "grab" : "default";

  // --- USP Actions ---
  const addUSPFromPreset = (text: string, icon: string) => {
    const newUSP = createDefaultUSP(text, icon);
    const usedPositions = usps.map((u) => u.position);
    const availablePositions: OverlayPosition[] = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "top-center",
      "bottom-center",
      "middle-left",
      "middle-right",
      "middle-center",
    ];
    const nextPosition =
      availablePositions.find((p) => !usedPositions.includes(p)) || "top-left";
    newUSP.position = nextPosition;
    setUSPs((prev) => [...prev, newUSP]);
    setSelectedUSPId(newUSP.id);
  };

  const addCustomUSP = () => {
    const newUSP = createDefaultUSP("Custom USP", "✏️");
    const usedPositions = usps.map((u) => u.position);
    const availablePositions: OverlayPosition[] = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "top-center",
      "bottom-center",
      "middle-left",
      "middle-right",
      "middle-center",
    ];
    const nextPosition =
      availablePositions.find((p) => !usedPositions.includes(p)) || "top-left";
    newUSP.position = nextPosition;
    setUSPs((prev) => [...prev, newUSP]);
    setSelectedUSPId(newUSP.id);
  };

  const updateUSP = (id: string, update: Partial<USPElement>) => {
    setUSPs((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...update } : u))
    );
  };

  const removeUSP = (id: string) => {
    setUSPs((prev) => prev.filter((u) => u.id !== id));
    if (selectedUSPId === id) setSelectedUSPId(null);
  };

  // --- Logo Actions ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const newLogo = createDefaultLogo(file, preview);
    const usedPositions = logos.map((l) => l.position);
    const availablePositions: OverlayPosition[] = [
      "bottom-right",
      "bottom-left",
      "top-right",
      "top-left",
      "bottom-center",
      "top-center",
      "middle-right",
      "middle-left",
      "middle-center",
    ];
    newLogo.position =
      availablePositions.find((p) => !usedPositions.includes(p)) ||
      "bottom-right";
    setLogos((prev) => [...prev, newLogo]);
    setSelectedLogoId(newLogo.id);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const updateLogo = (id: string, update: Partial<LogoElement>) => {
    setLogos((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...update } : l))
    );
  };

  const removeLogo = (id: string) => {
    const logo = logos.find((l) => l.id === id);
    if (logo) URL.revokeObjectURL(logo.preview);
    setLogos((prev) => prev.filter((l) => l.id !== id));
    if (selectedLogoId === id) setSelectedLogoId(null);
  };

  // --- Export ---
  const handleDownload = async () => {
    if (!canvasRef.current) return;
    await renderCanvas(null);
    const dataURL = exportCanvasToDataURL(canvasRef.current, "png");
    onSave?.(dataURL);
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `infographic-${poseName}-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => {
    logos.forEach((l) => URL.revokeObjectURL(l.preview));
    setUSPs([]);
    setLogos([]);
    setOverlayDimming(0);
    setSelectedUSPId(null);
    setSelectedLogoId(null);
    setHoveredElementId(null);
  };

  // --- AI Infographic Actions ---
  const handleAILogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (aiLogoPreview) URL.revokeObjectURL(aiLogoPreview);
    setAiLogoFile(file);
    setAiLogoPreview(URL.createObjectURL(file));
    if (aiLogoInputRef.current) aiLogoInputRef.current.value = "";
  };

  const handleRemoveAILogo = () => {
    if (aiLogoPreview) URL.revokeObjectURL(aiLogoPreview);
    setAiLogoFile(null);
    setAiLogoPreview(null);
  };

  const handleAIGenerate = async () => {
    if (!apiKey) {
      setAiError("API key is required. Please enter it in Step 4.");
      return;
    }
    if (!baseImageSrc) {
      setAiError("No base image available.");
      return;
    }

    setAiStatus("generating");
    setAiError(null);

    try {
      const result = await generateAIInfographic({
        apiKey,
        baseImageData: baseImageSrc,
        productInfo: aiProductInfo,
        brandName: aiBrandName || undefined,
        logoFile: aiLogoFile || undefined,
        style: aiStyle,
        customInstructions: aiCustomInstructions || undefined,
        aspectRatio: aiAspectRatio,
      });
      setAiGeneratedImages((prev) => [result.imageData, ...prev]);
      setAiSelectedImageIdx(0);
      setAiStatus("completed");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate infographic");
      setAiStatus("error");
    }
  };

  const handleAIDownload = (imageData?: string) => {
    const src = imageData || aiGeneratedImages[aiSelectedImageIdx];
    if (!src) return;
    onSave?.(src);
    const link = document.createElement("a");
    link.href = src;
    link.download = `ai-infographic-${poseName}-${Date.now()}.png`;
    link.click();
  };

  const hasElements = usps.length > 0 || logos.length > 0;

  // --- Reusable editor panels (used in both normal and expanded views) ---

  const renderUSPEditorControls = () => {
    if (!selectedUSP) return null;
    return (
      <div className="space-y-4">
        {/* Text */}
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <Input
            value={selectedUSP.text}
            onChange={(e) =>
              updateUSP(selectedUSP.id, { text: e.target.value })
            }
            className="h-8 text-xs rounded-lg"
          />
        </div>

        {/* Icon */}
        <div className="space-y-1.5">
          <Label className="text-xs">Icon (emoji)</Label>
          <EmojiPicker
            value={selectedUSP.icon || ""}
            onChange={(emoji) =>
              updateUSP(selectedUSP.id, { icon: emoji })
            }
          />
        </div>

        {/* Position */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Move className="w-3 h-3" />
            Position
          </Label>
          <Select
            value={selectedUSP.position}
            onValueChange={(v) =>
              updateUSP(selectedUSP.id, {
                position: v as OverlayPosition,
                offsetX: 0,
                offsetY: 0,
              })
            }
          >
            <SelectTrigger className="h-8 text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OVERLAY_POSITIONS.map((pos) => (
                <SelectItem key={pos.value} value={pos.value} className="text-xs">
                  {pos.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Or drag the element directly on the image
          </p>
        </div>

        {/* Fine-tune offset */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Offset X</Label>
            <Slider
              value={[selectedUSP.offsetX]}
              onValueChange={([v]) =>
                updateUSP(selectedUSP.id, { offsetX: v })
              }
              min={-400}
              max={400}
              step={5}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              {selectedUSP.offsetX}px
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Offset Y</Label>
            <Slider
              value={[selectedUSP.offsetY]}
              onValueChange={([v]) =>
                updateUSP(selectedUSP.id, { offsetY: v })
              }
              min={-400}
              max={400}
              step={5}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              {selectedUSP.offsetY}px
            </p>
          </div>
        </div>

        {/* Badge Style */}
        <div className="space-y-1.5">
          <Label className="text-xs">Badge Style</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {BADGE_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() =>
                  updateUSP(selectedUSP.id, {
                    style: style.value as BadgeStyle,
                  })
                }
                className={cn(
                  "px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors border",
                  selectedUSP.style === style.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-border"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-1.5">
          <Label className="text-xs">Font Size: {selectedUSP.fontSize}px</Label>
          <Slider
            value={[selectedUSP.fontSize]}
            onValueChange={([v]) =>
              updateUSP(selectedUSP.id, { fontSize: v })
            }
            min={10}
            max={48}
            step={1}
          />
        </div>

        {/* Text Color */}
        <div className="space-y-1.5">
          <Label className="text-xs">Text Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.slice(0, 10).map((color) => (
              <button
                key={`text-${color}`}
                onClick={() =>
                  updateUSP(selectedUSP.id, { textColor: color })
                }
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                  selectedUSP.textColor === color
                    ? "border-primary scale-110"
                    : "border-border"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={selectedUSP.textColor}
                onChange={(e) =>
                  updateUSP(selectedUSP.id, { textColor: e.target.value })
                }
                className="w-6 h-6 rounded-full cursor-pointer opacity-0 absolute inset-0"
              />
              <div
                className="w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center"
                style={{
                  background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Background Color */}
        <div className="space-y-1.5">
          <Label className="text-xs">Background Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.slice(0, 10).map((color) => (
              <button
                key={`bg-${color}`}
                onClick={() =>
                  updateUSP(selectedUSP.id, { bgColor: color })
                }
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                  selectedUSP.bgColor === color
                    ? "border-primary scale-110"
                    : "border-border"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={selectedUSP.bgColor}
                onChange={(e) =>
                  updateUSP(selectedUSP.id, { bgColor: e.target.value })
                }
                className="w-6 h-6 rounded-full cursor-pointer opacity-0 absolute inset-0"
              />
              <div
                className="w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center"
                style={{
                  background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Background Opacity */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Background Opacity: {Math.round(selectedUSP.bgOpacity * 100)}%
          </Label>
          <Slider
            value={[selectedUSP.bgOpacity]}
            onValueChange={([v]) =>
              updateUSP(selectedUSP.id, { bgOpacity: v })
            }
            min={0}
            max={1}
            step={0.05}
          />
        </div>

        {/* Delete */}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => removeUSP(selectedUSP.id)}
          className="w-full gap-1.5 rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove USP
        </Button>
      </div>
    );
  };

  const renderLogoEditorControls = () => {
    if (!selectedLogo) return null;
    return (
      <div className="space-y-4">
        {/* Preview */}
        <div className="flex justify-center p-3 bg-muted/30 rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedLogo.preview}
            alt="Logo preview"
            className="max-w-[120px] max-h-[80px] object-contain"
          />
        </div>

        {/* Position */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Move className="w-3 h-3" />
            Position
          </Label>
          <Select
            value={selectedLogo.position}
            onValueChange={(v) =>
              updateLogo(selectedLogo.id, {
                position: v as OverlayPosition,
                offsetX: 0,
                offsetY: 0,
              })
            }
          >
            <SelectTrigger className="h-8 text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OVERLAY_POSITIONS.map((pos) => (
                <SelectItem key={pos.value} value={pos.value} className="text-xs">
                  {pos.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Or drag the logo directly on the image
          </p>
        </div>

        {/* Fine-tune offset */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Offset X</Label>
            <Slider
              value={[selectedLogo.offsetX]}
              onValueChange={([v]) =>
                updateLogo(selectedLogo.id, { offsetX: v })
              }
              min={-400}
              max={400}
              step={5}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              {selectedLogo.offsetX}px
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Offset Y</Label>
            <Slider
              value={[selectedLogo.offsetY]}
              onValueChange={([v]) =>
                updateLogo(selectedLogo.id, { offsetY: v })
              }
              min={-400}
              max={400}
              step={5}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              {selectedLogo.offsetY}px
            </p>
          </div>
        </div>

        {/* Size */}
        <div className="space-y-1.5">
          <Label className="text-xs">Size: {selectedLogo.size}px</Label>
          <Slider
            value={[selectedLogo.size]}
            onValueChange={([v]) =>
              updateLogo(selectedLogo.id, { size: v })
            }
            min={20}
            max={300}
            step={5}
          />
        </div>

        {/* Opacity */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Opacity: {Math.round(selectedLogo.opacity * 100)}%
          </Label>
          <Slider
            value={[selectedLogo.opacity]}
            onValueChange={([v]) =>
              updateLogo(selectedLogo.id, { opacity: v })
            }
            min={0.1}
            max={1}
            step={0.05}
          />
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={() => removeLogo(selectedLogo.id)}
          className="w-full gap-1.5 rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove Logo
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
          "p-0 gap-0 overflow-hidden transition-all duration-200",
          isCanvasExpanded
            ? "max-w-none w-screen h-screen rounded-none border-none"
            : "max-w-[95vw] w-[1200px] max-h-[90vh]"
        )}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Infographic Editor
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {infographicMode === "manual"
                    ? "Add USP badges & logos — drag to reposition"
                    : "AI-powered infographic generation"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mode Toggle */}
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                <button
                  onClick={() => setInfographicMode("manual")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    infographicMode === "manual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Manual
                </button>
                <button
                  onClick={() => setInfographicMode("ai")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    infographicMode === "ai"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  AI
                </button>
              </div>

              {infographicMode === "manual" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="gap-1.5 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownload}
                    className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {infographicMode === "manual" ? (
          /* ═══ MANUAL MODE ═══ */
          <div className={cn(
            "flex flex-col md:flex-row overflow-hidden",
            isCanvasExpanded ? "flex-1 min-h-0" : "h-[calc(90vh-80px)]"
          )}>
          {/* Left: Canvas Preview / Fullscreen Canvas */}
          <div
            ref={canvasContainerRef}
            className={cn(
              "flex flex-col items-center relative",
              isCanvasExpanded
                ? "fixed inset-0 z-[200] bg-background/95 backdrop-blur-md"
                : "flex-1 min-w-0 bg-muted/30 p-5 justify-center"
            )}
          >
            {/* Expanded mode: top toolbar (outside canvas, no overlap) */}
            {isCanvasExpanded && (
              <div className="w-full flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-background/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                    <Maximize2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary dark:text-primary">
                      Expanded View
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Drag elements on the image to reposition
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownload}
                    className="gap-1.5 text-xs rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsCanvasExpanded(false)}
                    variant="outline"
                    className="gap-1.5 text-xs rounded-lg"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    Minimize
                  </Button>
                </div>
              </div>
            )}

            {/* Main content area: canvas + optional side panel */}
            <div
              className={cn(
                isCanvasExpanded
                  ? "flex-1 min-h-0 w-full flex flex-row"
                  : "flex items-center justify-center relative w-full"
              )}
            >
              {/* Canvas container - always takes remaining space */}
              <div
                className={cn(
                  "flex items-center justify-center relative",
                  isCanvasExpanded
                    ? "flex-1 min-w-0 h-full p-5"
                    : "w-full"
                )}
              >
                {isRendering && !isDragging && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Rendering...
                    </div>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className={cn(
                    "object-contain rounded-lg shadow-lg",
                    isCanvasExpanded
                      ? "max-w-full max-h-full"
                      : "max-w-full max-h-[calc(90vh-160px)]"
                  )}
                  style={{ imageRendering: "auto", cursor: canvasCursor }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                  onDoubleClick={handleCanvasDoubleClick}
                  onTouchStart={handleCanvasTouchStart}
                  onTouchMove={handleCanvasTouchMove}
                  onTouchEnd={handleCanvasTouchEnd}
                />
              </div>

              {/* Expanded mode: properties panel beside the canvas (not overlaying it) */}
              {isCanvasExpanded && (selectedUSP || selectedLogo) && (
                <div className="w-[320px] flex-shrink-0 h-full flex flex-col border-l border-border bg-card shadow-xl animate-in slide-in-from-right-4 duration-200">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedUSP && (
                        <>
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-[11px] flex-shrink-0"
                            style={{
                              backgroundColor: selectedUSP.bgColor,
                              color: selectedUSP.textColor,
                            }}
                          >
                            {selectedUSP.icon || "T"}
                          </div>
                          <span className="text-xs font-semibold truncate">
                            {selectedUSP.text}
                          </span>
                        </>
                      )}
                      {selectedLogo && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedLogo.preview}
                            alt="Logo"
                            className="w-5 h-5 object-contain rounded flex-shrink-0"
                          />
                          <span className="text-xs font-semibold truncate">
                            {selectedLogo.file.name}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUSPId(null);
                        setSelectedLogoId(null);
                      }}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      title="Close panel"
                    >
                      <PanelRightClose className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Panel content - scrollable */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="p-5">
                      {renderUSPEditorControls()}
                      {renderLogoEditorControls()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom hints & expand button (outside canvas, no overlap) */}
            <div
              className={cn(
                "flex-shrink-0 flex items-center justify-center gap-3",
                isCanvasExpanded ? "py-2.5 border-t border-border w-full bg-background/80" : "mt-2 pb-1"
              )}
            >
              {hasElements && !isDragging && !isCanvasExpanded && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  <GripVertical className="w-3 h-3" />
                  <span>Drag elements to reposition</span>
                </div>
              )}
              {isDragging && (
                <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <Move className="w-3 h-3" />
                  <span>Release to place</span>
                </div>
              )}
              {!isDragging && !isCanvasExpanded && (
                <button
                  onClick={() => setIsCanvasExpanded(true)}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expand for easier editing</span>
                </button>
              )}
              {!isDragging && isCanvasExpanded && (
                <span className="text-[11px] text-muted-foreground/70">
                  Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[11px] font-mono">Esc</kbd> to minimize
                  {hasElements && " · Double-click an element to edit its properties"}
                </span>
              )}
            </div>
          </div>

          {/* Right: Controls Panel */}
          <div className="w-full md:w-[380px] border-t md:border-t-0 md:border-l border-border flex flex-col">
            <Tabs defaultValue="usps" className="flex flex-col h-full">
              <TabsList className="mx-4 mt-3 grid grid-cols-3">
                <TabsTrigger value="usps" className="gap-1.5 text-xs">
                  <Type className="w-3.5 h-3.5" />
                  USPs
                </TabsTrigger>
                <TabsTrigger value="logos" className="gap-1.5 text-xs">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Logos
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-1.5 text-xs">
                  <Palette className="w-3.5 h-3.5" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* USPs Tab */}
              <TabsContent
                value="usps"
                className="flex-1 overflow-hidden mt-0"
              >
                <ScrollArea className="h-full">
                  <div className="p-5 space-y-4">
                    {/* Preset USPs */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Quick Add Presets
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_USPS.map((preset) => (
                          <button
                            key={preset.text}
                            onClick={() =>
                              addUSPFromPreset(preset.text, preset.icon)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border hover:border-border"
                          >
                            <span>{preset.icon}</span>
                            <span>{preset.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground">or</span>
                      <Separator className="flex-1" />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCustomUSP}
                      className="w-full gap-1.5 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Custom USP
                    </Button>

                    {/* Added USPs List */}
                    {usps.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Added USPs ({usps.length})
                        </Label>
                        <div className="space-y-1.5">
                          {usps.map((usp) => (
                            <div
                              key={usp.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                                selectedUSPId === usp.id
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-border"
                              )}
                              onClick={() => {
                                setSelectedUSPId(usp.id);
                                setSelectedLogoId(null);
                              }}
                            >
                              <div
                                className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
                                style={{
                                  backgroundColor: usp.bgColor,
                                  color: usp.textColor,
                                }}
                              >
                                {usp.icon || "T"}
                              </div>
                              <span className="text-xs font-medium truncate flex-1">
                                {usp.text}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeUSP(usp.id);
                                }}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected USP Editor */}
                    {selectedUSP && (
                      <div className="space-y-4 pt-2">
                        <Separator />
                        <div className="flex items-center gap-2">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Edit: {selectedUSP.text}
                          </Label>
                        </div>
                        {renderUSPEditorControls()}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Logos Tab */}
              <TabsContent
                value="logos"
                className="flex-1 overflow-hidden mt-0"
              >
                <ScrollArea className="h-full">
                  <div className="p-5 space-y-4">
                    {/* Upload Logo */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Upload Logo
                      </Label>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        className="w-full gap-1.5 rounded-lg"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Logo Image
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        PNG with transparent background recommended
                      </p>
                    </div>

                    {/* Logo List */}
                    {logos.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Added Logos ({logos.length})
                        </Label>
                        <div className="space-y-1.5">
                          {logos.map((logo) => (
                            <div
                              key={logo.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                                selectedLogoId === logo.id
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-border"
                              )}
                              onClick={() => {
                                setSelectedLogoId(logo.id);
                                setSelectedUSPId(null);
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={logo.preview}
                                alt="Logo"
                                className="w-8 h-8 object-contain rounded bg-muted flex-shrink-0"
                              />
                              <span className="text-xs font-medium truncate flex-1">
                                {logo.file.name}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeLogo(logo.id);
                                }}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected Logo Editor */}
                    {selectedLogo && (
                      <div className="space-y-4 pt-2">
                        <Separator />
                        <div className="flex items-center gap-2">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Edit Logo
                          </Label>
                        </div>
                        {renderLogoEditorControls()}
                      </div>
                    )}

                    {logos.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                          <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          No logos added yet. Upload a logo image to get
                          started.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent
                value="settings"
                className="flex-1 overflow-hidden mt-0"
              >
                <ScrollArea className="h-full">
                  <div className="p-5 space-y-4">
                    {/* Overlay Dimming */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Background Dimming
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Darken the base image to make text and logos stand out
                        more
                      </p>
                      <Slider
                        value={[overlayDimming]}
                        onValueChange={([v]) => setOverlayDimming(v)}
                        min={0}
                        max={0.6}
                        step={0.05}
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        {Math.round(overlayDimming * 100)}%
                      </p>
                    </div>

                    <Separator />

                    {/* Summary */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Elements Summary
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Type className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs">USP Badges</span>
                          </div>
                          <Badge variant="secondary" className="text-[11px]">
                            {usps.length}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs">Logos</span>
                          </div>
                          <Badge variant="secondary" className="text-[11px]">
                            {logos.length}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Drag info */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Positioning
                      </Label>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground">
                              Drag & Drop
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Click and drag any USP badge or logo directly on
                              the image to reposition it. You can also use the
                              Position dropdown and offset sliders for precise
                              control.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Export Options */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Export
                      </Label>
                      <Button
                        onClick={handleDownload}
                        className="w-full gap-1.5 rounded-lg bg-primary hover:bg-primary/90"
                      >
                        <Download className="w-4 h-4" />
                        Download Infographic (PNG)
                      </Button>
                    </div>

                    <Separator />

                    {/* Reset */}
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="w-full gap-1.5 rounded-lg text-destructive hover:bg-destructive/5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset All Elements
                    </Button>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        ) : (
          /* ═══ AI MODE ═══ */
          <div className="flex flex-col md:flex-row overflow-hidden h-[calc(90vh-80px)]">
            {/* Expanded AI image overlay */}
            {aiExpandedView && aiGeneratedImages.length > 0 && (
              <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-md flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-background/80">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                      <Maximize2 className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary dark:text-primary">
                        Expanded View
                      </span>
                    </div>
                    {aiGeneratedImages.length > 1 && (
                      <div className="flex items-center gap-1">
                        {aiGeneratedImages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setAiSelectedImageIdx(idx)}
                            className={cn(
                              "w-8 h-8 rounded-md border-2 overflow-hidden transition-all",
                              idx === aiSelectedImageIdx
                                ? "border-primary"
                                : "border-border opacity-50 hover:opacity-100"
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={aiGeneratedImages[idx]} alt={`V${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAIDownload()}
                      className="gap-1.5 text-xs rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAiExpandedView(false)}
                      className="gap-1.5 text-xs rounded-lg"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      Minimize
                    </Button>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 min-h-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={aiGeneratedImages[aiSelectedImageIdx]}
                    alt="AI Generated Infographic"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
                <div className="flex-shrink-0 flex items-center justify-center py-2.5 border-t border-border bg-background/80">
                  <span className="text-[11px] text-muted-foreground/70">
                    Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[11px] font-mono">Esc</kbd> to minimize
                  </span>
                </div>
              </div>
            )}

            {/* Left: Preview / Results Area */}
            <div className="flex-1 min-w-0 bg-muted/30 flex flex-col overflow-hidden">
              {aiGeneratedImages.length > 0 ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Main preview */}
                  <div className="flex-1 flex items-center justify-center p-5 min-h-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={aiGeneratedImages[aiSelectedImageIdx]}
                      alt="AI Generated Infographic"
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-pointer"
                      onClick={() => setAiExpandedView(true)}
                    />
                  </div>

                  {/* Thumbnails + actions */}
                  <div className="flex-shrink-0 border-t border-border bg-card/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {aiGeneratedImages.length > 1 && (
                          <div className="flex items-center gap-1.5">
                            {aiGeneratedImages.map((img, idx) => (
                              <button
                                key={idx}
                                onClick={() => setAiSelectedImageIdx(idx)}
                                className={cn(
                                  "w-12 h-12 rounded-lg border-2 overflow-hidden transition-all",
                                  idx === aiSelectedImageIdx
                                    ? "border-primary shadow-md"
                                    : "border-border hover:border-border opacity-60 hover:opacity-100"
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img}
                                  alt={`Variation ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                        <Badge variant="secondary" className="text-[11px]">
                          {aiGeneratedImages.length} generated
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAiExpandedView(true)}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border"
                        >
                          <Maximize2 className="w-3 h-3" />
                          Expand
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAIDownload()}
                          className="gap-1.5 text-xs rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-5">
                  {aiStatus === "generating" ? (
                    <div className="flex flex-col items-center gap-5">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">Generating infographic...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          AI is designing your product infographic
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-5 max-w-sm text-center">
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 flex items-center justify-center">
                        <Wand2 className="w-10 h-10 text-primary/40" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          AI Infographic Generator
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                          Configure your design preferences on the right, then generate a professional product infographic powered by AI.
                        </p>
                      </div>
                      {/* Show the base image as a small preview */}
                      {baseImageSrc && (
                        <div className="mt-2 p-2 rounded-xl border border-border bg-card/50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={baseImageSrc}
                            alt="Base product image"
                            className="max-w-[200px] max-h-[200px] object-contain rounded-lg"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">Base product image</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: AI Controls Panel */}
            <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden">
              <ScrollArea className="h-0 flex-1">
                <div className="p-5 space-y-5">
                  {/* Product Information */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Product Features & USPs
                    </Label>
                    <Textarea
                      value={aiProductInfo}
                      onChange={(e) => setAiProductInfo(e.target.value)}
                      placeholder="e.g., 100% Organic Cotton, Breathable Fabric, UV Protection, Machine Washable, Sustainable Manufacturing..."
                      className="text-xs min-h-[100px] rounded-lg resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Key features, materials, certifications, and selling points to highlight. These come from Product Info in Step 1.
                    </p>
                  </div>

                  <Separator />

                  {/* Brand */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Branding
                    </Label>
                    <div className="space-y-2">
                      <Label className="text-xs">Brand Name</Label>
                      <Input
                        value={aiBrandName}
                        onChange={(e) => setAiBrandName(e.target.value)}
                        placeholder="e.g., Your Brand Name"
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Brand Logo</Label>
                      <input
                        ref={aiLogoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAILogoUpload}
                        className="hidden"
                      />
                      {aiLogoPreview ? (
                        <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={aiLogoPreview}
                            alt="Brand logo"
                            className="w-10 h-10 object-contain rounded bg-background"
                          />
                          <span className="text-xs text-muted-foreground truncate flex-1">
                            {aiLogoFile?.name}
                          </span>
                          <button
                            onClick={handleRemoveAILogo}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => aiLogoInputRef.current?.click()}
                          className="w-full gap-1.5 rounded-lg"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Logo
                        </Button>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        PNG with transparent background recommended
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Design Style */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Design Style
                    </Label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {AI_INFOGRAPHIC_STYLES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setAiStyle(s.value)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                            aiStyle === s.value
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-border"
                          )}
                        >
                          <span className="text-lg flex-shrink-0">{s.icon}</span>
                          <div className="min-w-0">
                            <p className={cn(
                              "text-xs font-medium",
                              aiStyle === s.value ? "text-primary dark:text-primary" : "text-foreground"
                            )}>
                              {s.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {s.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Aspect Ratio */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Aspect Ratio
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {ASPECT_RATIOS.map((ar) => (
                        <button
                          key={ar.value}
                          onClick={() => setAiAspectRatio(ar.value as AspectRatio)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            aiAspectRatio === ar.value
                              ? "border-primary bg-primary/10 text-primary dark:text-primary"
                              : "border-border text-muted-foreground hover:border-border"
                          )}
                        >
                          {ar.value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Custom Instructions */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Custom Instructions (Optional)
                    </Label>
                    <Textarea
                      value={aiCustomInstructions}
                      onChange={(e) => setAiCustomInstructions(e.target.value)}
                      placeholder="e.g., Use a dark background, emphasize eco-friendly features, include a call-to-action..."
                      className="text-xs min-h-[60px] rounded-lg resize-none"
                    />
                  </div>

                  <Separator />

                  {/* Error */}
                  {aiError && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-xs text-destructive">{aiError}</p>
                    </div>
                  )}

                  {/* Generate Button */}
                  <Button
                    onClick={handleAIGenerate}
                    disabled={aiStatus === "generating" || !apiKey}
                    className="w-full gap-2 rounded-lg bg-primary hover:bg-primary/90 h-10"
                  >
                    {aiStatus === "generating" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : aiGeneratedImages.length > 0 ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Generate Another Variation
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Generate Infographic
                      </>
                    )}
                  </Button>

                  {!apiKey && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                      API key required — enter it in Step 4 (Details)
                    </p>
                  )}

                  {/* Download all variations */}
                  {aiGeneratedImages.length > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        All Variations ({aiGeneratedImages.length})
                      </Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {aiGeneratedImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <button
                              onClick={() => setAiSelectedImageIdx(idx)}
                              className={cn(
                                "w-full aspect-square rounded-lg border-2 overflow-hidden transition-colors",
                                idx === aiSelectedImageIdx
                                  ? "border-primary shadow-md"
                                  : "border-border hover:border-border"
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={`Variation ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                            <button
                              onClick={() => handleAIDownload(img)}
                              className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
