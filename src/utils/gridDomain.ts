import { GRID_CONFIG, calculatePixelPrice } from "@/utils/gridConstants";
import type { PurchasedPixel, SelectedPixel } from "@/types/grid";

export type PixelStatus = "available" | "selected" | "sold" | "yours" | "restricted";

export type PixelSelectionRejectReason =
  | "out-of-bounds"
  | "reserved"
  | "sold"
  | "duplicate";

export interface BillboardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelSelectionRejection {
  x: number;
  y: number;
  id: string;
  reason: PixelSelectionRejectReason;
}

export interface PixelSelectionValidationResult {
  accepted: SelectedPixel[];
  rejected: PixelSelectionRejection[];
}

type PixelCandidate = Pick<SelectedPixel, "x" | "y"> &
  Partial<Pick<SelectedPixel, "id" | "price">>;

interface PixelSelectionValidationOptions {
  gridWidth?: number;
  gridHeight?: number;
  getPurchasedPixel?: (x: number, y: number) => PurchasedPixel | undefined;
  getPixelPrice?: (x: number, y: number) => number;
}

interface PixelStatusOptions {
  gridWidth?: number;
  gridHeight?: number;
  selectedPixelIds?: ReadonlySet<string>;
  getPurchasedPixel?: (x: number, y: number) => PurchasedPixel | undefined;
  currentUserId?: string | null;
}

interface PixelFocusViewportOptions {
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
  scaledPixelSize: number;
}

export function getPixelId(x: number, y: number): string {
  return `${x}-${y}`;
}

export function isInGridBounds(
  x: number,
  y: number,
  gridWidth: number = GRID_CONFIG.CANVAS_WIDTH,
  gridHeight: number = GRID_CONFIG.CANVAS_HEIGHT
): boolean {
  return x >= 0 && x < gridWidth && y >= 0 && y < gridHeight;
}

export function getBillboardBounds(
  gridWidth: number = GRID_CONFIG.CANVAS_WIDTH,
  gridHeight: number = GRID_CONFIG.CANVAS_HEIGHT
): BillboardBounds {
  const width = GRID_CONFIG.BILLBOARD_WIDTH;
  const height = GRID_CONFIG.BILLBOARD_HEIGHT;

  return {
    x: Math.floor((gridWidth - width) / 2),
    y: Math.floor((gridHeight - height) / 2),
    width,
    height,
  };
}

export function isReservedPixel(
  x: number,
  y: number,
  gridWidth: number = GRID_CONFIG.CANVAS_WIDTH,
  gridHeight: number = GRID_CONFIG.CANVAS_HEIGHT
): boolean {
  const bounds = getBillboardBounds(gridWidth, gridHeight);

  return (
    x >= bounds.x &&
    x < bounds.x + bounds.width &&
    y >= bounds.y &&
    y < bounds.y + bounds.height
  );
}

export function createSelectedPixel(
  x: number,
  y: number,
  getPixelPrice = calculatePixelPrice
): SelectedPixel {
  return {
    x,
    y,
    id: getPixelId(x, y),
    price: getPixelPrice(x, y),
  };
}

export function getPixelSelectionStatus(
  x: number,
  y: number,
  {
    gridWidth = GRID_CONFIG.CANVAS_WIDTH,
    gridHeight = GRID_CONFIG.CANVAS_HEIGHT,
    selectedPixelIds,
    getPurchasedPixel,
    currentUserId,
  }: PixelStatusOptions = {}
): PixelStatus {
  if (!isInGridBounds(x, y, gridWidth, gridHeight)) return "restricted";
  if (isReservedPixel(x, y, gridWidth, gridHeight)) return "restricted";

  const purchased = getPurchasedPixel?.(x, y);
  if (purchased) return purchased.owner_id === currentUserId ? "yours" : "sold";

  return selectedPixelIds?.has(getPixelId(x, y)) ? "selected" : "available";
}

export function validatePixelSelection(
  candidates: ReadonlyArray<PixelCandidate>,
  {
    gridWidth = GRID_CONFIG.CANVAS_WIDTH,
    gridHeight = GRID_CONFIG.CANVAS_HEIGHT,
    getPurchasedPixel,
    getPixelPrice = calculatePixelPrice,
  }: PixelSelectionValidationOptions = {}
): PixelSelectionValidationResult {
  const accepted: SelectedPixel[] = [];
  const rejected: PixelSelectionRejection[] = [];
  const acceptedIds = new Set<string>();

  candidates.forEach((candidate) => {
    const { x, y } = candidate;
    const id = candidate.id ?? getPixelId(x, y);

    if (acceptedIds.has(id)) {
      rejected.push({ x, y, id, reason: "duplicate" });
      return;
    }

    if (!isInGridBounds(x, y, gridWidth, gridHeight)) {
      rejected.push({ x, y, id, reason: "out-of-bounds" });
      return;
    }

    if (isReservedPixel(x, y, gridWidth, gridHeight)) {
      rejected.push({ x, y, id, reason: "reserved" });
      return;
    }

    if (getPurchasedPixel?.(x, y)) {
      rejected.push({ x, y, id, reason: "sold" });
      return;
    }

    acceptedIds.add(id);
    accepted.push({
      x,
      y,
      id,
      price: candidate.price ?? getPixelPrice(x, y),
    });
  });

  return { accepted, rejected };
}

export function summarizeSelectionRejections(
  rejected: ReadonlyArray<PixelSelectionRejection>
): string {
  const counts = rejected.reduce<Record<PixelSelectionRejectReason, number>>(
    (summary, rejection) => {
      summary[rejection.reason] += 1;
      return summary;
    },
    {
      "out-of-bounds": 0,
      reserved: 0,
      sold: 0,
      duplicate: 0,
    }
  );

  return [
    counts.sold ? `${counts.sold} owned` : null,
    counts.reserved ? `${counts.reserved} reserved` : null,
    counts["out-of-bounds"] ? `${counts["out-of-bounds"]} outside the grid` : null,
    counts.duplicate ? `${counts.duplicate} duplicate` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function getPixelFocusViewportOffset({
  x,
  y,
  containerWidth,
  containerHeight,
  scaledPixelSize,
}: PixelFocusViewportOptions): { x: number; y: number } {
  return {
    x: containerWidth / 2 - x * scaledPixelSize - scaledPixelSize / 2,
    y: containerHeight / 2 - y * scaledPixelSize - scaledPixelSize / 2,
  };
}
