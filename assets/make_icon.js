/* 우리집 식탁 앱 아이콘 생성 — 법랑 그린 바탕 + 밥그릇 + 김. 순수 node (외부 라이브러리 없음) */
const zlib=require('zlib'),fs=require('fs');
const W=512,H=512,SS=2,SW=W*SS,SH=H*SS; // 2배 슈퍼샘플링
const BG=[44,91,69],FG=[244,244,239]; // 파인 그린 / 종이 화이트

function inRoundRect(x,y,w,h,r){ // (0,0)-(w,h) 라운드 사각형 내부 판정
 const dx=Math.max(r-x,0,x-(w-r)),dy=Math.max(r-y,0,y-(h-r));
 return dx*dx+dy*dy<=r*r||(x>=r&&x<=w-r)||(y>=r&&y<=h-r)?(x>=0&&y>=0&&x<=w&&y<=h&&(dx===0||dy===0||dx*dx+dy*dy<=r*r)):false}
function distSeg(px,py,x,y0,y1){const cy=Math.max(y0,Math.min(py,y1));return Math.hypot(px-x,py-cy)}

const buf=Buffer.alloc(SW*SH*4);
const CX=SW/2, BOWL_Y=SH*0.60, BOWL_R=SW*0.30, RIM=SW*0.016;
for(let y=0;y<SH;y++)for(let x=0;x<SW;x++){
 const i=(y*SW+x)*4;
 if(!inRoundRect(x,y,SW,SH,SW*0.20)){buf[i+3]=0;continue}   // 모서리 밖 투명
 let c=BG;
 const dx=x-CX,dy=y-BOWL_Y;
 // 그릇: 상단 평평한 반원 + 림 라인
 if(dy>=0&&dx*dx+dy*dy<=BOWL_R*BOWL_R)c=FG;
 if(Math.abs(dy)<=RIM&&Math.abs(dx)<=BOWL_R)c=FG;
 // 굽(받침)
 if(y>BOWL_Y+BOWL_R*0.86&&y<BOWL_Y+BOWL_R*0.86+SW*0.035&&Math.abs(dx)<BOWL_R*0.38)c=FG;
 // 김 두 줄기 (세로 캡슐)
 if(distSeg(x,y,CX-SW*0.085,SH*0.27,SH*0.42)<=SW*0.020)c=FG;
 if(distSeg(x,y,CX+SW*0.085,SH*0.23,SH*0.38)<=SW*0.020)c=FG;
 buf[i]=c[0];buf[i+1]=c[1];buf[i+2]=c[2];buf[i+3]=255;
}
// 다운샘플 (2x2 평균)
const out=Buffer.alloc(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 for(let ch=0;ch<4;ch++){let s=0;
  for(let sy=0;sy<SS;sy++)for(let sx=0;sx<SS;sx++)s+=buf[(((y*SS+sy)*SW)+(x*SS+sx))*4+ch];
  out[(y*W+x)*4+ch]=Math.round(s/(SS*SS))}}
// PNG 인코딩
function crcTable(){const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t}
const CT=crcTable();
function crc32(b){let c=0xFFFFFFFF;for(const v of b)c=CT[(c^v)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function chunk(type,data){const t=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
 return Buffer.concat([len,t,data,crc])}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
const raw=Buffer.alloc(H*(1+W*4));
for(let y=0;y<H;y++){raw[y*(1+W*4)]=0;out.copy(raw,y*(1+W*4)+1,y*W*4,(y+1)*W*4)}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
 chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const dest=process.argv[2]||'icon.png';
fs.writeFileSync(dest,png);
console.log('생성:',dest,Math.round(png.length/1024)+'KB');
