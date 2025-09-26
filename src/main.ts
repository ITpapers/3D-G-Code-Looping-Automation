// src/main.ts
import { populateFromFile, currentSettings, buildAndPrepareDownload } from "@ui/state-pane";
import { setupCoolModeToggle } from "@ui/tooltips";

document.addEventListener("DOMContentLoaded", () => {
  // wire the cooling mode radios to show/hide inputs
  setupCoolModeToggle();

  const fileEl = document.getElementById("file") as HTMLInputElement | null;
  const buildBtn = document.getElementById("build") as HTMLButtonElement | null;
  const dlBtn = document.getElementById("download") as HTMLButtonElement | null;
  const dlName = document.getElementById("dlname") as HTMLSpanElement | null;

  fileEl?.addEventListener("change", async () => {
    const f = fileEl.files?.[0];
    if (!f) return;
    try {
      const u8 = new Uint8Array(await f.arrayBuffer());
      await populateFromFile(f.name, u8);
    } catch (err: any) {
      alert(err?.message ?? String(err));
    }
  });

  buildBtn?.addEventListener("click", async () => {
    try {
      const out = await buildAndPrepareDownload(currentSettings());
      if (out) {
        const { url, filename, previewText } = out;
        if (dlBtn) {
          dlBtn.disabled = false;
          dlBtn.onclick = () => {
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
          };
        }
        if (dlName) {
          dlName.style.display = "inline-block";
          dlName.textContent = filename;
        }
        const preview = document.getElementById("preview");
        if (preview) preview.textContent = previewText.split("\n").slice(0, 120).join("\n");
      }
    } catch (err: any) {
      alert(err?.message ?? String(err));
    }
  });
});
