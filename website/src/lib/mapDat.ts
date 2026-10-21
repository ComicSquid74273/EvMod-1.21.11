/**
 * NBT codec used by map DAT and structure decoding paths.
 * Exports: `parseNbtRoot`, `parseMapDataFromDat`, `encodeMapDataToDat`.
 */
import { inflate, gzip } from "pako";
import type { LockedMapData, MapData } from "@/lib/map";

const inflateIfNeeded = (buffer: ArrayBuffer): Uint8Array => {
  try {
    return inflate(new Uint8Array(buffer));
  } catch {
    return new Uint8Array(buffer);
  }
};

const textDecoder = new TextDecoder();

// Exported for mapNbt.ts, which reuses the same NBT root parser for .nbt/.litematic/.schem decoding.
export function parseNbtRoot(buffer: ArrayBuffer): unknown {
  const reader = new NbtReader(inflateIfNeeded(buffer));
  return reader.readNamedTag().value;
}

const writeI16 = (out: number[], v: number) => {
  out.push((v >> 8) & 0xFF, v & 0xFF);
};

const writeI32 = (out: number[], v: number) => {
  out.push((v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF);
};

const writeString = (out: number[], s: string) => {
  const bytes = new TextEncoder().encode(s);
  writeI16(out, bytes.length);
  for (const b of bytes) out.push(b);
};

const writeTagHeader = (out: number[], type: number, name: string) => {
  out.push(type & 0xFF);
  writeString(out, name);
};

export function encodeMapDataToDat(mapData: MapData, locked = true): Blob {
  const { colors } = mapData;
  if (colors.length !== 16384) throw new Error("DAT colors array must be exactly 16384 bytes");

  const out: number[] = [];
  writeTagHeader(out, 10, "");  // root compound
  writeTagHeader(out, 10, "data");  // data compound

  writeTagHeader(out, 1, "scale"); out.push(0);
  writeTagHeader(out, 3, "xCenter"); writeI32(out, 0);
  writeTagHeader(out, 3, "zCenter"); writeI32(out, 0);
  writeTagHeader(out, 8, "dimension"); writeString(out, "minecraft:overworld");
  writeTagHeader(out, 1, "trackingPosition"); out.push(0);
  writeTagHeader(out, 1, "unlimitedTracking"); out.push(0);
  writeTagHeader(out, 1, "locked"); out.push(locked ? 1 : 0);
  writeTagHeader(out, 7, "colors"); writeI32(out, colors.length); for (const b of colors) out.push(b);

  out.push(0);  // end data compound
  out.push(0);  // end root compound

  return new Blob([gzip(new Uint8Array(out))], { type: "application/octet-stream" });
}

export function parseMapDataFromDat(buffer: ArrayBuffer): LockedMapData {
  const root = new NbtReader(inflateIfNeeded(buffer)).readNamedTag().value;
  const d = root?.data ?? root;
  if (!d) throw new Error('No "data" tag found in NBT');

  const colors = d.colors;
  if (!(colors instanceof Uint8Array) || colors.length !== 16384)
    throw new Error("Invalid or missing colors array (expected 16384 bytes)");
  if (d.locked !== 0 && d.locked !== 1)
    throw new Error('Invalid or missing "locked" flag (expected byte 0 or 1)');

  return {
    colors,
    locked: d.locked === 1,
  };
}

class NbtReader {
  private pos = 0;
  private view: DataView;

  constructor(private data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  readNamedTag(): { name: string; value: any } {
    const type = this.u8();
    if (type === 0) return { name: "", value: null };
    const name = this.str();
    return { name, value: this.payload(type) };
  }

  private u8() { return this.view.getUint8(this.pos++); }
  private i8() { return this.view.getInt8(this.pos++); }
  private i16() { const v = this.view.getInt16(this.pos); this.pos += 2; return v; }
  private i32() { const v = this.view.getInt32(this.pos); this.pos += 4; return v; }
  private i64() { const v = this.view.getBigInt64(this.pos); this.pos += 8; return v; }
  private f32() { const v = this.view.getFloat32(this.pos); this.pos += 4; return v; }
  private f64() { const v = this.view.getFloat64(this.pos); this.pos += 8; return v; }

  private str(): string {
    const len = this.view.getUint16(this.pos);
    this.pos += 2;
    return textDecoder.decode(this.readBytes(len));
  }

  private readBytes(length: number) {
    if (length < 0 || this.pos + length > this.data.length) throw new Error("Invalid NBT byte/string length");
    const bytes = this.data.subarray(this.pos, this.pos + length);
    this.pos += length;
    return bytes;
  }

  private payload(type: number): any {
    switch (type) {
      case 1: return this.i8();
      case 2: return this.i16();
      case 3: return this.i32();
      case 4: return Number(this.i64());
      case 5: return this.f32();
      case 6: return this.f64();
      case 7: return this.readBytes(this.i32());
      case 8: return this.str();
      case 9: { const et = this.u8(); const n = this.i32(); const a: any[] = []; for (let i = 0; i < n; ++i) a.push(this.payload(et)); return a; }
      case 10: {
        const c: Record<string, any> = {};
        while (true) { const t = this.u8(); if (t === 0) break; const nm = this.str(); c[nm] = this.payload(t); }
        return c;
      }
      case 11: { const n = this.i32(); const a: number[] = []; for (let i = 0; i < n; ++i) a.push(this.i32()); return a; }
      case 12: { const n = this.i32(); const a: bigint[] = []; for (let i = 0; i < n; ++i) a.push(this.i64()); return a; }
      default: throw new Error("Unknown NBT tag: " + type);
    }
  }
}