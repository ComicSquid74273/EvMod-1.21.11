/**
 * UUID + map-hash utilities.
 * Exports: `UUID_RE`, `parseDashedUuid`, `dashedUuidFromLongs`, `nameUUIDFromBytes`,
 * `setLockedBit`, `clearLockedBit`, `parseUUIDs`, `uuidsToBytes`, `parseImageUUIDs`, `DashedUuid`.
 */
import { md5 } from "@/lib/md5";
import { parseMapDataFromImageData } from "@/lib/mapColors";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DashedUuid = string & { readonly __dashedUuid: unique symbol };

// Internal callers supply exactly 16 bytes; toHex() always produces lowercase.
const formatUuid = (bytes: Uint8Array): DashedUuid => {
  const hex = bytes.toHex();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}` as DashedUuid;
};

export const parseDashedUuid = (raw: string): DashedUuid | null => {
  const uuid = raw.trim().toLowerCase();
  return UUID_RE.test(uuid) ? uuid as DashedUuid : null;
};

const toUint64Hex = (value: number | bigint) =>
  BigInt.asUintN(64, typeof value === "bigint" ? value : BigInt(value)).toString(16).padStart(16, "0");

export const dashedUuidFromLongs = (mostSigBits: number | bigint, leastSigBits: number | bigint): DashedUuid => {
  const a = toUint64Hex(mostSigBits), b = toUint64Hex(leastSigBits);
  return `${a.slice(0, 8)}-${a.slice(8, 12)}-${a.slice(12, 16)}-${b.slice(0, 4)}-${b.slice(4)}` as DashedUuid;
};

export const nameUUIDFromBytes = (bytes: Uint8Array): DashedUuid => {
  const hash = md5(bytes);
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return formatUuid(hash);
};

const updateLockedBit = (uuid: DashedUuid, setLocked: boolean): DashedUuid => {
  const byte0 = Number.parseInt(uuid.slice(0, 2), 16);
  const next = setLocked ? (byte0 | 0x01) : (byte0 & 0xFE);
  return `${next.toString(16).padStart(2, "0")}${uuid.slice(2)}` as DashedUuid;
};

export const setLockedBit = (uuid: DashedUuid): DashedUuid => updateLockedBit(uuid, true);
export const clearLockedBit = (uuid: DashedUuid): DashedUuid => updateLockedBit(uuid, false);

export const parseUUIDs = (buffer: ArrayBuffer): DashedUuid[] => {
  const bytes = new Uint8Array(buffer);
  const result: DashedUuid[] = [];
  for (let i = 0; i + 16 <= bytes.length; i += 16)
    result.push(formatUuid(bytes.subarray(i, i + 16)));
  return result;
};

export const uuidsToBytes = (uuidList: string[]): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(uuidList.length * 16);
  for (const [i, uuid] of uuidList.entries()) {
    const dashed = parseDashedUuid(uuid);
    if (!dashed) throw new Error(`Invalid UUID: ${uuid}`);
    bytes.subarray(i * 16, i * 16 + 16).setFromHex(dashed.replaceAll("-", ""));
  }
  return bytes;
};

let workCanvas: HTMLCanvasElement | null = null;
let workCtx: CanvasRenderingContext2D | null = null;

const getWorkContext = (width: number, height: number) => {
  workCanvas ??= document.createElement("canvas");
  if (workCanvas.width !== width) workCanvas.width = width;
  if (workCanvas.height !== height) workCanvas.height = height;
  if (!workCtx) workCtx = workCanvas.getContext("2d");
  if (!workCtx) throw new Error("2D canvas context unavailable");
  return workCtx;
};

/** Parse 128×128 blocks from a PNG image, hash each tile to a UUID with locked bit set. */
export const parseImageUUIDs = (img: HTMLImageElement): DashedUuid[] => {
  if (img.width % 128 || img.height % 128)
    throw new Error(`Dimensions must be divisible by 128. Got ${img.width}×${img.height}`);

  const ctx = getWorkContext(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

  const tilesX = img.width >> 7;
  const tilesY = img.height >> 7;
  const results: DashedUuid[] = [];

  for (let by = 0; by < tilesY; ++by) {
    const baseY = by * 128;
    for (let bx = 0; bx < tilesX; ++bx) {
      const baseX = bx * 128;
      const { mapData, approximatedPixels } = parseMapDataFromImageData(pixels, {
        sourceWidth: img.width,
        startX: baseX,
        startY: baseY,
      });
      if (approximatedPixels > 0) {
        throw new Error("Image contains unsupported colors");
      }
      results.push(setLockedBit(nameUUIDFromBytes(mapData.colors)));
    }
  }
  return results;
};