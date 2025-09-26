// src/core/threeMF/minimal.ts
import { asArrayBuffer } from "@util/binary";

/** LF -> CRLF, Studio is happier with CRLF G-code */
function toCRLF(u: Uint8Array): Uint8Array {
  for (let i = 0; i < u.length; i++) if (u[i] === 0x0d) return u; // already CRLF somewhere
  const out: number[] = [];
  for (let i = 0; i < u.length; i++) out.push(u[i] === 0x0a ? 0x0d : u[i], u[i] === 0x0a ? 0x0a : undefined as any);
  return new Uint8Array(out.filter((x) => x !== undefined));
}

function crc32(u8: Uint8Array): number {
  let c = ~0 >>> 0;
  for (let i = 0; i < u8.length; i++) {
    c ^= u8[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

/** Build a tiny ZIP that Studio/firmware can read as .gcode.3mf */
export function minimal3mf(plateIndex: number, gcodeBytes: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const nameG = `Metadata/plate_${Math.max(1, plateIndex)}.gcode`;
  const nameGBytes = enc.encode(nameG);

  const contentTypes = enc.encode(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
      `  <Default Extension="gcode" ContentType="text/plain"/>\n` +
      `</Types>`
  );
  const nameCT = `[Content_Types].xml`;
  const nameCTBytes = enc.encode(nameCT);

  const gcodeCRLF = toCRLF(gcodeBytes);

  type FileRec = { nameBytes: Uint8Array; data: Uint8Array };
  const files: FileRec[] = [
    { nameBytes: nameGBytes, data: gcodeCRLF },
    { nameBytes: nameCTBytes, data: contentTypes },
  ];

  // Local file headers + data
  const LFHS: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const data = f.data;
    const crc = crc32(data);
    const lfh = new Uint8Array(30 + f.nameBytes.length + data.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true);  // gpbf
    dv.setUint16(8, 0, true);  // store
    dv.setUint16(10, 0, true); // time
    dv.setUint16(12, 0, true); // date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, f.nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra
    lfh.set(f.nameBytes, 30);
    lfh.set(data, 30 + f.nameBytes.length);
    LFHS.push(lfh);
    offset += lfh.length;
  }

  // Central directory
  const CDs: Uint8Array[] = [];
  let rel = 0;
  for (const lfh of LFHS) {
    const nameLen = new DataView(lfh.buffer).getUint16(26, true);
    const nameBytes = new Uint8Array(lfh.buffer, 30, nameLen);
    const dataLen = new DataView(lfh.buffer).getUint32(22, true);
    const startOfData = 30 + nameLen;
    const dataBytes = new Uint8Array(lfh.buffer, startOfData, dataLen);
    const crc = crc32(dataBytes);

    const cd = new Uint8Array(46 + nameLen);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);  // version made
    cdv.setUint16(6, 20, true);  // version needed
    cdv.setUint16(8, 0, true);   // gpbf
    cdv.setUint16(10, 0, true);  // store
    cdv.setUint16(12, 0, true);  // time
    cdv.setUint16(14, 0, true);  // date
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, dataLen, true);
    cdv.setUint32(24, dataLen, true);
    cdv.setUint16(28, nameLen, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, rel, true);
    cd.set(nameBytes, 46);
    CDs.push(cd);
    rel += lfh.length;
  }

  const cdSize = CDs.reduce((a, b) => a + b.length, 0);
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

  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of LFHS) { out.set(part, p); p += part.length; }
  for (const part of CDs)  { out.set(part, p); p += part.length; }
  out.set(eocd, p);
  return out;
}
