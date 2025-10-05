// src/core/gcode/build.ts

import { splitBambuGcodeByBlocks } from "@core/gcode/structure";

/**
 * G-code builders and cleanup (purge stripper + sweep/raster logic).
 */

export function maybeAdjustBedHold(raw: string, holdC?: number): string {
  if (!holdC || holdC <= 0) return raw;
  // Replace bed temp holds (M140/M190 Sxx) with S{hold}
  return raw.replace(/^(.*?)(M1(40|90)\s+S\d+.*)$/ms, (_m, pre, cmd) => {
    const adj = cmd.replace(/(M1(40|90)\s+S)\d+/g, `$1${Math.round(holdC)}`);
    return pre + adj;
  });
}

/**
 * Remove Bambu purge/prime/wipe blocks from the start of a print segment.
 * Targets (in priority order):
 *  1) All `; FLUSH_START` … `; FLUSH_END` sections (there can be several).
 *  2) The post-flush "wipe/shake" sequence (e.g. X70/X80 oscillation, comments like
 *     "shake to put down garbage", "wipe and shake", "move Y to aside, prevent collision").
 *  3) Fallback: pre-LAYER horizontal "line purge" (narrow Y band, mostly extruding).
 *
 * Returns { text, debug } for optional preview logging.
 
export function stripPurgeBlocks(gcodePiece: string): { text: string; debug: string } {
  const lines = gcodePiece.split("\n");
  const debugParts: string[] = [];

  const isLayerStart = (s: string) =>
    /^;\s*LAYER:\d+/i.test(s) ||
    /^;\s*type:\s*(skirt|brim|wall|perimeter|infill)/i.test(s) ||
    /^;\s*(layer|skirt|brim|wall|perimeter|infill)\b/i.test(s);

  const removeRange = (a: number, b: number, tag: string) => {
    const removed = lines.slice(a, b);
    lines.splice(a, b - a);
    debugParts.push(`${tag} [${a}..${b - 1}] (${removed.length} lines)`);
  };

  const SCAN_LIMIT = Math.min(lines.length, 2000);

  // 1) Remove ALL FLUSH blocks found early
  for (let i = 0; i < SCAN_LIMIT; ) {
    if (/^;\s*FLUSH_START\b/i.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !/^;\s*FLUSH_END\b/i.test(lines[j])) j++;
      if (j < lines.length) {
        removeRange(i, j + 1, "FLUSH block removed");
        continue;
      } else {
        break; // no closing marker → bail
      }
    }
    i++;
  }

  // 2) Remove wipe/shake block if present
  const wipeHintIdx = lines.findIndex(
    (s, k) =>
      k < SCAN_LIMIT &&
      (/shake to put down garbage/i.test(s) ||
        /wipe and shake/i.test(s) ||
        /move Y to aside, prevent collision/i.test(s))
  );
  if (wipeHintIdx >= 0) {
    let start = Math.max(0, wipeHintIdx - 25);
    let end = wipeHintIdx + 1;
    const STOP = (s: string) =>
      isLayerStart(s) ||
      /^M20[49]\b|^M62[19]\b/i.test(s) || // M204 accel, M621/629 tool/AMS
      /^;\s*(HEADER_BLOCK|CONFIG_BLOCK|END gcode)/i.test(s);

    while (end < Math.min(lines.length, wipeHintIdx + 80)) {
      const s = lines[end];
      if (STOP(s)) break;
      if (/^[GM]\d+/.test(s) && !/^G0\b|^G1\b|^M10[679]\b/i.test(s)) break; // allow G0/G1 and M106/M107
      end++;
    }
    if (end > start) removeRange(start, end, "wipe/shake block removed");
  }

  // 3) Fallback heuristic: line purge before first layer
  let firstLayer = lines.findIndex((s, k) => k < SCAN_LIMIT && isLayerStart(s));
  if (firstLayer < 0) firstLayer = Math.min(lines.length, 800);

  let y0: number | null = null;
  let yBand = 0;
  let ePrev = 0;
  let extrudeCount = 0;
  let moveCount = 0;
  let fallStart = -1;
  let fallEnd = -1;

  const parseY = (s: string): number | null => {
    const m = /\bY(-?\d+(\.\d+)?)/i.exec(s);
    return m ? Number(m[1]) : null;
  };
  const parseE = (s: string): number | null => {
    const m = /\bE(-?\d+(\.\d+)?)/i.exec(s);
    return m ? Number(m[1]) : null;
  };

  for (let i = 0; i < firstLayer; i++) {
    const s = lines[i];
    if (/^G1\b/i.test(s)) {
      moveCount++;
      const y = parseY(s);
      const e = parseE(s);
      if (y !== null) {
        if (y0 === null) y0 = y;
        yBand = Math.max(yBand, Math.abs(y - y0));
      }
      if (e !== null) {
        if (e > ePrev + 0.0001) extrudeCount++;
        ePrev = e;
      }
      if (moveCount >= 25 && extrudeCount / moveCount > 0.6 && yBand < 8) {
        if (fallStart < 0) fallStart = 0;
        fallEnd = i + 1;
      }
    } else if (/^G0\b/i.test(s)) {
      moveCount++;
      const y = parseY(s);
      if (y !== null) {
        if (y0 === null) y0 = y;
        yBand = Math.max(yBand, Math.abs(y - y0));
      }
    } else if (/^;\s/.test(s)) {
      // ignore comments
    } else {
      if (fallEnd > 0) break;
    }
  }

  if (fallStart >= 0 && fallEnd > fallStart) {
    removeRange(fallStart, fallEnd, `heuristic line purge removed (Yband≈${yBand.toFixed(2)})`);
  }

  const result = lines.join("\n");
  const debug =
    debugParts.length ? "Purge cleanup:\n; " + debugParts.join("\n; ") : "No purge block detected.";
  return { text: result, debug };
}
*/


