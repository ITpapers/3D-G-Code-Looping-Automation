// src/core/threeMF/merge.ts
import { listEntries, readEntryDataRaw } from "./zip-read";
import { writeZipFromEntries, ZipIn } from "./zip-write";
import { asArrayBuffer } from "@util/binary";
import { md5Hex } from "@util/md5";

/** Convert new bytes to match the original file's EOLs (LF vs CRLF). */
function normalizeToOriginalEOL(original: Uint8Array | null, fresh: Uint8Array): Uint8Array {
  if (!original) return fresh; // no clue — leave as-is
  const origText = new TextDecoder().decode(original);
  const freshText = new TextDecoder().decode(fresh);
  const wantsCRLF = /\r\n/.test(origText);
  const normalized = wantsCRLF
    ? freshText.replace(/\r?\n/g, "\r\n")
    : freshText.replace(/\r\n/g, "\n");
  return new TextEncoder().encode(normalized);
}

function crc32(u8: Uint8Array): number {
  let c = ~0 >>> 0;
  for (let i = 0; i < u8.length; i++) {
    c ^= u8[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

/** deflate-raw if available; else return original (writer will mark STORE) */
async function deflateRaw(u: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return u;
  const cs = new CompressionStream("deflate-raw");
  const ab = await new Response(new Blob([asArrayBuffer(u)]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(ab);
}

export async function mergeGcodePreservingCompression(
  originalZip: Uint8Array,
  plateIndex: number,
  newGcode: Uint8Array
): Promise<Uint8Array> {
  const entries = listEntries(originalZip);
  if (!entries) throw new Error("Invalid 3mf: no central directory");

  const plate = Math.max(1, plateIndex);
  const targetG   = `Metadata/plate_${plate}.gcode`.toLowerCase();
  const targetMD5 = `Metadata/plate_${plate}.gcode.md5`.toLowerCase();

  const out: ZipIn[] = [];
  let sawMd5 = false, sawGcode = false;
  let originalGcodeBytes: Uint8Array | null = null;

  // First pass: locate original plate to learn its EOLs
  for (const e of entries) {
    const name = e.name.toLowerCase();
    if (name === targetG) {
      originalGcodeBytes = readEntryDataRaw(originalZip, e);
      break;
    }
  }

  // Match original EOLs before computing MD5 or (re)compressing
  const normalized = normalizeToOriginalEOL(originalGcodeBytes, newGcode);
  const md5Text = md5Hex(normalized); // UPPERCASE hex
  const md5Bytes = new TextEncoder().encode(md5Text);

  // Second pass: rewrite plate + md5, copy everything else as-is
  for (const e of entries) {
    const raw = readEntryDataRaw(originalZip, e);
    if (!raw) continue;

    const name = e.name.toLowerCase();

    if (name === targetG) {
      sawGcode = true;
      if (e.comp === 8) {
        const deflated = await deflateRaw(normalized);
        out.push({ name: e.name, comp: 8, data: deflated,
          usize: normalized.length, csize: deflated.length, crc: crc32(normalized) });
      } else {
        out.push({ name: e.name, comp: 0, data: normalized,
          usize: normalized.length, csize: normalized.length, crc: crc32(normalized) });
      }
    } else if (name === targetMD5) {
      sawMd5 = true;
      out.push({ name: e.name, comp: 0, data: md5Bytes,
        usize: md5Bytes.length, csize: md5Bytes.length, crc: crc32(md5Bytes) });
    } else {
      // copy other entries as-is (preserve compression & metadata)
      out.push({ name: e.name, comp: e.comp, data: raw,
        usize: (e as any).usize, csize: (e as any).csize, crc: (e as any).crc });
    }
  }

  if (!sawGcode) {
    out.push({ name: `Metadata/plate_${plate}.gcode`, comp: 0, data: normalized,
      usize: normalized.length, csize: normalized.length, crc: crc32(normalized) });
  }
  if (!sawMd5) {
    out.push({ name: `Metadata/plate_${plate}.gcode.md5`, comp: 0, data: md5Bytes,
      usize: md5Bytes.length, csize: md5Bytes.length, crc: crc32(md5Bytes) });
  }

  return writeZipFromEntries(out);
}
