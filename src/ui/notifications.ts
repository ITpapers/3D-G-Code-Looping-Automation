export function notifyError(e: unknown) {
const msg = e instanceof Error ? e.message : String(e);
alert(msg);
}