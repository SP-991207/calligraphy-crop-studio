function pruneMarked(){const valid=new Set(records.map(r=>r.id));marked=new Set([...marked].filter(id=>valid.has(id)));}
function updateSaveControls(){
  pruneMarked();const pending=autoCandidates.length>0,v=visible(),n=v.filter(r=>marked.has(r.id)).length,hidden=marked.size-n;
  $('selectionCount').textContent='已勾选 '+marked.size+' 个'+(hidden?'（另有 '+hidden+' 个不在当前列表）':'');
  $('selectVisible').checked=v.length>0&&n===v.length;$('selectVisible').indeterminate=n>0&&n<v.length;$('selectVisible').disabled=!v.length||pending;
  $('clearMarked').disabled=!marked.size||pending;$('exportAll').disabled=!records.length||pending;
}
function toggleMarked(id,checked){if(autoCandidates.length)return;if(checked)marked.add(id);else marked.delete(id);renderList();draw();}
$('selectVisible').onchange=()=>{const checked=$('selectVisible').checked;for(const r of visible())if(checked)marked.add(r.id);else marked.delete(r.id);renderList();draw();};
$('clearMarked').onclick=()=>{marked.clear();renderList();draw();};
function savePlan(){const scope=document.querySelector('input[name="saveScope"]:checked')?.value||'current';return GlyphExport.createPlan(records,{scope,currentId:selected,selectedIds:[...marked],format:$('saveFormat').value});}
function updateSaveSummary(){
  try{const p=savePlan(),raw=p.variants.includes('raw')?p.records.length:0,labeled=p.variants.includes('labeled')?p.records.length:0;
    $('saveSummary').textContent='本次保存 '+p.records.length+' 个字框，生成 '+raw+' 张原图裁片、'+labeled+' 张带释文图片。'+(p.kind==='zip'?'将打包为ZIP，并附本次范围的CSV索引和坐标JSON。':'将保存为一张PNG图片。');
    $('saveConfirm').disabled=false;$('saveConfirm').textContent=p.kind==='zip'?'准备 ZIP':'准备 PNG';
  }catch(e){$('saveSummary').textContent=e.message;$('saveConfirm').disabled=true;}
}
function openSaveDialog(){
  if(autoCandidates.length){msg('请先采用或放弃候选框，再保存图片。');return;}pruneMarked();
  $('scopeCurrent').disabled=!current();$('scopeSelected').disabled=!marked.size;$('scopeAll').disabled=!records.length;
  $('scopeCurrentCount').textContent=current()?current().label+' · '+current().style:'未选择';$('scopeSelectedCount').textContent=marked.size+' 个';$('scopeAllCount').textContent=records.length+' 个';
  const old=document.querySelector('input[name="saveScope"]:checked');if(!old||old.disabled)($('scopeCurrent').disabled?(marked.size?$('scopeSelected'):$('scopeAll')):$('scopeCurrent')).checked=true;
  updateSaveSummary();$('saveDialog').showModal();
}
for(const r of document.querySelectorAll('input[name="saveScope"]'))r.onchange=updateSaveSummary;$('saveFormat').onchange=updateSaveSummary;
$('saveCancel').onclick=()=>$('saveDialog').close();$('exportAll').onclick=openSaveDialog;
let preparedFileURL=null;
function offerSavedFile(blob,name,plan){
  if(preparedFileURL)URL.revokeObjectURL(preparedFileURL);preparedFileURL=URL.createObjectURL(blob);
  $('zipLink').href=preparedFileURL;$('zipLink').download=name;$('zipLink').textContent=plan.kind==='zip'?'下载 ZIP':'下载 PNG';
  $('readyTitle').textContent=plan.kind==='zip'?'切割图片包已备好':'单字图片已备好';
  $('zipSummary').textContent=({current:'当前单字',selected:'勾选的多个字',all:'全部字框'}[plan.scope])+'：'+plan.records.length+' 个字框，'+plan.imageCount+' 张图片。'+(plan.kind==='zip'?'附本次范围的CSV索引和坐标JSON。':'');
  $('zipDialog').showModal();
}
$('zipClose').onclick=()=>$('zipDialog').close();
$('saveConfirm').onclick=async()=>{
  let plan;try{plan=savePlan();}catch(e){msg(e.message);return;}
  const source=sourceName,sourceWidth=image.width,sourceHeight=image.height;
  $('saveDialog').close();$('busyText').textContent='正在准备保存图片…';$('busy').style.display='flex';await new Promise(resolve=>setTimeout(resolve,0));
  try{
    if(plan.kind==='png'){const labeled=plan.variants[0]==='labeled',r=plan.records[0];offerSavedFile(await png(cropCanvas(r,labeled)),GlyphExport.fileName(r,labeled),plan);}
    else{
      let lastYield=performance.now();
      const getPNG=async(r,labeled)=>{if(performance.now()-lastYield>35){await new Promise(resolve=>setTimeout(resolve,0));lastYield=performance.now();}const c=cropCanvas(r,labeled);if(c.width*c.height>4000000)return new Uint8Array(await (await png(c)).arrayBuffer());const binary=atob(c.toDataURL('image/png').split(',')[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;};
      const files=await GlyphExport.buildFiles(plan,{sourceName:source,width:sourceWidth,height:sourceHeight,getPNG,onProgress:(n,total)=>$('busyText').textContent='正在准备图片 '+n+' / '+total});
      const suffix={current:'当前单字',selected:'勾选'+plan.records.length+'字',all:'全部'+plan.records.length+'字'}[plan.scope];
      offerSavedFile(GlyphExport.makeZip(files),clean(source.replace(/\.[^.]+$/,''))+'_'+suffix+'_'+plan.format+'.zip',plan);
    }
  }catch(e){msg('保存失败：'+e.message);}finally{$('busy').style.display='none';}
};
