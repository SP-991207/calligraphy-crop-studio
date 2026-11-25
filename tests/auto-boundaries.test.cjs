const assert=require('node:assert/strict');
const fs=require('node:fs');
const D=require('../auto-boundaries.js');
function fixture(gray=15){const width=260,height=260,data=new Uint8ClampedArray(width*height*4).fill(255);function rect(x,y,w,h,g=gray){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*width+xx)*4;data[i]=data[i+1]=data[i+2]=g;}}
 const refs=[];for(const x of [50,180])for(const y of [35,105,175]){rect(x,y,26,4);rect(x,y+4,5,23);rect(x+21,y+4,5,23);rect(x,y+27,26,4);rect(x+9,y+10,7,10);refs.push([x,y,x+26,y+31]);}for(let i=0;i<45;i++)rect((i*31)%258,(i*53)%258,1,1);return {image:{data,width,height},refs};}
function valid(r,w,h){for(const b of r.boxes){assert(b.box.every(Number.isInteger));assert(b.box[0]>=0&&b.box[1]>=0&&b.box[2]<=w&&b.box[3]<=h);assert(b.box[0]<b.box[2]&&b.box[1]<b.box[3]);}}
const f=fixture();
const r=D.detect(f.image,{rows:3,layout:'真草相间',padding:2});assert.equal(r.columns.length,2);assert.equal(r.boxes.length,6);assert.deepEqual(r.boxes.map(b=>b.style),['楷书','楷书','楷书','草书','草书','草书']);assert.deepEqual(r.boxes.map(b=>b.textIndex),[0,1,2,0,1,2]);valid(r,260,260);
for(const ref of f.refs)assert(r.boxes.some(({box:b})=>b[0]<=ref[0]&&b[1]<=ref[1]&&b[2]>=ref[2]&&b[3]>=ref[3]));
const subset=D.detect(f.image,{roi:[130,0,260,260],rows:3,layout:'楷书'});assert.equal(subset.boxes.length,3);assert(subset.boxes.every(b=>b.box[0]>=130));
const automatic=D.detect(f.image,{rows:0,layout:'真草相间'});assert.equal(automatic.boxes.length,6);
const ltr=D.detect(f.image,{rows:3,layout:'楷书',direction:'ltr'});assert(ltr.boxes[0].box[0]<ltr.boxes.at(-1).box[0]);
const blank={width:100,height:100,data:new Uint8ClampedArray(40000).fill(255)};assert.equal(D.detect(blank).boxes.length,0);
const transparent={...blank,data:new Uint8ClampedArray(40000)};assert.equal(D.detect(transparent).boxes.length,0);
const faint=fixture(160);assert.equal(D.detect(faint.image,{threshold:110,rows:3}).boxes.length,0);assert.equal(D.detect(faint.image,{threshold:190,rows:3}).boxes.length,6);
assert.throws(()=>D.detect(f.image,{roi:[-2,0,100,100]}),/分析范围/);
const touching=fixture();for(let y=35;y<205;y++){const k=(y*260+50)*4;touching.image.data[k]=touching.image.data[k+1]=touching.image.data[k+2]=0;}
const t=D.detect(touching.image,{rows:3});assert(t.warnings.length||t.boxes.some(b=>b.flags.length));
console.log('PASS: column detection, row segmentation, reading order, paired indices, ROI, faint ink, blank/transparent pages, noise and connected glyphs');
if(process.argv[2]){const meta=JSON.parse(fs.readFileSync(process.argv[3]));const image={data:new Uint8ClampedArray(fs.readFileSync(process.argv[2])),width:meta.width,height:meta.height};for(const includePrinted of [false,true]){const t0=Date.now(),out=D.detect(image,{rows:10,layout:'真草相间',includePrinted,padding:4});assert.equal(out.boxes.filter(b=>b.style==='楷书').length,30);assert.equal(out.boxes.filter(b=>b.style==='草书').length,30);assert.equal(out.boxes.filter(b=>b.style==='释文').length,includePrinted?30:0);valid(out,image.width,image.height);console.log('PASS: supplied manuscript, '+out.boxes.length+' image-derived candidates in '+(Date.now()-t0)+' ms');}}
