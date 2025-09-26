// src/core/gcode/structure.ts
// Tolerant, case-insensitive markers; allows extra spaces and multiple semicolons
const rHeaderStart = /^;+\s*HEADER_BLOCK_START\b/i;
const rHeaderEnd   = /^;+\s*HEADER_BLOCK_END\b/i;
const rConfigStart = /^;+\s*CONFIG_BLOCK_START\b/i;
const rConfigEnd   = /^;+\s*CONFIG_BLOCK_END\b/i;

// Some repos insert a non-standard comment we want to ignore
const rNonStandardEndNote = /^;+\s*END gcode\s*\(.*\)\s*$/i;

export function splitBambuGcodeByBlocks(gcode: string) {
  const eol = gcode.includes("\r\n") ? "\r\n" : "\n";
  const lines = gcode.split(/\r?\n/);

  let idxHeaderStart = -1, idxHeaderEnd = -1;
  let idxConfigStart = -1, idxConfigEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (idxHeaderStart < 0 && rHeaderStart.test(t)) { idxHeaderStart = i; continue; }
    if (idxHeaderStart >= 0 && idxHeaderEnd < 0 && rHeaderEnd.test(t)) { idxHeaderEnd = i; continue; }
    if (idxHeaderEnd >= 0 && idxConfigStart < 0 && rConfigStart.test(t)) { idxConfigStart = i; continue; }
    if (idxConfigStart >= 0 && idxConfigEnd < 0 && rConfigEnd.test(t)) { idxConfigEnd = i; continue; }
  }

  if (idxHeaderStart < 0 || idxHeaderEnd < 0 || idxConfigStart < 0 || idxConfigEnd < 0) {
    throw new Error("Invalid Bambu G-code: missing HEADER/CONFIG block markers");
  }

  const head   = lines.slice(0, idxHeaderStart);
  const header = lines.slice(idxHeaderStart, idxHeaderEnd + 1);
  const config = lines.slice(idxConfigStart, idxConfigEnd + 1);
  const body   = lines.slice(idxConfigEnd + 1).filter(l => !rNonStandardEndNote.test(l.trim()));

  return { head, header, config, body, eol };
}

export function makeLoopedGcode(original: string, loops: number) {
  const { head, header, config, body, eol } = splitBambuGcodeByBlocks(original);
  const repeated: string[] = [];
  for (let i = 0; i < Math.max(1, loops); i++) repeated.push(...body);
  return [...head, ...header, ...config, ...repeated].join(eol);
}
