export function showPreview(text: string) {
const preview = document.getElementById('preview');
if (!preview) return;
preview.textContent = text.split('\n').slice(0, 120).join('\n');
}