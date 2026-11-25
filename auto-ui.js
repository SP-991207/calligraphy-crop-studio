// Automatic candidates are separate from saved records until explicitly accepted.
function clearAuto(){autoCandidates=[];autoROI=null;$('autoBar').style.display='none';$('saveProject').disabled=false;$('exportAll').disabled=false;renderList();}
function drawAutoPreview(){if(!autoCandidates.length)return;ctx.save();ctx.setLineDash([5,3]);ctx.lineWidth=2;ctx.font='12px system-ui';for(const r of autoCandidates){const [x,y,x2,y2]=r.box.map(v=>v*scale);ctx.strokeStyle=r.auto_flags.length?'#c07d19':'#2479ac';ctx.strokeRect(x,y,x2-x,y2-y);if(scale>=.32){ctx.setLineDash([]);const text=r.index+' '+r.label,w=ctx.measureText(text).width+8;ctx.fillStyle=ctx.strokeStyle;ctx.fillRect(x,Math.max(0,y-18),w,17);ctx.fillStyle='#fff';ctx.fillText(text,x+4,Math.max(12,y-5));ctx.setLineDash([5,3]);}}ctx.restore();}
function readAutoOptions(){const rows=Number($('autoRows').value),threshold=Number($('autoThreshold').value),padding=Number($('autoPadding').value),start=Number($('autoStartIndex').value);if(!Number.isInteger(rows)||rows<0||rows>100||!Number.isFinite(threshold)||threshold<40||threshold>220||!Number.isFinite(padding)||padding<0||padding>40||!Number.isInteger(start)||start<1||start>99000)throw new Error('请检查字数、首字序号、墨色阈值与留白。');return {rows,threshold,padding,start,layout:$('autoLayout').value,direction:$('autoDirection').value,includePrinted:$('autoPrinted').checked,chars:strip($('autoText').value),merge:$('autoMerge').value};}
$('onlyIssues').onchange=()=>{renderList();draw();};
$('autoBtn').onclick=()=>$('autoDialog').showModal();$('autoCancel').onclick=()=>$('autoDialog').close();
$('autoWhole').onclick=()=>{try{autoConfig=readAutoOptions();$('autoDialog').close();runAuto([0,0,image.width,image.height]);}catch(e){msg(e.message);}};
$('autoRegion').onclick=()=>{try{autoConfig=readAutoOptions();$('autoDialog').close();clearAuto();setMode('auto');$('modeHint').textContent='自动找字界：在原图拖出需要分析的区域；Esc取消。可先缩小视图，再框选整列。';}catch(e){msg(e.message);}};
$('autoReturn').onclick=()=>$('autoDialog').showModal();$('autoDiscard').onclick=()=>{clearAuto();draw();msg('候选已放弃，已有字框保持原样。');};
async function runAuto(roi){
  if(!image.width||!autoConfig)return;const cfg={...autoConfig,chars:[...autoConfig.chars]};clearAuto();
  $('busyText').textContent='正在寻找文字列与字界…';$('busy').style.display='flex';await new Promise(resolve=>setTimeout(resolve,20));
  try{
    const ratio=Math.min(1,1800/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*ratio)),h=Math.max(1,Math.round(image.height*ratio));
    const analysis=document.createElement('canvas');analysis.width=w;analysis.height=h;const ac=analysis.getContext('2d',{willReadFrequently:true});ac.fillStyle='#fff';ac.fillRect(0,0,w,h);ac.drawImage(image,0,0,w,h);const sx=w/image.width,sy=h/image.height;
    const region=[Math.max(0,Math.floor(roi[0]*sx)),Math.max(0,Math.floor(roi[1]*sy)),Math.min(w,Math.ceil(roi[2]*sx)),Math.min(h,Math.ceil(roi[3]*sy))];
    const result=GlyphBoundaryDetector.detect(ac.getImageData(0,0,w,h),{...cfg,padding:cfg.padding*Math.min(sx,sy),roi:region});
    const candidates=result.boxes.map(b=>{
      const box=[Math.max(0,Math.floor(b.box[0]/sx)),Math.max(0,Math.floor(b.box[1]/sy)),Math.min(image.width,Math.ceil(b.box[2]/sx)),Math.min(image.height,Math.ceil(b.box[3]/sy))];
      const label=cfg.chars[b.textIndex]||'待定',r=newRecord(box,b.style,cfg.start+b.textIndex,label);
      r.origin='auto-boundaries-v1';r.auto_flags=b.flags;r.auto_column=b.column;r.auto_row=b.row;r.note='自动寻找字界；待人工校对'+(b.flags.length?'；'+b.flags.join('；'):'');return r;
    }).filter(r=>r.box[2]>r.box[0]&&r.box[3]>r.box[1]);
    if(!candidates.length){msg(result.warnings.join('；')||'未找到稳定文字列，请框选较小区域或调整墨色。');return;}
    if(candidates.length>1500)throw new Error('候选过多，请缩小分析区域后重试。');
    autoConfig=cfg;autoCandidates=candidates;autoROI=[...roi];setMode('select');
    const counts=['楷书','草书','释文'].map(s=>[s,candidates.filter(r=>r.style===s).length]).filter(x=>x[1]);
    const uncertain=candidates.filter(r=>r.auto_flags.length).length;
    $('autoSummary').textContent='找到 '+candidates.length+' 个候选框 · '+counts.map(([s,n])=>s+n).join(' / ')+' · '+uncertain+' 个需重点复核';
    const warnings=[...result.warnings],needed=Math.max(...candidates.map(r=>r.index-cfg.start))+1;
    if(cfg.chars.length&&cfg.chars.length!==needed)warnings.push('输入释文'+cfg.chars.length+'字，候选字序需要'+needed+'字；请核对字数和配对。');
    if(!cfg.chars.length)warnings.push('未输入释文，候选暂标「待定」；采用后可逐字填写。');
    if(!cfg.rows&&cfg.layout!=='释文')warnings.push('字数为自动估计；若漏分或多分，请填写每列实际字数后重试。');
    $('autoWarnings').textContent=warnings.join(' ');$('autoBar').style.display='flex';$('saveProject').disabled=true;$('exportAll').disabled=true;updateSaveControls();renderList();draw();msg('候选已显示。请检查后采用，或调整参数重新寻找。');
  }catch(e){msg('自动寻找失败：'+e.message);}finally{$('busy').style.display='none';}
}
function overlapRatio(a,b){const w=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),h=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));return w*h/Math.max(1,Math.min((a[2]-a[0])*(a[3]-a[1]),(b[2]-b[0])*(b[3]-b[1])));}
$('autoApply').onclick=()=>{
  if(!autoCandidates.length||!autoROI)return;
  const pending=autoCandidates,region=autoROI,cfg=autoConfig,styles=new Set(pending.map(r=>r.style));
  const inside=r=>{const b=r.box,x=(b[0]+b[2])/2,y=(b[1]+b[3])/2;return x>=region[0]&&x<=region[2]&&y>=region[1]&&y<=region[3];};
  const preserved=cfg.merge==='replace'?records.filter(r=>r.reviewed||!inside(r)||!styles.has(r.style)):[...records];
  const added=pending.filter(r=>!preserved.some(p=>p.style===r.style&&overlapRatio(p.box,r.box)>.45));
  if(preserved.length+added.length>5000){msg('项目最多保存5000个框，请分成多个项目整理。');return;}
  const removed=records.length-preserved.length;checkpoint();records=[...preserved,...added];selected=added[0]?.id||preserved[0]?.id||null;clearAuto();filter='全部';$('onlyIssues').checked=false;$('search').value='';for(const b of $('filters').children)b.classList.toggle('active',b.dataset.style==='全部');markDirty();refresh();msg('已加入'+added.length+'个候选框，替换'+removed+'个未校对框；已校对框保留。');
};
