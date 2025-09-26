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



/** Build a full-bed raster across Xmin..Xmax at Y=0..Ymax. 
function rasterAcrossX(
  xMin: number,
  xMax: number,
  yMax: number,
  feed: number,
  step: number
): string[] {
  const cmds: string[] = [];
  const xmin = Math.max(0, Math.min(xMin, xMax));
  const xmax = Math.max(xMin, xMax);
  const s = Math.max(1, step);

  // initial span
  cmds.push(`G1 Y${yMax} F${feed}`);
  cmds.push(`G1 X${xmax} F${feed}`);
  cmds.push(`G1 Y0 F${feed}`);

  // rake back towards xmin
  for (let x = xmax - s; x >= xmin; x -= s) {
    cmds.push(`G1 Y${yMax} F${feed}`);
    cmds.push(`G1 X${x} F${feed}`);
    cmds.push(`G1 Y0 F${feed}`);
  }
  return cmds;
}

export function buildDetachBlock(opts: {
  zoffset: number;
  sweepsSlow: number;
  sweepsFast: number;
  sweepFeedSlow: number;
  sweepFeedFast: number;
  sweepStep: number;
  sweepYmax: number;
  sweepXmin: number;
  sweepXmax: number;
  fanOn: boolean;
  homeBetween: boolean;
  safeLift: boolean;
  coolMode: "temp" | "time";
  coolTemp: number;
  coolSec: number;
  bendTop: number;
  bendBottom: number;
  bendCycles: number;
  bendFeed: number;
}): string {
  const {
    zoffset,
    sweepsSlow,
    sweepsFast,
    sweepFeedSlow,
    sweepFeedFast,
    sweepStep,
    sweepYmax,
    sweepXmin,
    sweepXmax,
    fanOn,
    homeBetween,
    safeLift,
    coolMode,
    coolTemp,
    coolSec,
    bendTop,
    bendBottom,
    bendCycles,
    bendFeed,
  } = opts;

  const out: string[] = [];
  out.push("; ---- LOOP DETACH / COOLDOWN BLOCK BEGIN ----");
  out.push("M400");
  if (safeLift) {
    out.push("G91");
    out.push("G1 Z5 F2400");
    out.push("G90");
  }
  if (homeBetween) out.push("G28 X Y");
  if (coolMode === "temp") out.push(`M190 R${Math.max(0, Math.round(coolTemp))}`);
  else out.push(`G4 S${Math.max(0, Math.round(coolSec))}`);

  // Bending motion
  out.push(";============================  BENDING MOTION  ============================");
  const top = Math.max(0, bendTop);
  const bottom = Math.max(0, bendBottom);
  const feed = Math.max(600, bendFeed);
  for (let i = 0; i < Math.max(0, bendCycles); i++) {
    out.push(`G1 Z${top} F${feed}`);
    out.push(`G1 Z${bottom} F${feed}`);
  }

  // Sweeps
  out.push(";============================= PUSH / SWEEP SECTION =======================");
  if (zoffset) {
    out.push("G91");
    out.push(`G1 Z${zoffset.toFixed(2)} F2400`);
    out.push("G90");
  }
  if (fanOn) out.push("M106 S255");

  const yMax = Math.max(100, sweepYmax);
  const xMin = Math.max(0, sweepXmin);
  const xMax = Math.max(xMin + 10, sweepXmax); // ensure sane order
  const step = Math.max(1, sweepStep);

  if (sweepsSlow > 0) {
    const f = Math.max(100, sweepFeedSlow);
    out.push(`; full-bed rakes (${sweepsSlow}×, slow)`);
    for (let i = 0; i < sweepsSlow; i++) out.push(...rasterAcrossX(xMin, xMax, yMax, f, step));
  }

  if (sweepsFast > 0) {
    const f = Math.max(100, sweepFeedFast);
    out.push(`; full-bed rakes (${sweepsFast}×, fast)`);
    for (let i = 0; i < sweepsFast; i++) out.push(...rasterAcrossX(xMin, xMax, yMax, f, step));
  }

  out.push("M107");
  out.push("M400");
  out.push("; ---- LOOP DETACH / COOLDOWN BLOCK END ----");
  return out.join("\n");
}*/

