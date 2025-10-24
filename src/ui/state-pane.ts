// src/ui/state-pane.ts
import { settingsSchema } from "@core/schema";
import { buildLoopedGcode, maybeAdjustBedHold, stripPurgeFromStart, stripNozzleLoadLine } from "@core/gcode/build";
import { mergeGcodePreservingCompression } from "@core/threeMF/merge";
import { extractFirstGcode, listEntries } from "@core/threeMF/zip-read";
import { u8ToBlob } from "@util/blob";


let inName = "";
let originalZip: Uint8Array | null = null;
let originalEntries: ReturnType<typeof listEntries> | null = null;
let rawText = "";

export async function populateFromFile(filename: string, bytes: Uint8Array) {
  inName = filename.replace(/\s+/g, "_");

  // Enforce .3mf only
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error("Please upload a .gcode.3mf exported from Bambu Studio.");
  }

  // Preview G-code inside .3mf and keep full zip for merging
  const g = await extractFirstGcode(bytes);
  rawText = g.text;
  originalZip = bytes;
  originalEntries = listEntries(bytes);

  const info = document.getElementById("fileInfo");
  if (info) info.textContent = `Selected: ${filename} (${Math.round(bytes.length / 1024)} KB)`;

  const preview = document.getElementById("preview");
  if (preview) preview.textContent = rawText.split("\n").slice(0, 120).join("\n");
}

export function currentSettings() {
  const val = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value;
  const num = (id: string, d: number) => {
    const v = Number(val(id));
    return Number.isFinite(v) ? v : d;
  };
  const bool = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
  const mode =
    (document.querySelector('input[name="cool"]:checked') as HTMLInputElement)?.value || "temp";

  const unvalidated = {
    loops: num("loops", 1),
    plateIndex: num("plateIndex", 1),
    holdBedC: num("holdBed", 0) || undefined,
    detach: {
      zOffsetMm: num("zoffset", 0),
      fanOn: bool("fanOn"),
      auxOn: bool("auxOn"),
      homeBetween: bool("homeBetween"),
      safeLift: bool("safeLift"),

      coolMode: mode,
      coolTempC: num("coolTemp", 30),
      coolSeconds: num("coolSec", 3600),

      sweepsSlow: num("sweepsSlow", 0),
      sweepsFast: num("sweepsFast", 0),
      sweepFeedSlow: num("sweepFeedSlow", 3000),
      sweepFeedFast: num("sweepFeedFast", 12000),
      sweepStepX: num("sweepStep", 30),
      sweepYmax: num("sweepYmax", 250),

      // full-bed coverage params (if you added these inputs)
      sweepXmin: num("sweepXmin", 0),
      sweepXmax: num("sweepXmax", 220),

      bendTopZ: num("bendTop", 235),
      bendBottomZ: num("bendBottom", 200),
      bendCycles: num("bendCycles", 6),
      bendFeed: num("bendFeed", 12000),
    },
  } as const;

  return settingsSchema.parse(unvalidated);
}

export async function buildAndPrepareDownload(settings: ReturnType<typeof currentSettings>) {
  if (!rawText || !originalZip || !originalEntries) {
    throw new Error("Upload a .gcode.3mf first.");
  }

    // (A) Optional bed temp hold tweak first
  let working = settings.holdBedC && settings.holdBedC > 0
    ? maybeAdjustBedHold(rawText, settings.holdBedC)
    : rawText;

  // (B) Scrub trivial top-of-file purge comments (safe version)
  working = stripPurgeFromStart(working).text;

  // (B2) Remove the actual “nozzle load line” purge block
  const cut = stripNozzleLoadLine(working);
  working = cut.text;
  // (optional) you can log cut.removedCount if you want telemetry


  // (C) Build looped body with single header+config
  const newPlateText =  buildLoopedGcode(working, settings.loops, settings.detach);

// Encode to bytes; merge will preserve original EOLs and fix MD5
const resultBytes = new TextEncoder().encode(newPlateText);

// Always merge into the original 3mf
const merged = await mergeGcodePreservingCompression(
  originalZip,
  settings.plateIndex,
  resultBytes
);

const url = URL.createObjectURL(u8ToBlob(merged, "application/zip"));
const filename = `${inName.replace(/\.gcode(\.3mf)?/i, "")}__loopx${settings.loops}.gcode.3mf`;

// Preview
const preview = document.getElementById("preview");
if (preview) preview.textContent = newPlateText.split("\n").slice(0, 120).join("\n");

return { url, filename, previewText: newPlateText };
}
