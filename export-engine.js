// Shared by the offline page, hosted page and export verification.
const GlyphExport = (() => {
  'use strict';
  const enc=new TextEncoder();
  const clean=v=>String(v||'待定').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,60);
  const copy=v=>JSON.parse(JSON.stringify(v));
  function fileName(r,labeled=false){return String(r.index).padStart(3,'0')+'_'+clean(r.label)+'_'+clean(r.style)+'_'+clean(r.id)+(labeled?'_带释文':'_原图')+'.png';}
  function createPlan(records,{scope='current',currentId,selectedIds=[],format='raw'}={}){
    if(!['current','selected','all'].includes(scope)||!['raw','labeled','both'].includes(format))throw new Error('保存选项无效。');
    const ids=new Set(selectedIds);const subset=records.filter(r=>scope==='all'||(scope==='current'?r.id===currentId:ids.has(r.id)));
    if(!subset.length)throw new Error(scope==='selected'?'请先在左侧目录勾选要保存的字。':scope==='current'?'请先点击一个单字。':'请先建立至少一个切割框。');
    const variants=format==='both'?['raw','labeled']:[format];
    return {scope,format,records:copy(subset),variants,imageCount:subset.length*variants.length,kind:subset.length*variants.length===1?'png':'zip'};
  }
  function csvCell(v){let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  async function buildFiles(plan,{sourceName,width,height,getPNG,onProgress=()=>{}}){
    const files=[],rows=[['序号','繁体对照','图像释文','印刷释文','类型','左','上','右','下','已校对','备注','原图路径','带释文路径']];let done=0;
    for(const r of plan.records){const paths={};for(const variant of plan.variants){const labeled=variant==='labeled',name=(labeled?'带释文单字/':'原图单字/')+clean(r.style)+'/'+fileName(r,labeled);const data=await getPNG(r,labeled);if(!(data instanceof Uint8Array))throw new Error('图片导出数据无效。');files.push({name,data});paths[variant]=name;onProgress(++done,plan.imageCount);}
      rows.push([r.index,r.char,r.label,r.printed_text||'',r.style,...r.box,r.reviewed?'是':'否',r.note||'',paths.raw||'',paths.labeled||'']);
    }
    files.push({name:'单字索引.csv',data:enc.encode('\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'))});
    const project={format:'qianzi-crop-project',version:1,source_name:sourceName,width,height,records:copy(plan.records),export_scope:plan.scope,export_format:plan.format};
    files.push({name:'切割坐标与释文.json',data:enc.encode(JSON.stringify(project,null,2))});
    files.push({name:'说明.txt',data:enc.encode('本次保存范围：'+({current:'当前单字',selected:'勾选的多个字',all:'全部字框'}[plan.scope])+'，共'+plan.records.length+'个字框、'+plan.imageCount+'张PNG。\n原图裁片直接使用原图像素，不缩放、不补笔。带释文图片在裁片外增加标签。\nCSV和坐标JSON仅包含本次保存的字框；坐标为左、上包含，右、下不包含。\n坐标JSON可搭配同名原图导入工具；完整原图与项目请使用“保存项目”。\n')});
    return files;
  }
  // ZIP method 0 (stored), UTF-8 filenames, standard CRC32; no network dependencies.
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function makeZip(files){const parts=[],central=[];let offset=0,centralSize=0;const enc=new TextEncoder();for(const f of files){const name=enc.encode(f.name),data=f.data,crc=crc32(data),local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);const h=new Uint8Array(46+name.length),v=new DataView(h.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);h.set(name,46);central.push(h);centralSize+=h.length;offset+=local.length+data.length;}const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});}
  return {createPlan,buildFiles,fileName,makeZip};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=GlyphExport;