/** Build the repeated print using parsed head/piece/tail and validated settings. 
export function buildLoopedGcode(
  parsed: { head: string; piece: string; tail: string },
  settings: {
    loops: number;
    detach: {
      zOffsetMm: number;
      fanOn: boolean;
      homeBetween: boolean;
      safeLift: boolean;
      coolMode: "temp" | "time";
      coolTempC: number;
      coolSeconds: number;
      sweepsSlow: number;
      sweepsFast: number;
      sweepFeedSlow: number;
      sweepFeedFast: number;
      sweepStepX: number;
      sweepYmax: number;
      sweepXmin: number;
      sweepXmax: number;
      bendTopZ: number;
      bendBottomZ: number;
      bendCycles: number;
      bendFeed: number;
    };
  }
): string {
  // Always purge-strip the printable segment for ALL loops
  const purge = stripPurgeBlocks(parsed.piece);
  const cleanedPiece = purge.text;

  const out: string[] = [parsed.head];
  for (let i = 0; i < settings.loops; i++) {
    out.push(`\n; ===== LOOP ${i + 1} / ${settings.loops} — START =====`);
    out.push(cleanedPiece);
    if (i < settings.loops - 1) {
      out.push(
        buildDetachBlock({
          zoffset: settings.detach.zOffsetMm,
          sweepsSlow: settings.detach.sweepsSlow,
          sweepsFast: settings.detach.sweepsFast,
          sweepFeedSlow: settings.detach.sweepFeedSlow,
          sweepFeedFast: settings.detach.sweepFeedFast,
          sweepStep: settings.detach.sweepStepX,
          sweepYmax: settings.detach.sweepYmax,
          sweepXmin: settings.detach.sweepXmin,
          sweepXmax: settings.detach.sweepXmax,
          fanOn: settings.detach.fanOn,
          homeBetween: settings.detach.homeBetween,
          safeLift: settings.detach.safeLift,
          coolMode: settings.detach.coolMode,
          coolTemp: settings.detach.coolTempC,
          coolSec: settings.detach.coolSeconds,
          bendTop: settings.detach.bendTopZ,
          bendBottom: settings.detach.bendBottomZ,
          bendCycles: settings.detach.bendCycles,
          bendFeed: settings.detach.bendFeed,
        })
      );
      out.push("; prepare for next loop");
    }
    out.push(`; ===== LOOP ${i + 1} / ${settings.loops} — END =====\n`);
  }
  out.push(parsed.tail || "\n;END gcode (from original file)");
  return out.join("\n");
}*/

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
  }
): string {
  const { head, header, config, body, eol } = splitBambuGcodeByBlocks(original);
  const times = Math.max(1, Math.floor(loops || 1));
  const detachBlock = buildDetachSequence(detach);

  const out: string[] = [];
  out.push(...head, ...header, ...config);

  for (let i = 0; i < times; i++) {
    out.push(...body);
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
  } = detach || {};

  const XMIN = Math.max(0, Math.min(sweepXmin, sweepXmax));
  const XMAX = Math.max(0, Math.max(sweepXmin, sweepXmax));
  const STEP = Math.max(1, Math.floor(sweepStepX));
  const YFRONT = 5;
  const YMAX = Math.max(YFRONT + 10, sweepYmax);

  const liftRel = (dz: number) => ["G91", `G0 Z${toFixed(dz)} F6000`, "G90"];
  const setFan = (on: boolean) => (on ? ["M106 S255"] : ["M106 S0"]);
  const travelF = 48000;

  lines.push("; === DETACH_SEQUENCE_START ===");

  if (safeLift) lines.push(...liftRel(5));
  if (zOffsetMm && Math.abs(zOffsetMm) > 0) lines.push("; micro Z offset", ...liftRel(zOffsetMm));

  lines.push(`; --- bend plate ${bendCycles}x between Z${toFixed(bendBottomZ)} and Z${toFixed(bendTopZ)} ---`, "G90");
  for (let c = 0; c < Math.max(0, bendCycles); c++) {
    lines.push(`G1 Z${toFixed(bendBottomZ)} F${Math.max(100, Math.floor(bendFeed))}`);
    lines.push(`G1 Z${toFixed(bendTopZ)} F${Math.max(100, Math.floor(bendFeed))}`);
  }
  const midZ = (Number(bendTopZ) + Number(bendBottomZ)) / 2;
  lines.push(`G1 Z${toFixed(midZ)} F${Math.max(100, Math.floor(bendFeed))}`);

  lines.push("; --- sweeps ---", ...setFan(!!fanOn));

  const cols: number[] = [];
  for (let x = XMIN; x <= XMAX; x += STEP) cols.push(x);

  const sweepOnce = (feed: number) => {
    for (const x of cols) {
      lines.push(`G0 X${toFixed(x)} Y${toFixed(YFRONT)} F${travelF}`);
      lines.push(`G1 Y${toFixed(YMAX)} F${Math.max(100, Math.floor(feed))}`);
      lines.push(`G0 Y${toFixed(YFRONT)} F${travelF}`);
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
