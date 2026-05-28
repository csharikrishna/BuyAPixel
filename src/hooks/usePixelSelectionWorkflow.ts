import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { RefObject } from "react";
import type { SelectedPixel } from "@/types/grid";
import { calculatePixelPrice } from "@/utils/gridConstants";
import {
  createSelectedPixel,
  summarizeSelectionRejections,
  validatePixelSelection,
} from "@/utils/gridDomain";
import type { PixelSelectionValidationResult } from "@/utils/gridDomain";

type Mode = "idle" | "buying" | "selling";

interface PixelDraft {
  pixels: SelectedPixel[];
  timestamp: number;
  version: number;
}

interface SelectionValidationHandle {
  validateSelection: (pixels: SelectedPixel[]) => PixelSelectionValidationResult;
}

interface UsePixelSelectionWorkflowOptions {
  gridRef: RefObject<SelectionValidationHandle>;
  canvasWidth: number;
  canvasHeight: number;
  maxPixelsPerPurchase: number;
  draftStorageKey: string;
  draftExpiryHours: number;
  selectionHistoryLimit: number;
  autosaveDebounceMs: number;
}

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };

  return debounced as T & { cancel: () => void };
}

function parseDraft(draftString: string | null): PixelDraft | null {
  if (!draftString) return null;

  try {
    const draft = JSON.parse(draftString) as PixelDraft;

    if (
      !draft.pixels ||
      !Array.isArray(draft.pixels) ||
      typeof draft.timestamp !== "number"
    ) {
      return null;
    }

    return draft;
  } catch (error: unknown) {
    console.error("Failed to parse draft:", error);
    return null;
  }
}

function isDraftExpired(draft: PixelDraft, draftExpiryHours: number): boolean {
  const expiryTime = Date.now() - draftExpiryHours * 60 * 60 * 1000;
  return draft.timestamp <= expiryTime;
}

function areSelectionsEqual(a: SelectedPixel[], b: SelectedPixel[]): boolean {
  return a.length === b.length && a.every((pixel, index) => pixel.id === b[index]?.id);
}

