// src/core/threeMF/zip-write.ts
function crc32(u8: Uint8Array): number {
  let c = ~0 >>> 0;
  for (let i = 0; i < u8.length; i++) {
    c ^= u8[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

export type ZipIn = {
  name: string;
  comp: 0 | 8;        // 0=store, 8=deflate-raw (payload already compressed)
  data: Uint8Array;   // raw payload (compressed if comp=8)
  crc?: number;       // CRC of *uncompressed* data (required for comp=8 unless Studio ignores)
  csize?: number;     // compressed size (defaults to data.length)
  usize?: number;     // uncompressed size (required for comp=8 for best compatibility)
};

export async function writeZipFromEntries(files: ZipIn[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const lfh: Uint8Array[] = [];
  const cds: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const csize = f.csize ?? f.data.length;
    const usize = f.usize ?? (f.comp === 0 ? f.data.length : 0);
    const crc   = f.crc   ?? (f.comp === 0 ? crc32(f.data)    : 0);

    // Local File Header
    const L = new Uint8Array(30 + nameBytes.length + f.data.length);
    const dv = new DataView(L.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);    // version needed
    dv.setUint16(6, 0, true);     // gpbf
    dv.setUint16(8, f.comp, true);
    dv.setUint16(10, 0, true);    // mod time
    dv.setUint16(12, 0, true);    // mod date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, csize, true);
    dv.setUint32(22, usize, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    L.set(nameBytes, 30);
    L.set(f.data, 30 + nameBytes.length);
    lfh.push(L);

    // Central Directory
    const cd = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);   // version made by
    cdv.setUint16(6, 20, true);   // version needed
    cdv.setUint16(8, 0, true);    // gpbf
    cdv.setUint16(10, f.comp, true);
    cdv.setUint16(12, 0, true);   // mod time
    cdv.setUint16(14, 0, true);   // mod date
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, csize, true);
    cdv.setUint32(24, usize, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    cds.push(cd);

    offset += L.length;
  }

  const cdSize = cds.reduce((a,b)=>a+b.length,0);
  const cdOffset = offset;
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, files.length, true);
  edv.setUint16(10, files.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, cdOffset, true);
  edv.setUint16(20, 0, true);

  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const part of lfh) { out.set(part, p); p += part.length; }
  for (const part of cds) { out.set(part, p); p += part.length; }
  out.set(eocd, p);
  return out;
}
