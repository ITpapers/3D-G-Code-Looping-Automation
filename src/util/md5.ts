// src/util/md5.ts — minimal MD5, returns UPPERCASE hex
export function md5Hex(u8: Uint8Array): string {
  function toHex(a:number){return ("00000000"+(a>>>0).toString(16)).slice(-8);}
  function rrot(a:number,b:number){return (a>>>b)|(a<<(32-b));}
  const F=(x:number,y:number,z:number)=>(x&y)|((~x)&z);
  const G=(x:number,y:number,z:number)=>(x&z)|(y&(~z));
  const H=(x:number,y:number,z:number)=>x^y^z;
  const I=(x:number,y:number,z:number)=>y^(x|(~z));
  const K = new Uint32Array(64);
  for(let i=0;i<64;i++) K[i]=Math.floor(Math.abs(Math.sin(i+1))*2**32);
  const bytes = new Uint8Array(((u8.length+9+63)&~63));
  bytes.set(u8); bytes[u8.length]=0x80;
  new DataView(bytes.buffer).setUint32(bytes.length-4, u8.length*8, true);
  let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
  const dv=new DataView(bytes.buffer);
  const rot=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  for(let i=0;i<bytes.length;i+=64){
    let a=a0,b=b0,c=c0,d=d0;
    const M=new Uint32Array(16);
    for(let j=0;j<16;j++) M[j]=dv.getUint32(i+j*4,true);
    for(let j=0;j<64;j++){
      let f=0,g=0,rr=0;
      if(j<16){f=F(b,c,d); g=j; rr=rot[(j%4)];}
      else if(j<32){f=G(b,c,d); g=(5*j+1)%16; rr=rot[4+(j%4)];}
      else if(j<48){f=H(b,c,d); g=(3*j+5)%16; rr=rot[8+(j%4)];}
      else {f=I(b,c,d); g=(7*j)%16; rr=rot[12+(j%4)];}
      const t=(a + f + K[j] + M[g])>>>0;
      a=d; d=c; c=b; b=(b + ((t>>>rr)|(t<<(32-rr))))>>>0;
    }
    a0=(a0+a)>>>0; b0=(b0+b)>>>0; c0=(c0+c)>>>0; d0=(d0+d)>>>0;
  }
  const hex=(toHex(a0)+toHex(b0)+toHex(c0)+toHex(d0)).toUpperCase();
  return hex.slice(0,32);
}