/**
 * stripPurgeFromStart:
 * Remove purge/flush/wipe and "line purge" sequences from the **very beginning**
 * of the file (HEAD + early PIECE), up to the first real print hint.
 * This is where Bambu often puts the purge line that shows before loop 1.
 */
const rHeaderStart = /^;+\s*HEADER_BLOCK_START\b/i;
const rConfigStart = /^;+\s*CONFIG_BLOCK_START\b/i;
const rStartGcode  = /^;+\s*START\s+gcode\b/i;

// Remove only obvious purge lines BEFORE ;START gcode,
// but stop immediately if we hit HEADER/CONFIG (never touch them).
export function stripPurgeFromStart(gcode: string): { text: string } {
  const eol = gcode.includes("\r\n") ? "\r\n" : "\n";
  const lines = gcode.split(/\r?\n/);

  let out: string[] = [];
  let beforeStart = true;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    // If we encounter header/config, we are DEFINITELY not purging anymore.
    if (rHeaderStart.test(t) || rConfigStart.test(t)) {
      beforeStart = false; // and we don't drop this line
      out.push(lines[i]);
      continue;
    }

    // If we reached ;START gcode, stop purging.
    if (beforeStart && rStartGcode.test(t)) {
      beforeStart = false;
      out.push(lines[i]);
      continue;
    }

    if (beforeStart) {
      // Heuristics: drop pure purge/wipe comments & empty lines at the very top
      if (
        t === "" ||
        /^;+\s*(flush|flush_start|prime|purge|wipe|thumbnail|thumbnails?)\b/i.test(t)
      ) {
        continue; // skip
      }
    }

    out.push(lines[i]);
  }

  return { text: out.join(eol) };
}





