// src/util/binary.ts
export function asArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);   // <-- always an ArrayBuffer
  new Uint8Array(ab).set(u8);                  // copy bytes
  return ab;
}
