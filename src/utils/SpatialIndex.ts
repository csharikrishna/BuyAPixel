import { PurchasedPixel } from "@/types/grid";
import { GRID_CONFIG } from "@/utils/gridConstants";

const CHUNK_SIZE = GRID_CONFIG.CHUNK_SIZE;

export class SpatialIndex {
   private chunks: Map<string, PurchasedPixel[]>;
   private pixelMap: Map<string, PurchasedPixel>;

   constructor() {
      this.chunks = new Map();
      this.pixelMap = new Map();
   }

   clear() {
      this.chunks.clear();
      this.pixelMap.clear();
   }

   add(pixel: PurchasedPixel) {
      this.pixelMap.set(`${pixel.x}-${pixel.y}`, pixel);

      const cx = Math.floor(pixel.x / CHUNK_SIZE);
      const cy = Math.floor(pixel.y / CHUNK_SIZE);
      const key = `${cx}-${cy}`;

      if (!this.chunks.has(key)) {
         this.chunks.set(key, []);
      }
      this.chunks.get(key)!.push(pixel);
   }

   get(x: number, y: number): PurchasedPixel | undefined {
      return this.pixelMap.get(`${x}-${y}`);
   }

   has(x: number, y: number): boolean {
      return this.pixelMap.has(`${x}-${y}`);
   }

   getAll(): PurchasedPixel[] {
      return Array.from(this.pixelMap.values());
   }

   remove(x: number, y: number): boolean {
      const key = `${x}-${y}`;
      const pixel = this.pixelMap.get(key);

      if (!pixel) return false;

      // Remove from pixelMap
      this.pixelMap.delete(key);

      // Remove from chunks
      const cx = Math.floor(x / CHUNK_SIZE);
      const cy = Math.floor(y / CHUNK_SIZE);
      const chunkKey = `${cx}-${cy}`;
      const chunk = this.chunks.get(chunkKey);

      if (chunk) {
         const index = chunk.findIndex(p => p.x === x && p.y === y);
         if (index !== -1) {
            chunk.splice(index, 1);
         }
         // Clean up empty chunks
         if (chunk.length === 0) {
            this.chunks.delete(chunkKey);
         }
      }

      return true;
   }


   query(x: number, y: number, width: number, height: number): PurchasedPixel[] {
      const results: PurchasedPixel[] = [];

      const startCx = Math.floor(x / CHUNK_SIZE);
      const endCx = Math.floor((x + width) / CHUNK_SIZE);
      const startCy = Math.floor(y / CHUNK_SIZE);
      const endCy = Math.floor((y + height) / CHUNK_SIZE);

      for (let cy = startCy; cy <= endCy; cy++) {
         for (let cx = startCx; cx <= endCx; cx++) {
            const chunk = this.chunks.get(`${cx}-${cy}`);
            if (chunk) {
               // We could granularly filter here, but returning the whole chunk is often faster 
               // if chunks are small enough, and then letting the specific visibility check handle strict culling if needed.
               // However, for strict viewport querying, we just return the chunk candidates.
               results.push(...chunk);
            }
         }
      }

      return results;
   }
}