// Case-insensitive, whitespace-tolerant markers
const RX_EXEC_START   = /^\s*;\s*EXECUTABLE_BLOCK_START\b/i;
const RX_NOZZLE_LOAD  = /^\s*;[=\-\s]*nozzle\s+load\s+line\b/i;
const RX_FIL_START    = /^\s*;\s*filament\s+start\s+gcode\b/i;
// Fallback “safe” stoppers if the filament-start comment is missing:
const RX_VT0          = /^\s*;\s*VT0\b/i;
const RX_CHANGE_LAYER = /^\s*;\s*CHANGE_LAYER\b/i;

/**
 * Removes the initial purge/"nozzle load line" block that Bambu inserts
 * right after CONFIG, keeping everything else.
 * We delete lines from the line matching ";===== nozzle load line ====="
 * up to (but not including) the first of:
 *   "; filament start gcode", ";VT0", or "; CHANGE_LAYER".
 */
export function stripNozzleLoadLine(gcode: string): { text: string, removedCount: number } {
  const eol = gcode.includes("\r\n") ? "\r\n" : "\n";
  const lines = gcode.split(/\r?\n/);

  // Optional: only start looking after EXECUTABLE_BLOCK_START
  let searchFrom = 0;
  for (let i = 0; i < lines.length; i++) {
    if (RX_EXEC_START.test(lines[i])) { searchFrom = i; break; }
  }

  // Find the purge block start
  let s = -1;
  for (let i = searchFrom; i < lines.length; i++) {
    if (RX_NOZZLE_LOAD.test(lines[i])) { s = i; break; }
  }
  if (s < 0) {
    return { text: gcode, removedCount: 0 }; // nothing to strip
  }

  // Find the end marker (first one that appears after s)
  let e = -1;
  for (let i = s + 1; i < lines.length; i++) {
    const t = lines[i];
    if (RX_FIL_START.test(t) || RX_VT0.test(t) || RX_CHANGE_LAYER.test(t)) {
      e = i; break;
    }
  }

  // If no explicit end found, be conservative: cut at most 200 lines
  if (e < 0) e = Math.min(s + 200, lines.length);

  const removedCount = Math.max(0, e - s);
  if (removedCount > 0) {
    lines.splice(s, removedCount);
  }

  return { text: lines.join(eol), removedCount };
}

// --- Cooling injector (temp or time) ---
export function applyDetachCooling(
  gcode: string,
  detach: { coolMode: "temp" | "time"; coolTempC?: number; coolSeconds?: number }
): string {
  const eol = gcode.includes("\r\n") ? "\r\n" : "\n";
  const lines = gcode.split(/\r?\n/);

  const rConfigEnd = /^;+\s*CONFIG_BLOCK_END\b/i;
  const rHeaderEnd = /^;+\s*HEADER_BLOCK_END\b/i;

  // insert right after CONFIG_BLOCK_END (fallback: after HEADER_BLOCK_END)
  let insertAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (rConfigEnd.test(t)) { insertAt = i + 1; break; }
    if (insertAt < 0 && rHeaderEnd.test(t)) { insertAt = i + 1; } // fallback
  }
  if (insertAt < 0) return gcode;

  const mode = detach?.coolMode === "time" ? "time" : "temp";
  const outLines: string[] = [];

  if (mode === "temp") {
    const t = Math.max(0, Math.floor(detach?.coolTempC ?? 30));
    outLines.push(
      `; --- cooling: wait until bed <= ${t}C ---`,
      `M190 R${t}`,
      `; --- end cooling ---`,
    );
  } else {
    const s = Math.max(0, Math.floor(detach?.coolSeconds ?? 0));
    if (s > 0) {
      outLines.push(
        `; --- cooling: dwell ${s}s ---`,
        `G4 S${s}`,
        `; --- end cooling ---`,
      );
    }
  }

  if (!outLines.length) return gcode;

  const out = [...lines.slice(0, insertAt), ...outLines, ...lines.slice(insertAt)];
  return out.join(eol);
}

