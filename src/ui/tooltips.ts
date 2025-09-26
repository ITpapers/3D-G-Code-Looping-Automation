export function setupCoolModeToggle() {
const tempBox = document.getElementById('tempBox') as HTMLElement | null;
const timeBox = document.getElementById('timeBox') as HTMLElement | null;
function update() {
const mode = (document.querySelector('input[name="cool"]:checked') as HTMLInputElement)?.value || 'temp';
if (tempBox) tempBox.style.display = mode === 'temp' ? 'block' : 'none';
if (timeBox) timeBox.style.display = mode === 'time' ? 'block' : 'none';
}
document.querySelectorAll('input[name="cool"]').forEach(r => r.addEventListener('change', update));
update();
}