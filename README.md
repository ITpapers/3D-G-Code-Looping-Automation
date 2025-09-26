# Bambu Loop Pro — Automated 3D Print Looping Tool

## Overview
**Bambu Loop Pro** is a browser-based tool that automates repetitive 3D printing workflows on Bambu Lab printers (tested on P1P).  
It removes the need for manual interventions between prints by intelligently modifying `.3mf` project files to include:
- Automatic **looping of prints** (run the same job N times).
- Configurable **cool-down** and **bed detachment cycles**.
- **Sweeping motions** and **bending routines** for reliable part ejection.
- Automatic removal of **purge lines**, saving filament and time.
- Full `.3mf` compatibility with **Bambu Studio**, including geometry, metadata, thumbnails, and updated checksums.

The result: unattended multi-cycle printing with consistent quality, minimal waste, and higher throughput.

---

## ✨ Features
- **Upload any `.3mf` sliced in Bambu Studio** → tool extracts and processes embedded G-code.
- **Custom Loop Settings**:
  - Number of loops
  - Cool-down mode (temperature-based `M190 R` or time-based `G4 dwell`)
  - Bed bending motion (Z-cycles, feedrate)
  - Sweep coverage (X-min/X-max, Y-max, passes, feedrate)
  - Safety features (fan on, safe Z-lift, re-home XY between loops)
- **Automatic purge line removal** at the start of each loop.
- **CRLF normalization + MD5 hash sync** to ensure Studio accepts regenerated `.3mf` files.
- **Preserves all original project data** (geometry, images, configs) while swapping in the modified G-code.

---

## 🚀 Productivity Impact
Before this tool, every print cycle required:
- Manually cooling the bed
- Removing parts by hand
- Restarting the job in Studio

With **Bambu Loop Pro**, prints eject themselves, and the next loop starts automatically.  
In our business (electronics refurbishing and custom accessories), this cut operator time by **~60% per day** and increased overnight unattended output by **3×**.

---

## 🛠️ Tech Stack
- **TypeScript + Vite** — modern dev setup
- **Custom ZIP parser/writer** — Central Directory parsing, DEFLATE handling
- **MD5 checksum generator** — ensures `.gcode.md5` validity
- **Browser-native APIs**:
  - `CompressionStream` / `DecompressionStream`
  - `Blob` + `File` + `ArrayBuffer` utilities
- **No servers required** — runs 100% in the browser

---

## 🔧 Usage
1. Slice your model in **Bambu Studio** and export as `.gcode.3mf`.
2. Open the tool in your browser (`npm run dev` during development).
3. Upload the `.3mf` file.
4. Configure loop, cooldown, sweep, and bend settings.
5. Download the modified `.3mf`.
6. Open it in **Bambu Studio** or send directly to printer.

---

## 📊 Results
- **Eliminated purge line** → saved ~0.3g filament per cycle.
- **Automated detachment** → reduced bed wear and human handling.
- **Continuous print queue** → printers now run **unattended overnight**.
- **Consistent quality** → repeatable sweeps and bends reduced failed detachments by 90%.

---

## 🔮 Future Roadmap
- Support for **multi-plate jobs**.
- Queue multiple `.3mf` models into one automated run.
- Advanced error handling and preview diffing.
- Cross-browser compatibility (Chrome/Edge stable, workarounds for Firefox).

---

## 📷 Screenshots
<img width="1039" height="1222" alt="image" src="https://github.com/user-attachments/assets/434f8895-35a6-49af-8176-4647b70ef3bd" />

