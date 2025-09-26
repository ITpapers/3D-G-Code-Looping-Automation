import { asArrayBuffer } from "@util/binary";

// src/core/threeMF/zip-read.ts
export type CdEntry = {
  name: string;
  comp: 0 | 8;     // 0=store, 8=deflate
  crc: number;     // CRC32 of uncompressed data
  csize: number;   // compressed size
  usize: number;   // uncompressed size
  lfhOff: number;  // local file header offset
  nlen: number;
  xlen: number;
  clen: number;
};

export function listEntries(u8: Uint8Array): CdEntry[] | null {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  // find EOCD
  let i = u8.length - 22;
  while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
  if (i < 0) return null;

  const cdSize   = dv.getUint32(i + 12, true);
  const cdOffset = dv.getUint32(i + 16, true);

  const out: CdEntry[] = [];
  let p = cdOffset, end = cdOffset + cdSize;

  while (p + 46 <= end && dv.getUint32(p, true) === 0x02014b50) {
    const comp  = dv.getUint16(p + 10, true) as 0 | 8;
    const crc   = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen  = dv.getUint16(p + 28, true);
    const xlen  = dv.getUint16(p + 30, true);
    const clen  = dv.getUint16(p + 32, true);
    const lfhOff= dv.getUint32(p + 42, true);
    const name  = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    out.push({ name, comp, crc, csize, usize, lfhOff, nlen, xlen, clen });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

export function readEntryDataRaw(u8: Uint8Array, e: CdEntry): Uint8Array | null {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(e.lfhOff, true) !== 0x04034b50) return null;
  const n2 = dv.getUint16(e.lfhOff + 26, true);
  const x2 = dv.getUint16(e.lfhOff + 28, true);
  const start = e.lfhOff + 30 + n2 + x2;
  return u8.subarray(start, start + e.csize);
}


export function extractCompressionMeta(e: CdEntry): 0 | 8 {
  return e.comp === 8 ? 8 : 0;
}

export async function extractFirstGcode(u8: Uint8Array): Promise<{ text: string, name: string }> {
  const entries = listEntries(u8);
  if (!entries) throw new Error("Invalid 3mf: no central directory");

  for (const e of entries) {
    if (e.name.toLowerCase().endsWith(".gcode")) {
      const raw = readEntryDataRaw(u8, e);
      if (!raw) continue;

      let bytes = raw;
      if (e.comp === 8 && typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate-raw");
        const ab = await new Response(new Blob([asArrayBuffer(raw)]).stream().pipeThrough(ds)).arrayBuffer();
        bytes = new Uint8Array(ab);
      }
      return { text: new TextDecoder().decode(bytes), name: e.name };
    }
  }
  throw new Error("No .gcode entry found inside .3mf");
}