// Return the cooling lines (temp- or time-based) without trying to place them.
// This is the same logic as applyDetachCooling(), just returns the lines.
export function coolingLinesFromDetach(detach: { coolMode: "temp" | "time"; coolTempC?: number; coolSeconds?: number }): string[] {
  const out: string[] = [];
  const mode = detach?.coolMode === "time" ? "time" : "temp";

  if (mode === "temp") {
    const t = Math.max(0, Math.floor(detach?.coolTempC ?? 30));
    out.push(
      `; --- cooling: wait until bed <= ${t}C ---`,
      `M190 R${t}`,
      `; --- end cooling ---`,
    );
  } else {
    const s = Math.max(0, Math.floor(detach?.coolSeconds ?? 0));
    if (s > 0) {
      out.push(
        `; --- cooling: dwell ${s}s ---`,
        `G4 S${s}`,
        `; --- end cooling ---`,
      );
    }
  }
  return out;
}


export function buildLoopedGcode(
  original: string,
  loops: number,
  detach: {
    zOffsetMm?: number;
    fanOn?: boolean;
    homeBetween?: boolean;
    safeLift?: boolean;

    sweepsSlow?: number;
    sweepsFast?: number;
    sweepFeedSlow?: number;
    sweepFeedFast?: number;
    sweepStepX?: number;
    sweepYmax?: number;
    sweepXmin?: number;
    sweepXmax?: number;

    bendTopZ?: number;
    bendBottomZ?: number;
    bendCycles?: number;
    bendFeed?: number;

    
    // add these three:
    coolMode: "temp" | "time";
    coolTempC?: number;
    coolSeconds?: number;

    sweepZ?: number;
  }
): string {
  const { head, header, config, body, eol } = splitBambuGcodeByBlocks(original);
  const times = Math.max(1, Math.floor(loops || 1));
  const detachBlock = buildDetachSequence(detach);

  const out: string[] = [];
  out.push(...head, ...header, ...config);

  for (let i = 0; i < times; i++) {
    out.push(...body);

    
  // Insert the wait/cooldown right after the print body,
  // so the dwell happens BEFORE detach/bend/sweep.
  out.push(...coolingLinesFromDetach(detach));


    // insert detach after each body (including after the final loop)
    out.push(...detachBlock);
    if (detach?.homeBetween) out.push("; --- home XY ---", "G28 X Y");
  }

  return out.join(eol);
}

