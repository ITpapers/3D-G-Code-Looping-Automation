// src/core/gcode/parse.ts
import type { ParsedFile } from "@core/types";

/**
 * Split Bambu G-code into head/piece/tail in a casing + EOL tolerant way.
 * - head: everything before ;START gcode
 * - piece: between ;START gcode and ;END gcode (exclusive)
 * - tail: from first ;END gcode to the end (inclusive)
 */
export function parseGcode(text: string): ParsedFile {
  // normalize only for searching (keep original text unchanged!)
  const norm = text.replace(/\r\n/g, "\n");
  const startRe = /;START\s+gcode/i;
  const endRe = /;END\s+gcode/i;

  const startMatch = startRe.exec(norm);
  const endMatch = endRe.exec(norm);

  const startIdx = startMatch ? startMatch.index : -1;
  const endIdx = endMatch ? endMatch.index : -1;

  if (startIdx >= 0 && endIdx > startIdx) {
    // Map normalized indices back into original string by counting chars
    // Since we only collapsed CRLF→LF in `norm`, indices align except that
    // CR characters may exist before positions; slicing original is still safe.
    const head = text.slice(0, startIdx);
    const piece = text.slice(startIdx, endIdx);
    const tail = text.slice(endIdx); // includes ;END gcode line
    return { head, piece, tail };
  }

  // Fallbacks if markers are missing/odd
  if (startIdx >= 0 && endIdx <= startIdx) {
    const head = text.slice(0, startIdx);
    const piece = text.slice(startIdx);
    return { head, piece, tail: "\n;END gcode (added by tool)" };
  }

  // No markers found — treat whole file as piece
  return { head: "", piece: text, tail: "" };
}