export function usePixelSelectionWorkflow({
  gridRef,
  canvasWidth,
  canvasHeight,
  maxPixelsPerPurchase,
  draftStorageKey,
  draftExpiryHours,
  selectionHistoryLimit,
  autosaveDebounceMs,
}: UsePixelSelectionWorkflowOptions) {
  const [selectedPixels, setSelectedPixels] = useState<SelectedPixel[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionHistory, setSelectionHistory] = useState<SelectedPixel[][]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDraftRestorePrompt, setShowDraftRestorePrompt] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<PixelDraft | null>(null);

  const totalCost = useMemo(() => {
    return selectedPixels.reduce((sum, pixel) => sum + pixel.price, 0);
  }, [selectedPixels]);

  const validateSelection = useCallback(
    (pixels: SelectedPixel[]) =>
      gridRef.current?.validateSelection(pixels) ??
      validatePixelSelection(pixels, {
        gridWidth: canvasWidth,
        gridHeight: canvasHeight,
        getPixelPrice: calculatePixelPrice,
      }),
    [gridRef, canvasWidth, canvasHeight]
  );

  const saveDraft = useMemo(
    () =>
      debounce((pixels: SelectedPixel[]) => {
        if (pixels.length === 0) {
          localStorage.removeItem(draftStorageKey);
          return;
        }

        const draft: PixelDraft = {
          pixels,
          timestamp: Date.now(),
          version: 1,
        };

        try {
          localStorage.setItem(draftStorageKey, JSON.stringify(draft));
        } catch (error: unknown) {
          console.error("Failed to save draft:", error);
          if (error instanceof DOMException && error.name === "QuotaExceededError") {
            toast.error("Storage limit reached", {
              description: "Unable to auto-save selection",
            });
          }
        }
      }, autosaveDebounceMs),
    [autosaveDebounceMs, draftStorageKey]
  );

  useEffect(() => {
    if (mode === "buying" && selectedPixels.length > 0) {
      saveDraft(selectedPixels);
    }
  }, [selectedPixels, mode, saveDraft]);

  useEffect(() => {
    return () => saveDraft.cancel();
  }, [saveDraft]);

  useEffect(() => {
    const draftString = localStorage.getItem(draftStorageKey);
    const draft = parseDraft(draftString);

    if (!draft || isDraftExpired(draft, draftExpiryHours)) {
      localStorage.removeItem(draftStorageKey);
      return;
    }

    if (draft.pixels.length > 0) {
      setDraftToRestore(draft);
      setShowDraftRestorePrompt(true);
    }
  }, [draftStorageKey, draftExpiryHours]);

  const handleSelectionChange = useCallback(
    (pixels: SelectedPixel[]): PixelSelectionValidationResult => {
      const validation = validateSelection(pixels);

      if (mode !== "buying") return validation;

      const nextPixels = validation.accepted;

      if (nextPixels.length > maxPixelsPerPurchase) {
        toast.warning(`Maximum ${maxPixelsPerPurchase} pixels per purchase`, {
          description: "Please reduce your selection",
        });
        return {
          accepted: selectedPixels,
          rejected: validation.rejected,
        };
      }

      if (!areSelectionsEqual(nextPixels, selectedPixels)) {
        setSelectionHistory((prev) =>
          [...prev, selectedPixels].slice(-selectionHistoryLimit)
        );
        setSelectedPixels(nextPixels);
      }

      return validation;
    },
    [
      mode,
      maxPixelsPerPurchase,
      selectedPixels,
      selectionHistoryLimit,
      validateSelection,
    ]
  );

  const handleUndoLastSelection = useCallback(() => {
    if (selectionHistory.length === 0) {
      toast.info("Nothing to undo");
      return;
    }

    const previousState = selectionHistory[selectionHistory.length - 1];

    setSelectedPixels(previousState);
    setSelectionHistory((prev) => prev.slice(0, -1));

    toast.success("Undo successful", {
      description: "Previous selection restored",
    });
  }, [selectionHistory]);

  const confirmClearSelection = useCallback(() => {
    if (selectedPixels.length > 0) {
      setSelectionHistory((prev) =>
        [...prev, selectedPixels].slice(-selectionHistoryLimit)
      );
    }

    setSelectedPixels([]);
    setShowClearDialog(false);
    localStorage.removeItem(draftStorageKey);

    toast.success("Selection cleared");
  }, [selectedPixels, selectionHistoryLimit, draftStorageKey]);

  const handleExitBuyingMode = useCallback(() => {
    setMode("idle");
    setIsSelecting(false);
    localStorage.removeItem(draftStorageKey);
    toast.info("Selection mode exited");
  }, [draftStorageKey]);

  const handleClearSelection = useCallback(() => {
    if (selectedPixels.length > 0) {
      setShowClearDialog(true);
    } else {
      handleExitBuyingMode();
    }
  }, [selectedPixels, handleExitBuyingMode]);

  const handleRestoreDraft = useCallback(() => {
    if (!draftToRestore) return;

    const validation = validateSelection(draftToRestore.pixels);
    const normalizedDraftPixels = validation.accepted;

    setSelectedPixels(normalizedDraftPixels);
    setMode("buying");
    setIsSelecting(true);
    setShowDraftRestorePrompt(false);

    toast.success("Draft restored!", {
      description: `${normalizedDraftPixels.length} pixels from your last session`,
    });

    if (validation.rejected.length) {
      toast.warning("Some draft pixels were skipped", {
        description: summarizeSelectionRejections(validation.rejected),
      });
    }
  }, [draftToRestore, validateSelection]);

  const handleDismissDraft = useCallback(() => {
    localStorage.removeItem(draftStorageKey);
    setShowDraftRestorePrompt(false);
    setDraftToRestore(null);
  }, [draftStorageKey]);

  const enterBuyingMode = useCallback(() => {
    setMode("buying");
    setIsSelecting(true);
  }, []);

  const toggleSelecting = useCallback(() => {
    setIsSelecting((current) => !current);
  }, []);

  const resetAfterPurchase = useCallback(() => {
    setSelectedPixels([]);
    setSelectionHistory([]);
    setMode("idle");
    setIsSelecting(false);
    localStorage.removeItem(draftStorageKey);
  }, [draftStorageKey]);

  const selectFocusedPixel = useCallback(
    (x: number, y: number) => {
      const validation = validateSelection([createSelectedPixel(x, y)]);

      if (validation.accepted.length === 0) {
        toast.error("That pixel can't be selected", {
          description: summarizeSelectionRejections(validation.rejected),
        });
        return;
      }

      setMode("buying");
      setIsSelecting(true);
      setSelectedPixels(validation.accepted);
    },
    [validateSelection]
  );

  return {
    selectedPixels,
    totalCost,
    mode,
    isSelecting,
    setIsSelecting,
    toggleSelecting,
    selectionHistory,
    showClearDialog,
    setShowClearDialog,
    showDraftRestorePrompt,
    setShowDraftRestorePrompt,
    draftToRestore,
    handleSelectionChange,
    handleUndoLastSelection,
    confirmClearSelection,
    handleExitBuyingMode,
    handleClearSelection,
    handleRestoreDraft,
    handleDismissDraft,
    enterBuyingMode,
    resetAfterPurchase,
    selectFocusedPixel,
  };
}
