/* Local ink segmentation. No OCR, trained model, saved boxes, or page-specific coordinates. */
const GlyphBoundaryDetector = (() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function quantile(a,q=.5){if(!a.length)return 0;const s=Array.from(a).sort((x,y)=>x-y);return s[Math.floor((s.length-1)*q)];}
  function smooth(a,r){r=Math.max(1,Math.round(r));const s=new Float64Array(a.length+1),o=new Float32Array(a.length);for(let i=0;i<a.length;i++)s[i+1]=s[i]+a[i];for(let i=0;i<a.length;i++){const l=Math.max(0,i-r),h=Math.min(a.length,i+r+1);o[i]=(s[h]-s[l])/(h-l);}return o;}
  function runs(a,t){const out=[];let start=-1;for(let i=0;i<=a.length;i++){if(i<a.length&&a[i]>t){if(start<0)start=i;}else if(start>=0){out.push([start,i]);start=-1;}}return out;}
  function join(ranges,gap){const out=[];for(const r of ranges){const p=out[out.length-1];if(p&&r[0]-p[1]<=gap)p[1]=r[1];else out.push([...r]);}return out;}
  function components(mask,w,h){
    const labels=new Int32Array(w*h),queue=new Int32Array(w*h),out=[];let id=0;
    for(let i=0;i<mask.length;i++)if(mask[i]&&!labels[i]){
      id++;let head=0,tail=1,x0=w,y0=h,x1=0,y1=0;queue[0]=i;labels[i]=id;
      while(head<tail){const p=queue[head++],y=Math.floor(p/w),x=p-y*w;x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);
        for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const n=yy*w+xx;if(mask[n]&&!labels[n]){labels[n]=id;queue[tail++]=n;}}}
      }
      out.push({id,area:tail,box:[x0,y0,x1,y1],w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2});
    }
    return {labels,items:out};
  }
  function segmentRows(proj,start,end,count,typH,parts=[]){
    const length=end-start;if(length<3)return [start,end];
    const sm=smooth(proj,Math.max(1,typH*.018));
    if(!count){
      const activity=smooth(proj,Math.max(1,typH*.10));
      const rs=join(runs(activity,quantile(activity.slice(start,end),.85)*.12),Math.max(2,typH*.04)).filter(r=>r[1]-r[0]>typH*.25&&r[1]>start&&r[0]<end);
      count=rs.length;
      if(count<2&&length>typH*2.4)count=Math.round(length/(typH*1.45));
      count=clamp(count||1,1,100);
    }
    count=Math.min(count,Math.floor(length/3));if(count<=1)return [start,end];
    const step=length/count,peak=Math.max(1,quantile(sm.slice(start,end),.9)),cross=new Float32Array(end+1);
    for(const p of parts)if(p.area>typH*typH*.07){for(let y=Math.max(start,p.box[1]+1);y<Math.min(end,p.box[3]);y++)cross[y]+=Math.min(1,p.area/(typH*typH*.2));}
    // Dynamic programming favours low-ink cuts while allowing unequal row heights.
    let prev=new Float64Array(end+1).fill(Infinity);prev[start]=0;const back=[];
    for(let k=1;k<count;k++){
      const lo=Math.max(start+k*3,Math.round(start+(k-.48)*step)),hi=Math.min(end-(count-k)*3,Math.round(start+(k+.48)*step));
      const next=new Float64Array(end+1).fill(Infinity),parents=new Int32Array(end+1).fill(-1);
      for(let y=lo;y<=hi;y++){
        const a=Math.max(start,Math.round(y-step*1.65)),b=Math.max(start,Math.round(y-step*.40));
        let best=Infinity,from=-1;for(let p=a;p<=b;p++)if(Number.isFinite(prev[p])){const d=(y-p-step)/step;const cost=prev[p]+d*d*2.5;if(cost<best){best=cost;from=p;}}
        if(from>=0){const ink=(sm[y]+(sm[y-1]||0)+(sm[y+1]||0))/(3*peak),offset=(y-start-k*step)/step;next[y]=best+ink*2.5+Math.min(2,cross[y])*1.4+offset*offset*1.5;parents[y]=from;}
      }
      back.push(parents);prev=next;
    }
    let last=-1,best=Infinity;for(let y=start;y<end;y++)if(Number.isFinite(prev[y])){const d=(end-y-step)/step,c=prev[y]+d*d*2.5;if(c<best){best=c;last=y;}}
    if(last<0)return Array.from({length:count+1},(_,i)=>Math.round(start+i*step));
    const cuts=[end];for(let k=count-2;k>=0;k--){cuts.push(last);last=back[k][last];}cuts.push(start);return cuts.reverse();
  }
  function detect({data,width:w,height:h},opts={}){
    if(!w||!h||!data||data.length!==w*h*4)throw new Error('图像数据无效');
    const threshold=clamp(Number(opts.threshold)||110,40,220),roi=opts.roi||[0,0,w,h];
    const [rx0,ry0,rx1,ry1]=roi.map(Math.round);if(rx0<0||ry0<0||rx1>w||ry1>h||rx1<=rx0||ry1<=ry0)throw new Error('分析范围无效');
    const mask=new Uint8Array(w*h);let inkCount=0;
    for(let y=ry0;y<ry1;y++)for(let x=rx0;x<rx1;x++){const p=y*w+x,k=p*4,alpha=data[k+3]/255,gray=(data[k]*.299+data[k+1]*.587+data[k+2]*.114)*alpha+255*(1-alpha);if(gray<threshold){mask[p]=1;inkCount++;}}
    if(inkCount<20)return {columns:[],boxes:[],warnings:['没有找到足够墨迹；可提高墨色阈值或缩小分析区域。']};
    const {labels,items}=components(mask,w,h);
    const large=items.filter(c=>c.area>=12&&c.w>2&&c.h>3).sort((a,b)=>b.area-a.area).slice(0,70);
    if(!large.length)return {columns:[],boxes:[],warnings:['墨迹太少，无法建立候选框。']};
    const typH=Math.max(8,quantile(large.map(c=>c.h),.55)),typW=Math.max(8,quantile(large.map(c=>c.w),.55));
    const areaFloor=Math.max(2,Math.round(quantile(large.map(c=>c.area),.5)*.003));
    const kept=new Uint8Array(items.length+1);
    for(const c of items)if(c.area>=areaFloor&&!(c.h>typH*3.5&&c.w<typW*.16)&&!(c.w>typW*4&&c.h<typH*.13))kept[c.id]=1;
    const xp=new Float32Array(w);
    for(let y=ry0;y<ry1;y++)for(let x=rx0;x<rx1;x++){const p=y*w+x;if(!kept[labels[p]])mask[p]=0;else xp[x]++;}
    const xs=smooth(xp,Math.max(1,typW*.035)),t=Math.max(1,quantile(xs.slice(rx0,rx1),.9)*.13);
    let intervals=join(runs(xs,t),Math.max(2,typW*.18)).filter(([a,b])=>b-a>=Math.max(5,typW*.16));
    intervals=intervals.filter(([a,b])=>{let sum=0;for(let x=a;x<b;x++)sum+=xp[x];return sum>=Math.max(30,typH*typW*.08);});
    if(!intervals.length)return {columns:[],boxes:[],warnings:['没有找到稳定文字列，请框选一列重试。']};
    const wide=intervals.filter(r=>r[1]-r[0]>typW*.5),medWidth=quantile((wide.length?wide:intervals).map(r=>r[1]-r[0]));
    let columns=intervals.map((r,i)=>{const l=i?Math.round((intervals[i-1][1]+r[0])/2):rx0,rr=i<intervals.length-1?Math.round((r[1]+intervals[i+1][0])/2):rx1;return {inkRange:r,range:[l,rr],kind:r[1]-r[0]<medWidth*.43?'printed':'handwritten'};});
    if(opts.layout==='释文')columns=columns.map(c=>({...c,kind:'printed'}));
    else columns=columns.filter(c=>c.kind!=='printed');
    if(opts.direction!=='ltr')columns.reverse();
    const boxes=[],warnings=[];let handColumn=0,textOffset=0,pairOffset=0,pairLength=0;
    for(let col=0;col<columns.length;col++){
      const c=columns[col],[left,right]=c.range,yp=new Float32Array(h);const pool=items.filter(p=>kept[p.id]&&p.cx>=left&&p.cx<right);
      const core=pool.filter(p=>p.area>=Math.max(areaFloor*4,typW*typH*.012));
      if(!core.length){c.boxes=[];continue;}
      let top=Math.min(...core.map(p=>p.box[1])),bottom=Math.max(...core.map(p=>p.box[3]));
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(mask[y*w+x])yp[y]++;
      const localH=c.kind==='printed'?Math.max(6,quantile(core.map(p=>p.h),.65)):typH;
      const expected=c.kind==='printed'?0:(Number(opts.rows)||0);
      const printRuns=c.kind==='printed'?join(runs(yp,.1),Math.max(1,localH*.20)).filter(r=>r[1]-r[0]>=localH*.35):[];
      const cuts=printRuns.length?[printRuns[0][0],...printRuns.slice(1).map((r,i)=>Math.round((printRuns[i][1]+r[0])/2)),printRuns[printRuns.length-1][1]]:segmentRows(yp,top,bottom,expected,localH,pool);
      const rowOf=p=>{let k=0;while(k<cuts.length-2&&p.cy>=cuts[k+1])k++;return k;};
      const anchors=pool.filter(p=>p.area>=typW*typH*.14),assignment=new Map();
      for(const p of pool){let owner=rowOf(p);if(c.kind!=='printed'&&p.area<typW*typH*.10){let nearest=null,best=Infinity,own=Infinity;for(const q of anchors){const dx=Math.max(0,q.box[0]-p.box[2],p.box[0]-q.box[2]),dy=Math.max(0,q.box[1]-p.box[3],p.box[1]-q.box[3]),dist=Math.hypot(dx,dy*1.3);if(rowOf(q)===owner)own=Math.min(own,dist);if(dist<best){best=dist;nearest=q;}}if(nearest&&Number.isFinite(own)&&best<own*.55&&best<typH*.35)owner=rowOf(nearest);}assignment.set(p.id,owner);}
      const style=c.kind==='printed'?'释文':opts.layout==='真草相间'?(handColumn%2?'草书':'楷书'):(opts.layout||'楷书');
      const offset=c.kind==='printed'?0:opts.layout==='真草相间'?pairOffset:textOffset;
      c.boxes=[];c.style=style;c.cuts=cuts;c.localHeight=localH;
      for(let row=0;row<cuts.length-1;row++){
        const a=cuts[row],b=cuts[row+1];let x0=right,x1=left,y0=b,y1=a,area=0;
        // Keep components whose majority lies in this row; ignore isolated dust.
        const assigned=pool.filter(p=>assignment.get(p.id)===row&&p.area>=Math.max(areaFloor,c.kind==='printed'?2:typW*typH*.004));
        const valid=new Set(assigned.map(p=>p.id));
        for(let y=a;y<b;y++)for(let x=left;x<right;x++){const p=y*w+x;if(mask[p]&&valid.has(labels[p])){x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);area++;}}
        const flags=[];if(assigned.some(p=>p.box[1]<a-2||p.box[3]>b+2))flags.push('墨迹跨越预估字界');if(area<Math.max(6,typW*typH*.018)){flags.push('墨迹稀少或残损');if(area<3)continue;}
        if(row&&yp[a]>Math.max(2,quantile(yp.slice(top,bottom),.9)*.15))flags.push('上边界可能经过连笔');
        if(row<cuts.length-2&&yp[b]>Math.max(2,quantile(yp.slice(top,bottom),.9)*.15))flags.push('下边界可能经过连笔');
        if(x1-x0>(right-left)*.95)flags.push('笔画接近列界');
        if(area<typW*typH*.15&&c.kind!=='printed')flags.push('墨迹较少，检查残损或漏笔');
        if(assigned.length){x0=Math.min(...assigned.map(p=>p.box[0]));x1=Math.max(...assigned.map(p=>p.box[2]));y0=Math.min(...assigned.map(p=>p.box[1]));y1=Math.max(...assigned.map(p=>p.box[3]));}
        const pad=Math.max(0,Math.round(Number.isFinite(Number(opts.padding))?Number(opts.padding):3));
        const box=[clamp(x0-pad,rx0,rx1-1),clamp(y0-pad,ry0,ry1-1),clamp(x1+pad,rx0+1,rx1),clamp(y1+pad,ry0+1,ry1)];
        const rec={box,style,column:col+1,row:row+1,textIndex:offset+row,flags,inkArea:area,splitRange:[a,b]};boxes.push(rec);c.boxes.push(rec);
      }
      if(expected&&c.boxes.length!==expected)warnings.push('第'+(col+1)+'列只找到'+c.boxes.length+'个有效框，少于设定的'+expected+'字；检查连笔、残损或分析范围。');
      if(c.kind!=='printed'){handColumn++;textOffset+=cuts.length-1;if(opts.layout==='真草相间'){if(handColumn%2)pairLength=cuts.length-1;else{if(pairLength!==cuts.length-1)warnings.push('第'+Math.ceil(handColumn/2)+'组楷草字数不同，请核对字序；可设置每列字数后重试。');pairOffset+=Math.max(pairLength,cuts.length-1);}}}
    }
    if(opts.includePrinted&&opts.layout!=='释文'&&columns.length){
      const minX=Math.min(...columns.map(c=>c.inkRange[0])),maxX=Math.max(...columns.map(c=>c.inkRange[1]));
      const margins=[[rx0,ry0,Math.floor(minX-typW*.3),ry1],[Math.ceil(maxX+typW*.3),ry0,rx1,ry1]];
      for(const margin of margins)if(margin[2]-margin[0]>=12){const extra=detect({data,width:w,height:h},{...opts,roi:margin,layout:'释文',threshold:Math.max(185,threshold),rows:0,includePrinted:false});if(extra.boxes.length>=4){for(const c of extra.columns){c.style='释文';columns.push(c);}for(const b of extra.boxes)boxes.push({...b,style:'释文',column:columns.length});}}
    }
    if(!boxes.length)warnings.push('未生成候选框，请调整阈值或框选较小区域。');
    if(opts.layout==='真草相间'&&handColumn%2)warnings.push('手写列数为奇数，请检查是否漏列，或改选单一书体。');
    return {columns,boxes,warnings,metrics:{threshold,typicalWidth:typW,typicalHeight:typH,components:items.length,inkCount}};
  }
  return {detect,segmentRows};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=GlyphBoundaryDetector;
