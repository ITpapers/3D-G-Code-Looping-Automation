// src/ui/dom.ts
import { populateFromFile, currentSettings, buildAndPrepareDownload } from "@ui/state-pane";
import { setupCoolModeToggle } from "@ui/tooltips";
import { showPreview } from "@ui/preview";
import { notifyError } from "@ui/notifications";

export function initDom() {
  const file = document.getElementById("file") as HTMLInputElement | null;
  const buildBtn = document.getElementById("build") as HTMLButtonElement | null;
  const dlBtn = document.getElementById("download") as HTMLButtonElement | null;
  const dlName = document.getElementById("dlname") as HTMLSpanElement | null;

  setupCoolModeToggle();

  file?.addEventListener("change", async () => {
    try {
      const f = file.files?.[0];
      if (!f) return;
      const bytes = new Uint8Array(await f.arrayBuffer());
      await populateFromFile(f.name, bytes);
    } catch (e) {
      notifyError(e);
    }
  });

  buildBtn?.addEventListener("click", async () => {
    try {
      const settings = currentSettings();
      const out = await buildAndPrepareDownload(settings);

      showPreview(out.previewText);

      if (dlBtn) {
        dlBtn.disabled = false;
        dlBtn.onclick = () => {
          const a = document.createElement("a");
          a.href = out.url;
          a.download = out.filename;
          a.click();
        };
      }
      if (dlName) {
        dlName.style.display = "inline-block";
        dlName.textContent = out.filename;
      }
    } catch (e) {
      notifyError(e);
    }
  });
}