/* ---------- Helpers for detach sequence (bend + sweeps) ---------- */
function buildDetachSequence(detach: any): string[] {
  const lines: string[] = [];
  const {
    zOffsetMm = 0,
    fanOn = true,
    safeLift = true,

    sweepsSlow = 0,
    sweepsFast = 0,
    sweepFeedSlow = 3000,
    sweepFeedFast = 12000,
    sweepStepX = 30,
    sweepYmax = 250,
    sweepXmin = 0,
    sweepXmax = 220,

    bendTopZ = 235,
    bendBottomZ = 200,
    bendCycles = 6,
    bendFeed = 12000,

     sweepZ: sweepZParam = 2,

  } = detach || {};

  const XMIN = Math.max(30, Math.min(sweepXmin, sweepXmax));
  const XMAX = Math.max(30, Math.max(sweepXmin, sweepXmax));
  const STEP = Math.max(1, Math.floor(sweepStepX));
  const YFRONT = 0;             // was 5 — start exactly at the front edge
  const YMAX = Math.max(YFRONT + 10, sweepYmax);
  const Z_MAX = 235; // adjust if needed for your machine
const micro     = Number(zOffsetMm) || 0;           // +1 lowers plate (increases Z) by 1 mm
const baseSweep = Number(sweepZParam) || 2;
const effSweepZ = Math.max(0, Math.min(Z_MAX, baseSweep + micro));


  const liftRel = (dz: number) => ["G91", `G0 Z${toFixed(dz)} F6000`, "G90"];
  const setFan = (on: boolean) => (on ? ["M106 S255"] : ["M106 S0"]);
  const travelF = 12000;

  lines.push("; === DETACH_SEQUENCE_START ===");

  if (safeLift) lines.push(...liftRel(5));
  //if (zOffsetMm && Math.abs(zOffsetMm) > 0) lines.push("; micro Z offset", ...liftRel(zOffsetMm));

  lines.push(`; --- bend plate ${bendCycles}x between Z${toFixed(bendBottomZ)} and Z${toFixed(bendTopZ)} ---`, "G90");
  for (let c = 0; c < Math.max(0, bendCycles); c++) {
    lines.push(`G1 Z${toFixed(bendBottomZ)} F${Math.max(100, Math.floor(bendFeed))}`);
    lines.push(`G1 Z${toFixed(bendTopZ)} F${Math.max(100, Math.floor(bendFeed))}`);
  }
  // const midZ = (Number(bendTopZ) + Number(bendBottomZ)) / 2;
  // lines.push(`G1 Z${toFixed(midZ)} F${Math.max(100, Math.floor(bendFeed))}`);

  // lines.push("; --- sweeps ---", ...setFan(!!fanOn));

// Raise to a deliberate sweep height close to the head
lines.push(`; sweepZ=${toFixed(baseSweep)} zOffsetMm=${toFixed(micro)} effSweepZ=${toFixed(effSweepZ)}`);
lines.push("M400");
lines.push("G90");
lines.push(`G1 Z${toFixed(effSweepZ)} F10000`);

lines.push("; --- sweeps ---", ...setFan(!!fanOn));

  // Build X columns and FORCE inclusion of XMAX as the last column
const cols: number[] = [];
for (let x = XMIN; x <= XMAX - 0.001; x += STEP) cols.push(Number(toFixed(Math.min(x, XMAX), 3)));
if (cols.length === 0 || cols[cols.length - 1] < XMAX - 0.001) cols.push(Number(toFixed(XMAX, 3)));

const initialStrokeF = Math.max(100, Math.floor(sweepFeedSlow)); // first push uses the slow feed

// Align at BACK-MIDDLE, do an initial push (back→front→back), then raster
const XMID = (XMIN + XMAX) / 2;
lines.push(`G1 X${toFixed(XMID)} Y${toFixed(YMAX)} F${travelF}`);
lines.push(`G1 Y${toFixed(YFRONT)} F${initialStrokeF}`);
lines.push(`G1 Y${toFixed(YMAX)} F${initialStrokeF}`);

// One sweep pass across columns: move X at the BACK, stroke FWD/BWD slowly
const sweepOnce = (feed: number) => {
  const strokeF = Math.max(100, Math.floor(feed));
  for (const x of cols) {
    // move to the next column AT THE BACK
    lines.push(`G1 X${toFixed(x)} Y${toFixed(YMAX)} F${travelF}`);
    // forward stroke
    lines.push(`G1 Y${toFixed(YFRONT)} F${strokeF}`);
    // backward stroke
    lines.push(`G1 Y${toFixed(YMAX)} F${strokeF}`);
  }
};

  if (sweepsSlow > 0) {
    lines.push(`; slow sweeps x${sweepsSlow} @ F${sweepFeedSlow}`);
    for (let i = 0; i < sweepsSlow; i++) sweepOnce(sweepFeedSlow);
  }
  if (sweepsFast > 0) {
    lines.push(`; fast sweeps x${sweepsFast} @ F${sweepFeedFast}`);
    for (let i = 0; i < sweepsFast; i++) sweepOnce(sweepFeedFast);
  }

  if (fanOn) lines.push("M106 S0");
  if (safeLift) lines.push(...liftRel(5));
  lines.push("; === DETACH_SEQUENCE_END ===");

  return lines;
}

function toFixed(n: number, p = 3): string {
  const v = Math.round((Number(n) || 0) * Math.pow(10, p)) / Math.pow(10, p);
  return v.toFixed(p).replace(/\.?0+$/,"");
}
