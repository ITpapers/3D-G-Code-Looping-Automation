// Create a Blob from bytes with a guaranteed ArrayBuffer backing.
// We copy the data so the new view is backed by a normal ArrayBuffer,
// not a potential SharedArrayBuffer that upsets TypeScript DOM types.
export function u8ToBlob(u8: Uint8Array, type?: string): Blob {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return new Blob([copy], type ? { type } : {});
}
