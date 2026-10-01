/* Zìwǎng character network: characters as nodes, linked by shared words or by the parts they're built from */
(function(){
const root=document.getElementById('map');if(!root)return;
const store={get(k,d){try{const v=localStorage.getItem('ziwang.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('ziwang.'+k,JSON.stringify(v))}catch(e){}}};
const esc0=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));

/* what this device can comfortably draw and simulate */
const small=matchMedia('(max-width:700px)').matches||(navigator.hardwareConcurrency||8)<=2||(navigator.deviceMemory||8)<=2;
const MAX_LINKS=small?7000:45000, MAX_NODES=small?700:1600;

root.innerHTML=`<div class="map-stage map-boot"><div class="map-load"><span class="spin" aria-hidden="true"></span><span>Loading the dictionary…</span></div></div>`;
if(!window.d3){root.innerHTML='<p class="g-loading">The network viewer couldn’t load. Check your connection and refresh.</p>';return}
(window.ZIWANG_READY||Promise.reject()).then(init).catch(()=>{root.innerHTML='<p class="g-loading">The dictionary didn’t load. Check your connection and refresh.</p>'});

function init(C){
  const {CH,WORDS,roleOf,esc,charPy,charDef,path,sylTone,pyHTMLJoined,LVNAME,rankBand}=C;
  /* HSK levels to include: any mix of 1–6, 7–9 (stored as 7) and 8 = common words beyond HSK. Kept as a sorted key like "1,4,5". */
  const lvKey=a=>[...new Set(a)].filter(l=>l>=1&&l<=8).sort((x,y)=>x-y).join(',')||'1';
  const lvArr=k=>k.split(',').map(Number);
  function lvLabel(k){
    const a=lvArr(k),h=a.filter(l=>l<=7),more=a.includes(8);
    if(!h.length)return 'Beyond HSK';
    if(h.length===7)return 'All HSK'+(more?' + more':'');
    const r=[];for(const l of h){const g=r[r.length-1];if(g&&l===g[1]+1)g[1]=l;else r.push([l,l])}
    return 'HSK '+r.map(([x,y])=>x===y?(x===7?'7–9':x):`${x}–${y===7?9:y}`).join(', ')+(more?' + more':'');
  }
  const LAYOUTS=[['force','Force-directed'],['fa2','ForceAtlas2'],['rings','Rings by distance'],['levels','Rings by HSK level'],['spiral','Frequency spiral'],['layers','Layered hierarchy']];
  const DEFAULTS={force:{distance:34,repulsion:70,gravity:.05,overlap:true},fa2:{scaling:2.5,gravity:1,strong:false,linlog:false,dissuade:false,weight:.5,overlap:true},layers:{spacing:80,repulsion:40,flip:false,overlap:true},rings:{spacing:120},levels:{spacing:1},spiral:{spacing:9}};
  const params=new URLSearchParams(location.search);
  const trail=store.get('trail',[]);
  let q=(params.get('q')||trail[trail.length-1]||'电').trim();
  let hops=params.has('hops')?+params.get('hops'):params.get('links')==='parts'?2:1, lv=params.has('hsk')?lvKey(params.get('hsk').split(',').map(Number)):params.has('lv')?lvKey(Array.from({length:Math.min(8,Math.max(1,+params.get('lv')||1))},(_,i)=>i+1)):'1';
  // a fresh link starts at HSK 1 up to the starting character's own level, so it opens with neighbours
  if(!params.has('hsk')&&!params.has('lv')){const top=Math.max(1,...[...q].map(c=>CH[c]&&CH[c].lv<=7?CH[c].lv:1));lv=lvKey(Array.from({length:top},(_,i)=>i+1))}
  let net=params.get('links')==='parts'?'parts':'words';
  // each kind of link keeps its own layout and node size; parts default to ForceAtlas2 sized by out-degree
  // the full parts network is a dense mesh around hub components, so it starts in ForceAtlas2 sized by out-degree
  const modeState={words:{layout:'force',size:'default'},parts:{layout:'force',size:'default'},partsFull:{layout:'fa2',size:'out'}};
  // Overview shows jumps or the full network; Explore starts from one character and grows with each click
  let view=params.get('view')==='overview'?'overview':'explore'; // links from the rest of the site open in Explore
  let shown=new Set(),opened=new Map(),hist=[],spawn=new Map(),curG=null;const BATCH=40;
  const isFull=()=>view==='overview'&&hops===0;
  const stateKey=()=>net==='parts'?(isFull()?'partsFull':'parts'):'words';
  let layout=params.get('layout')||modeState[stateKey()].layout,colour='auto',size=modeState[stateKey()].size,runSecs=6,edgesPref=null;
  let follow=['down','up'].includes(params.get('follow'))?params.get('follow'):'both';
  const roles={meaning:true,sound:true,picture:true,other:true};
  // word-link filters: dampen hub characters (cosine weighting) and keep only the backbone (disparity filter)
  const STRICT=[[3,'Light (3 per character)'],[2,'Medium (2 per character)'],[1,'Strict (1 per character)']];
  let dampen=params.get('hubs')==='damp',backbone=params.has('backbone'),alphaTh=+params.get('backbone')||2;
  if(!STRICT.some(x=>x[0]===alphaTh))alphaTh=2;
  // parts links form a dense mesh around a few hub components, so ForceAtlas2 starts with strong gravity there
  const clone=o=>JSON.parse(JSON.stringify(o)),DEF={words:DEFAULTS,parts:{...clone(DEFAULTS),fa2:{...DEFAULTS.fa2,strong:true}}};
  const SET={words:clone(DEF.words),parts:clone(DEF.parts)};let settings=SET[net];
  if(![0,1,2,3].includes(hops))hops=1;if(!LAYOUTS.some(l=>l[0]===layout)||(layout==='layers'&&net!=='parts'))layout=modeState[stateKey()].layout;

  root.innerHTML=`
  <div class="map-bar">
    <div class="map-seg" role="group" aria-label="Map mode">${[['overview','Overview'],['explore','Explore']].map(([k,n])=>`<button type="button" data-view="${k}">${n}</button>`).join('')}</div>
    <label class="map-lv">Links <select id="mapNet"><option value="words">Shared words</option><option value="parts">Character parts</option></select></label>
    <form class="map-seed" id="mapSeed" autocomplete="off"><input id="mapQ" type="text" lang="zh-Hans" aria-label="Character or word to centre on" placeholder="电 or 电脑"><button class="btn" type="submit">Show</button></form>
    <div class="map-seg" id="mapHops" role="group" aria-label="How far to reach">
      ${[[1,'1 jump'],[2,'2 jumps'],[3,'3 jumps'],[0,'Full network']].map(([k,n])=>`<button type="button" data-hops="${k}">${n}</button>`).join('')}
    </div>
    <div class="map-exp" id="mapExp" hidden><button class="btn" type="button" id="mapUndo" title="Undo (Ctrl+Z)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>Undo</button><button class="btn" type="button" id="mapRestart">Start over</button></div>
    <div class="map-lv map-lvpick"><span id="mapLvLab">Words</span>
      <button class="btn" type="button" id="mapLvBtn" aria-haspopup="true" aria-expanded="false" aria-controls="mapLvMenu"><span id="mapLvTxt">HSK 1</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="map-lvmenu" id="mapLvMenu" hidden role="group" aria-label="HSK levels to include">
        ${[1,2,3,4,5,6,7].map(l=>`<label class="ms-t"><input type="checkbox" data-lvl="${l}"> HSK ${l===7?'7–9':l}</label>`).join('')}
        <label class="ms-t" id="mapLv8"><input type="checkbox" data-lvl="8"> Beyond HSK <small>(common words)</small></label>
        <div class="map-lvq"><button type="button" class="btn" data-lvq="1">Only HSK 1</button><button type="button" class="btn" data-lvq="all">All HSK</button></div>
      </div></div>
    <button class="btn" type="button" id="mapSetBtn" aria-expanded="false" aria-controls="mapSettings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>Layout settings</button>
    <button class="btn icon" type="button" id="mapHelpBtn" aria-expanded="false" aria-controls="mapHelp" aria-label="How to read the network" title="How to read the network">?</button>
  </div>
  <div class="map-help" id="mapHelp" hidden>
    <p>Each circle is a character. Lines show how characters are connected.</p>
    <h3>Links</h3>
    <p><b>Shared words:</b> a line joins two characters that appear in a word together, like <span class="cn" lang="zh-Hans">电</span> and <span class="cn" lang="zh-Hans">脑</span> in <span class="cn" lang="zh-Hans">电脑</span>. Hover a line to see the word.</p>
    <p><b>Character parts:</b> an arrow points from a part to a character built with it, like <span class="cn" lang="zh-Hans">女 → 妈</span>. The colour shows the part’s job:</p>
    <ul><li><i class="sw-m"></i><b>meaning</b> hints at what it means (<span class="cn" lang="zh-Hans">女</span> in <span class="cn" lang="zh-Hans">妈</span>)</li><li><i class="sw-s"></i><b>sound</b> hints at how it’s said (<span class="cn" lang="zh-Hans">马</span> in <span class="cn" lang="zh-Hans">妈</span>)</li><li><i class="sw-p"></i><b>picture</b> draws the idea (the trees <span class="cn" lang="zh-Hans">木</span> in <span class="cn" lang="zh-Hans">林</span>)</li><li><i class="sw-o"></i><b>other</b> has no clear job, or is a shortcut from simplified writing</li></ul>
    <h3>Overview and Explore</h3>
    <p><b>Overview</b> shows everything within a few jumps of your character, or the whole network at once. <b>Explore</b> starts with just your character and its links. Click any character to open all of its links, and keep going. Double-click a character to start again from it. Undo takes a step back.</p>
    <h3>Filters</h3>
    <p>For shared words, Layout settings has two filters. <b>Dampen hub characters</b> stops very common characters from linking to everything. <b>Strongest links only</b> hides weaker links so the main structure shows.</p>
    <h3>Jumps</h3>
    <p>In Overview, how far out from your character to go. 1 jump shows its direct neighbours, 2 jumps their neighbours too. Full network shows every character at the chosen HSK levels.</p>
    <h3>Getting around</h3>
    <p>Drag empty space to move the map, and drag a character to move it. Scroll or pinch to zoom. Tap a character for details, and tap it again to put it in the centre. If things look tangled, open Layout settings and try another layout.</p>
    <button class="btn" type="button" id="mapHelpClose">Got it</button>
  </div>
  <div class="map-settings" id="mapSettings" hidden></div>
  <div class="map-stage" id="mapStage">
    <canvas id="mapCanvas" role="img" aria-label="Network of Chinese characters. Details appear below the map."></canvas>
    <div class="map-legend" id="mapLegend" hidden></div>
    <div class="map-tip" id="mapTip" hidden></div>
    <div class="map-zoom"><button type="button" class="btn" data-z="in" aria-label="Zoom in">+</button><button type="button" class="btn" data-z="out" aria-label="Zoom out">−</button><button type="button" class="btn" data-z="fit">Fit</button></div>
    <div class="map-run" id="mapRun"><div class="bar"><i id="mapProg"></i></div><span id="mapRunText"></span><button type="button" class="btn" id="mapRunBtn"></button></div>
    <div class="map-load" id="mapLoad" hidden><span class="spin" aria-hidden="true"></span><span id="mapLoadText"></span></div>
  </div>
  <p class="map-note" id="mapNote" hidden></p>
  <div class="map-info" id="mapInfo"></div>`;
  const $=id=>root.querySelector('#'+id);
  const canvas=$('mapCanvas'),stage=$('mapStage'),tip=$('mapTip'),info=$('mapInfo'),ctx=canvas.getContext('2d');
  let W=0,H=0,dpr=1,transform=d3.zoomIdentity,sim=null,nodes=[],links=[],byId=new Map(),hover=null,selected=null,seeds=[],quad=null,maxDeg=1,maxIn=1,maxOut=1,rings=[],running=false,runStart=0,userZoomed=false,buildId=0;

  const edgesOn=()=>edgesPref!=null?edgesPref:view==='explore'?links.length<=1500:(links.length<=150&&nodes.length<=80);
  function loading(msg){const l=$('mapLoad');if(msg){$('mapLoadText').textContent=msg;l.hidden=false}else l.hidden=true}

  /* ---- colours follow the site theme ---- */
  let col={};
  function readColours(){const cs=getComputedStyle(document.documentElement);const g=n=>cs.getPropertyValue(n).trim();
    col={paper:g('--paper'),panel:g('--panel'),ink:g('--ink'),ink2:g('--ink-2'),ink3:g('--ink-3'),grid:g('--grid'),line:g('--line'),accent:g('--accent'),soft:g('--accent-soft'),onInk:g('--on-ink'),t1:g('--t1'),t2:g('--t2'),t3:g('--t3'),t4:g('--t4')};
    col.cat=[col.accent,col.t1,col.t4,col.t2,col.t3,col.ink2,col.grid,col.ink3];col.lvl=[col.t3,col.t4,col.t2,col.t1,col.ink2,col.grid,col.ink3]}
  readColours();
  const refresh=()=>{readColours();legend();draw()};
  document.addEventListener('skinchange',refresh);
  new MutationObserver(refresh).observe(document.documentElement,{attributes:true,attributeFilter:['data-skin','data-theme']});
  const lum=c=>{const x=d3.color(c);if(!x)return 1;const r=x.rgb();return (0.299*r.r+0.587*r.g+0.114*r.b)/255};

  /* ---- graph for a word level ---- */
  const edgeCache={};
  function edgesFor(level){
    if(edgeCache[level])return edgeCache[level];const LV=new Set(lvArr(level));
    const E=new Map(),adj=new Map(),wc=new Map();
    for(const w of WORDS){
      if(!LV.has(w.lv))continue;const cs=[...new Set(w.w)].filter(c=>CH[c]);if(cs.length<2||cs.length>4)continue;
      for(const c of cs)wc.set(c,(wc.get(c)||0)+1);
      for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){
        const a=cs[i]<cs[j]?cs[i]:cs[j],b=cs[i]<cs[j]?cs[j]:cs[i],k=a+'|'+b;
        let e=E.get(k);if(!e){e={a,b,words:[],n:0};E.set(k,e);
          if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a)}
        e.n++;if(e.words.length<8)e.words.push(w);
      }
    }
    return edgeCache[level]={E,adj,wc};
  }
  const filtCache={};
  function wordGraph(level){
    const base=edgesFor(level);if(!dampen&&!backbone)return base;
    const key=level+'|'+dampen+'|'+(backbone?alphaTh:'');if(filtCache[key])return filtCache[key];
    const {E,wc}=base,W=new Map();
    // dampened: shared words relative to how many words each character has (cosine), so busy hubs count for less
    for(const [k,e] of E)W.set(k,dampen?e.n/Math.sqrt(wc.get(e.a)*wc.get(e.b)):e.n);
    let keep=[...E.keys()];
    if(backbone){ // backbone: a link survives if it is one of the strongest few links of either of its characters
      const cos=k=>{const e=E.get(k);return e.n/Math.sqrt(wc.get(e.a)*wc.get(e.b))};
      const by=new Map();for(const [k,e] of E)for(const c of [e.a,e.b]){if(!by.has(c))by.set(c,[]);by.get(c).push(k)}
      const kept=new Set();
      for(const ks of by.values()){ks.sort((x,y)=>W.get(y)-W.get(x)||cos(y)-cos(x)||(x<y?-1:1));for(const k of ks.slice(0,alphaTh))kept.add(k)}
      keep=keep.filter(k=>kept.has(k));
    }
    const E2=new Map(),adj=new Map(),nb=(a,b)=>{if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b)};
    for(const k of keep){const e=E.get(k);E2.set(k,e);nb(e.a,e.b);nb(e.b,e.a)}
    return filtCache[key]={E:E2,adj,W};
  }
  /* parts graph: a directed link from each part to the character built from it.
     Characters up to the level are included with all their parts, at any level. */
  const partsCache={};
  function partsFor(level){
    const key=level+'|'+Object.keys(roles).filter(r=>roles[r]).join();
    if(partsCache[key])return partsCache[key];
    const S=new Set();const add=c=>{if(S.has(c))return;S.add(c);for(const p of CH[c].parts)if(CH[p]&&p!==c)add(p)};
    const LV=new Set(lvArr(level));for(const o of Object.values(CH))if(LV.has(o.lv))add(o.c);
    const E=new Map(),adj=new Map(),out=new Map(),inn=new Map(),nb=(m,a,b)=>{if(!m.has(a))m.set(a,new Set());m.get(a).add(b)};
    for(const c of S){const o=CH[c];for(const p of new Set(o.parts)){if(!S.has(p)||p===c)continue;
      const role=roleOf(o,p);if(!roles[role])continue;
      E.set(p+'>'+c,{a:p,b:c,n:1,role});nb(adj,p,c);nb(adj,c,p);nb(out,p,c);nb(inn,c,p)}}
    return partsCache[key]={E,adj,out,inn};
  }
  const graphFor=level=>net==='parts'?partsFor(level):wordGraph(level);
  const fullTooBig=level=>graphFor(level).E.size>MAX_LINKS;
  function updateLevelOptions(){
    $('mapLvLab').textContent=net==='parts'?'Characters':'Words';$('mapLvTxt').textContent=lvLabel(lv);$('mapLv8').hidden=net==='parts';
    const on=new Set(lvArr(lv));root.querySelectorAll('[data-lvl]').forEach(b=>b.checked=on.has(+b.dataset.lvl));
  }

  /* ---- community detection: Louvain modularity, weighted by shared words ---- */
  let comm=new Map(),commList=[];
  function detectCommunities(){
    const ids=nodes.map(n=>n.id),idx=new Map(ids.map((id,i)=>[id,i]));
    let adj=Array.from({length:ids.length},()=>new Map());
    for(const l of links){const a=idx.get(l.source.id),b=idx.get(l.target.id),w=l.w;adj[a].set(b,(adj[a].get(b)||0)+w);adj[b].set(a,(adj[b].get(a)||0)+w)}
    let member=ids.map((_,i)=>i);
    for(let level=0;level<4;level++){
      const k=adj.map(m=>{let s=0;for(const w of m.values())s+=w;return s});const m2=k.reduce((a,b)=>a+b,0);if(!m2)break;
      const com=adj.map((_,i)=>i),tot=k.slice();let moved=true,any=false,pass=0;
      while(moved&&pass++<12){moved=false;
        for(let i=0;i<adj.length;i++){const ci=com[i];const wc=new Map();for(const [j,w] of adj[i]){if(j===i)continue;wc.set(com[j],(wc.get(com[j])||0)+w)}
          tot[ci]-=k[i];let best=ci,bg=(wc.get(ci)||0)-tot[ci]*k[i]/m2;
          for(const [c,w] of wc){const g=w-tot[c]*k[i]/m2;if(g>bg){bg=g;best=c}}
          tot[best]+=k[i];if(best!==ci){com[i]=best;moved=true;any=true}}}
      if(!any)break;
      const remap=new Map();com.forEach(c=>{if(!remap.has(c))remap.set(c,remap.size)});
      const nadj=Array.from({length:remap.size},()=>new Map());
      adj.forEach((m,i)=>{const a=remap.get(com[i]);for(const [j,w] of m){const b=remap.get(com[j]);nadj[a].set(b,(nadj[a].get(b)||0)+w)}});
      member=member.map(s=>remap.get(com[s]));adj=nadj;
    }
    const sz=new Map();member.forEach(c=>sz.set(c,(sz.get(c)||0)+1));
    const ranked=[...sz.entries()].sort((a,b)=>b[1]-a[1]).filter(e=>e[1]>=3).slice(0,8).map(e=>e[0]);
    comm=new Map();member.forEach((c,i)=>{const r=ranked.indexOf(c);if(r>=0)comm.set(ids[i],r)});
    commList=ranked.map((c,r)=>{const ms=nodes.filter(n=>comm.get(n.id)===r).sort((a,b)=>b.deg-a.deg);return {i:r,size:ms.length,label:ms.slice(0,3).map(m=>m.id).join('')}});
  }

  /* ---- appearance ---- */
  const isSeed=d=>d.depth===0&&seeds.includes(d.id);
  const mode=()=>colour!=='auto'?colour:layout==='levels'?'level':isFull()?'community':'depth';
  function radius(d){
    if(isSeed(d))return 14;
    if(size==='degree')return 3.5+11*Math.sqrt(d.deg/maxDeg);
    if(size==='in')return 3.5+11*Math.sqrt(d.din/maxIn);
    if(size==='out')return 4+18*Math.sqrt(d.dout/maxOut);
    if(size==='freq')return 4+rankBand(d.rank)*1.6;
    return 6;
  }
  function fillFor(d){
    const m=mode();if(isSeed(d))return col.accent;
    if(m==='level'){const l=CH[d.id].lv;return l>7?col.panel:col.lvl[l-1]}
    if(m==='community'){const i=comm.get(d.id);return i!=null?col.cat[i]:col.panel}
    return d.depth===1?col.soft:col.panel;
  }
  function legend(){
    const el=$('mapLegend');const m=mode();
    if(m==='community'&&commList.length){el.hidden=false;el.innerHTML=commList.map(c=>`<span><i style="background:${col.cat[c.i]}"></i><span class="cn" lang="zh-Hans">${esc(c.label)}</span> ${c.size}</span>`).join('')}
    else if(m==='level'){el.hidden=false;el.innerHTML=[1,2,3,4,5,6,7].map(l=>`<span><i style="background:${col.lvl[l-1]}"></i>${l===7?'7–9':l}</span>`).join('')+'<span class="lab">HSK</span>'}
    else el.hidden=true;
    if(net==='parts'&&edgesOn()){const rc=roleCol();el.hidden=false;
      el.innerHTML=(m==='community'||m==='level'?el.innerHTML+'<span class="sep" aria-hidden="true"></span>':'')+[['meaning','meaning'],['sound','sound'],['picture','picture'],['other','other']].filter(([k])=>roles[k]).map(([k,n])=>`<span><b class="ln" style="background:${rc[k]}"></b>${n}</span>`).join('')+'<span class="lab">part</span>'}
  }
  // same colours as the meaning/sound/picture tags on character pages
  const roleCol=()=>({meaning:col.t2,sound:col.t4,picture:col.t3,other:col.ink3});
  const ROLE={meaning:'meaning part',sound:'sound part',picture:'picture part',other:'other part'};

  /* ---- build the visible graph ---- */
  const nbOf=(G,x)=>(net==='parts'&&follow!=='both'?(follow==='down'?G.out:G.inn).get(x):G.adj.get(x))||[];
  const byRank=(m,n)=>(CH[m].rank||1e5)-(CH[n].rank||1e5);
  function expand(c){ // add up to BATCH more of c's neighbours, most common first
    const nb=[...nbOf(curG,c)].filter(x=>!shown.has(x)).sort(byRank);
    const add=nb.slice(0,Math.min(BATCH,Math.max(0,MAX_NODES-shown.size)));
    for(const x of add)shown.add(x);if(add.length)opened.set(c,(opened.get(c)||0)+add.length);
    return {added:add,left:nb.length-add.length};
  }
  function resetExplore(){shown=new Set();opened=new Map();hist=[];spawn=new Map()}
  async function build(opts={}){
    const id=++buildId;stopLayout(true);
    if(net==='parts'&&lvArr(lv).includes(8))lv=lvKey(lvArr(lv).filter(l=>l!==8));
    if(net==='words'&&lvArr(lv).includes(8)&&!C.extraLoaded()){loading('Loading more words…');const F=window.ZIWANG_LOAD_FULL?window.ZIWANG_LOAD_FULL():window.ZIWANG_FULL;if(F)await F;
      for(const k of Object.keys(edgeCache))if(lvArr(k).includes(8))delete edgeCache[k];for(const k of Object.keys(filtCache))if(k.split('|')[0].split(',').includes('8'))delete filtCache[k];if(id!==buildId)return}
    if(!opts.gentle)loading('Building the network…');await nextFrame();if(id!==buildId)return;
    updateLevelOptions();
    if(isFull()&&fullTooBig(lv)){ // drop the highest levels until the full network fits this device
      let a=lvArr(lv);while(a.length>1&&fullTooBig(lvKey(a)))a=a.slice(0,-1);const was=lv;lv=lvKey(a);
      note(`The full network for ${lvLabel(was)} is too large for this device, so it’s showing ${lvLabel(lv)}. Use jumps or Explore for bigger sets.`);
    }else note(opts.msg||'');
    let G=graphFor(lv),{E,adj}=G;
    const chars=[...new Set([...q])].filter(c=>CH[c]);
    // the starting character always shows, even with no links at the chosen levels; the full network only shows linked characters
    seeds=isFull()?chars.filter(c=>adj.has(c)):chars;
    const depth=new Map();let truncated=false;curG=G;
    if(isFull()){for(const c of adj.keys())depth.set(c,seeds.includes(c)?0:null)}
    else if(view==='explore'){
      if(!shown.size){for(const s of seeds)shown.add(s);for(const s of seeds)expand(s)}
      for(const c of [...shown])if(!adj.has(c)&&!seeds.includes(c))shown.delete(c);
      const qq=[];for(const s of seeds)if(shown.has(s)){depth.set(s,0);qq.push(s)} // distance from the start, through what's on screen
      for(let i=0;i<qq.length;i++){const x=qq[i];for(const y of adj.get(x)||[])if(shown.has(y)&&!depth.has(y)){depth.set(y,depth.get(x)+1);qq.push(y)}}
      for(const c of shown)if(!depth.has(c))depth.set(c,null);
    }else{
      const qq=[];for(const s of seeds){depth.set(s,0);qq.push(s)}
      for(let i=0;i<qq.length;i++){const x=qq[i],d=depth.get(x);if(d>=hops)continue;
        const nb=[...nbOf(G,x)].sort(byRank);
        for(const y of nb)if(!depth.has(y)){if(depth.size>=MAX_NODES){truncated=true;break}depth.set(y,d+1);qq.push(y)}}
    }
    const prev=new Map(nodes.map(n=>[n.id,n]));
    nodes=[...depth.keys()].map(c=>{const p=prev.get(c)||spawn.get(c),j=p&&!prev.has(c)?14:0;return {id:c,depth:depth.get(c),rank:CH[c].rank,x:p?p.x+(Math.random()-.5)*j:(Math.random()-.5)*60,y:p?p.y+(Math.random()-.5)*j:(Math.random()-.5)*60,vx:0,vy:0}});spawn=new Map();
    byId=new Map(nodes.map(n=>[n.id,n]));
    links=[];for(const [k,e] of E)if(byId.has(e.a)&&byId.has(e.b))links.push({source:byId.get(e.a),target:byId.get(e.b),e,w:G.W?G.W.get(k):e.n});
    if(links.length>MAX_LINKS){ // keep the strongest links so the page stays responsive
      links.sort((a,b)=>b.w-a.w);links.length=MAX_LINKS;truncated=true}
    {const m=links.reduce((t,l)=>t+l.w,0)/Math.max(1,links.length)||1;for(const l of links)l.wn=l.w/m}
    if(backbone&&net==='words'){nodes=nodes.filter(n=>n.depth===0||links.some(l=>l.source===n||l.target===n));byId=new Map(nodes.map(n=>[n.id,n]))}
    for(const n of nodes){n.deg=0;n.din=0;n.dout=0}
    for(const l of links){l.source.deg++;l.target.deg++;l.source.dout++;l.target.din++}
    maxDeg=maxIn=maxOut=1;for(const n of nodes){maxDeg=Math.max(maxDeg,n.deg);maxIn=Math.max(maxIn,n.din);maxOut=Math.max(maxOut,n.dout)}
    if(net==='parts'&&size==='degree')size='out';if(net==='words'&&(size==='in'||size==='out'))size='degree';
    if(layout==='layers'&&net!=='parts')layout='force';
    nodes.forEach(n=>n.r=radius(n));
    detectCommunities();
    hover=null;selected=null;if(!opts.gentle)edgesPref=null;
    root.querySelectorAll('[data-hops]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.hops===hops));
    root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
    $('mapHops').hidden=view==='explore';$('mapExp').hidden=view!=='explore';$('mapUndo').disabled=!hist.length;
    $('mapQ').value=q;$('mapNet').value=net;
    updateLevelOptions();legend();renderSettings();
    try{const u=new URL(location.href);u.searchParams.set('q',q);u.searchParams.set('hops',hops);u.searchParams.delete('lv');u.searchParams.set('hsk',lv);u.searchParams.set('layout',layout);u.searchParams.set('view',view);if(net==='parts')u.searchParams.set('links','parts');else u.searchParams.delete('links');if(net==='parts'&&follow!=='both')u.searchParams.set('follow',follow);else u.searchParams.delete('follow');
      if(net==='words'&&dampen)u.searchParams.set('hubs','damp');else u.searchParams.delete('hubs');if(net==='words'&&backbone)u.searchParams.set('backbone',alphaTh);else u.searchParams.delete('backbone');history.replaceState(null,'',u)}catch(e){}
    stats=`${nodes.length.toLocaleString()} characters · ${links.length.toLocaleString()} links${view==='explore'?` · ${opened.size} opened`:''}${truncated?' · trimmed to fit this device':''}`;
    if(!isFull()&&!links.length)info.innerHTML=`<p class="hint">${esc(q)} has no links at ${lvLabel(lv)}. Tick more levels to see its neighbours.</p>`;else showDefault();
    loading('');userZoomed=false;startLayout(opts.gentle);
    if(opts.select&&byId.has(opts.select)){selected={node:byId.get(opts.select)};showInfo(selected)}
  }
  let stats='';
  function note(t){const n=$('mapNote');n.textContent=t;n.hidden=!t}

  /* ---- layouts ---- */
  function applyForces(){
    const n=nodes.length,s=settings[layout]||{};
    sim.force('link',null).force('charge',null).force('collide',null).force('x',null).force('y',null).force('radial',null).force('attract',null).force('gravity',null);
    nodes.forEach(d=>{d.fx=null;d.fy=null});
    const collide=on=>{if(on)sim.force('collide',d3.forceCollide(d=>d.r+1.5).iterations(1))};
    if(layout==='force'){
      sim.force('link',d3.forceLink(links).distance(s.distance).strength(l=>dampen&&net==='words'?.4*Math.min(2.5,Math.max(.25,l.wn)):.4)).force('charge',d3.forceManyBody().strength(-s.repulsion).distanceMax(500).theta(.9))
        .force('x',d3.forceX(0).strength(s.gravity)).force('y',d3.forceY(0).strength(s.gravity));collide(s.overlap);
    }else if(layout==='fa2'){ // ForceAtlas2-style: degree-weighted repulsion, (lin-log) attraction, gravity
      sim.force('charge',d3.forceManyBody().strength(d=>-s.scaling*(d.deg+1)).theta(.9));
      const avgDeg=nodes.reduce((t,d)=>t+d.deg+1,0)/Math.max(1,nodes.length);
      sim.force('attract',alpha=>{const k=.05*alpha;for(const l of links){const a=l.source,b=l.target,dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
        let f=s.linlog?Math.log(1+dist)/dist*6:1;f*=Math.pow(l.wn,s.weight);if(s.dissuade)f*=avgDeg/(a.deg+1);a.vx+=dx*k*f;a.vy+=dy*k*f;b.vx-=dx*k*f;b.vy-=dy*k*f}});
      sim.force('gravity',alpha=>{const g=.04*s.gravity*alpha;for(const d of nodes){const dist=Math.hypot(d.x,d.y)||1;const f=s.strong?g*.05:g*(d.deg+1)/dist;d.vx-=d.x*f;d.vy-=d.y*f}});
      collide(s.overlap);
    }else if(layout==='rings'){
      sim.force('link',d3.forceLink(links).distance(40).strength(.15)).force('charge',d3.forceManyBody().strength(-40).distanceMax(300))
        .force('radial',d3.forceRadial(d=>(d.depth||0)*s.spacing,0,0).strength(d=>d.depth===0?1:.8));collide(true);
      const sp=seeds.length;nodes.forEach(d=>{const i=seeds.indexOf(d.id);if(d.depth===0&&i>=0){d.fx=sp===1?0:(i-(sp-1)/2)*70;d.fy=0}});
    }else if(layout==='layers'){ // layered: each character sits one row below its deepest part
      const L=new Map(nodes.map(d=>[d,0]));
      for(let it=0,ch=true;ch&&it<40;it++){ch=false;for(const l of links){const v=L.get(l.source)+1;if(v>L.get(l.target)){L.set(l.target,v);ch=true}}}
      const top=Math.max(0,...L.values()),dirY=s.flip?-1:1;
      sim.force('link',d3.forceLink(links).distance(s.spacing*.9).strength(.15)).force('charge',d3.forceManyBody().strength(-s.repulsion).distanceMax(400).theta(.9))
        .force('y',d3.forceY(d=>dirY*(L.get(d)-top/2)*s.spacing).strength(1)).force('x',d3.forceX(0).strength(.02));collide(s.overlap);
    }else if(layout==='levels'){
      const cnt=new Map();for(const d of nodes){const l=Math.min(CH[d.id].lv,8);cnt.set(l,(cnt.get(l)||0)+1)}
      const band=new Map();let R=0;rings=[];
      for(let l=1;l<=8;l++){const c=cnt.get(l)||0;if(!c)continue;const area=c*Math.PI*64*1.5*s.spacing;const R2=Math.sqrt(R*R+area/Math.PI);band.set(l,l===1?R2*.55:(R+R2)/2);rings.push({r:R2+9,l});R=R2+18*s.spacing}
      sim.force('link',d3.forceLink(links).distance(30).strength(.03)).force('charge',d3.forceManyBody().strength(-12))
        .force('radial',d3.forceRadial(d=>band.get(Math.min(CH[d.id].lv,8)),0,0).strength(1));sim.force('collide',d3.forceCollide(d=>d.r+1.5).iterations(2));
    }
  }
  function startLayout(gentle){
    stopLayout(true);rings=layout==='levels'?rings:[];
    if(layout==='spiral'){
      const s=settings.spiral;const order=nodes.slice().sort((a,b)=>(a.rank||1e5)-(b.rank||1e5));
      order.forEach((d,i)=>{const a=i*2.39996,r=s.spacing*Math.sqrt(i);d.x=r*Math.cos(a);d.y=r*Math.sin(a);d.vx=d.vy=0});
      quad=d3.quadtree(nodes,d=>d.x,d=>d.y);fit(false);draw();runUI('static');return;
    }
    sim=d3.forceSimulation(nodes).stop().velocityDecay(.45);applyForces();
    // cool down over the chosen run time (about 60 steps a second), then freeze
    // a gentle run (after an Explore click) nudges the existing layout instead of starting again
    const secs=gentle?Math.min(runSecs,4):runSecs,ticks=Math.max(60,secs*60);sim.alpha(gentle?.5:1).alphaMin(.001).alphaDecay(1-Math.pow(.001/(gentle?.5:1),1/ticks));
    running=true;runStart=performance.now();let lastDraw=0,lastFit=0;
    sim.on('tick',()=>{const now=performance.now(),el=(now-runStart)/1000;
      if(now-lastDraw>(links.length>8000?50:16)){draw();lastDraw=now}
      if(!gentle&&!userZoomed&&now-lastFit>400){fit(false);lastFit=now}
      runUI('run',Math.min(1,el/secs));
      if(el>=secs)stopLayout(false)});
    sim.on('end',()=>stopLayout(false));
    sim.restart();runUI('run',0);
  }
  function stopLayout(silent){
    if(sim){sim.on('tick',null).on('end',null);sim.stop()}
    const was=running;running=false;
    if(!silent&&was){quad=d3.quadtree(nodes,d=>d.x,d=>d.y);if(!userZoomed)fit(true);draw();runUI('done')}
  }
  function runUI(state,p){
    const t=$('mapRunText'),b=$('mapRunBtn'),bar=$('mapProg');
    if(state==='run'){bar.style.width=Math.round(p*100)+'%';t.textContent=`Arranging · ${stats}`;b.textContent='Stop';b.dataset.run='stop';$('mapRun').classList.add('on')}
    else{bar.style.width='100%';$('mapRun').classList.remove('on');t.textContent=stats;
      if(state==='static'){b.hidden=true}else{b.hidden=false;b.textContent='Run layout again';b.dataset.run='start'}}
    if(state!=='static')b.hidden=false;
  }

  /* ---- settings panel ---- */
  const SLIDERS={
    force:[['distance','Link length',10,120,1],['repulsion','Repulsion',5,300,5],['gravity','Gravity',0,.3,.01]],
    fa2:[['scaling','Scaling (repulsion)',.5,12,.5],['gravity','Gravity',0,5,.1],['weight','Edge weight influence',0,1,.1]],
    rings:[['spacing','Ring spacing',60,220,5]],
    levels:[['spacing','Band spacing',.6,2.5,.1]],
    spiral:[['spacing','Spacing',4,20,1]],
    layers:[['spacing','Row spacing',30,200,5],['repulsion','Repulsion',5,200,5]]};
  const TOGGLES={force:[['overlap','Prevent overlap']],fa2:[['linlog','LinLog mode'],['dissuade','Dissuade hubs'],['strong','Strong gravity'],['overlap','Prevent overlap']],layers:[['flip','Characters on top, parts below'],['overlap','Prevent overlap']]};
  function renderSettings(){
    const s=settings[layout];const name=LAYOUTS.find(l=>l[0]===layout)[1];
    const sel=(id,opts,cur)=>`<select id="${id}">${opts.map(([k,n,dis])=>`<option value="${k}"${k===cur?' selected':''}${dis?' disabled':''}>${n}</option>`).join('')}</select>`;
    $('mapSettings').innerHTML=`<div class="ms-sec"><h3>Display</h3><div class="ms-grid ms-row">
        <label class="ms-f">Layout ${sel('mapLayout',LAYOUTS.map(([k,n])=>{const off=k==='rings'&&isFull()?' (needs jumps or Explore)':k==='layers'&&net!=='parts'?' (parts only)':'';return [k,n+off,!!off]}),layout)}</label>
        <label class="ms-f">Node size ${sel('mapSize',net==='parts'?[['default','Same size'],['out','Out-degree (builds)'],['in','In-degree (parts)'],['freq','Frequency']]:[['default','Same size'],['degree','Degree (links)'],['freq','Frequency']],size)}</label>
        <label class="ms-f">Colour ${sel('mapColour',[['auto','Automatic'],['depth','Distance'],['level','HSK level'],['community','Communities']],colour)}</label>
        ${net==='parts'?`<label class="ms-f">Jumps follow ${sel('mapFollow',[['both','Both ways'],['down','Forward, to characters it builds'],['up','Backward, to its parts']],follow)}</label>`:''}
        <label class="ms-t"><input type="checkbox" id="mapEdges"${edgesOn()?' checked':''}> Show all links</label></div>
        ${net==='parts'?`<div class="ms-roles"><span>Link types</span>${[['meaning','Meaning parts'],['sound','Sound parts'],['picture','Picture parts'],['other','Other parts']].map(([k,n])=>`<label class="ms-t"><input type="checkbox" data-role="${k}"${roles[k]?' checked':''}> ${n}</label>`).join('')}</div>`:''}
        <p class="ms-hint">With links hidden, click a character to see its links, then hover a link for details.</p>
        ${net==='words'?`<div class="ms-filters">
          <label class="ms-t"><input type="checkbox" id="mapDampen"${dampen?' checked':''}> Dampen hub characters</label>
          <p class="ms-hint">Characters like <span class="cn" lang="zh-Hans">一</span>, <span class="cn" lang="zh-Hans">不</span> and <span class="cn" lang="zh-Hans">人</span> are in so many words that they link to almost everything. This makes a link stronger when two characters share a big part of their words, and weaker when one of them is just busy, so real word families pull together.</p>
          <div class="ms-row"><label class="ms-t"><input type="checkbox" id="mapBackbone"${backbone?' checked':''}> Strongest links only</label>
          <label class="ms-f">Strictness ${sel('mapStrict',STRICT.map(([v,n])=>[String(v),n]),String(alphaTh))}</label></div>
          <p class="ms-hint">Each character keeps only its strongest links (how many is set by strictness), and the rest are hidden. It turns a tangle into a readable map of who belongs with whom. Works best with the full network.</p></div>`:''}</div>
      <div class="ms-sec"><h3>${name}</h3>${layout==='spiral'?'':`<label class="ms-f">Run for <select id="msRun">${[3,6,12,30].map(v=>`<option value="${v}"${v===runSecs?' selected':''}>${v} seconds</option>`).join('')}</select></label>`}
      <div class="ms-grid">${(SLIDERS[layout]||[]).map(([k,label,min,max,step])=>`<label class="ms-s"><span>${label} <output>${s[k]}</output></span><input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`).join('')}
      ${(TOGGLES[layout]||[]).map(([k,label])=>`<label class="ms-t"><input type="checkbox" data-set="${k}"${s[k]?' checked':''}> ${label}</label>`).join('')}</div>
      <div class="ms-act"><button class="btn primary" type="button" data-act="apply">${layout==='spiral'?'Apply':'Apply and run'}</button><button class="btn" type="button" data-act="reset">Reset to defaults</button></div></div>`;
  }
  $('mapSettings').addEventListener('input',e=>{const k=e.target.dataset.set;if(!k)return;const s=settings[layout];
    if(e.target.type==='checkbox')s[k]=e.target.checked;else{s[k]=+e.target.value;e.target.previousElementSibling.querySelector('output').textContent=e.target.value}});
  $('mapSettings').addEventListener('change',e=>{const t=e.target;
    if(t.id==='msRun')runSecs=+t.value;
    else if(t.id==='mapLayout'){layout=t.value;renderSettings();legend();userZoomed=false;
      try{const u=new URL(location.href);u.searchParams.set('layout',layout);history.replaceState(null,'',u)}catch(err){}startLayout()}
    else if(t.id==='mapSize'){size=t.value;nodes.forEach(n=>n.r=radius(n));if(sim&&sim.force('collide'))sim.force('collide').radius(d=>d.r+1.5);quad=d3.quadtree(nodes,d=>d.x,d=>d.y);draw()}
    else if(t.id==='mapColour'){colour=t.value;legend();draw()}
    else if(t.id==='mapFollow'){follow=t.value;build()}
    else if(t.dataset.role){roles[t.dataset.role]=t.checked;if(!Object.values(roles).some(Boolean)){roles[t.dataset.role]=true;t.checked=true;return}build()}
    else if(t.id==='mapDampen'){dampen=t.checked;build()}
    else if(t.id==='mapBackbone'){backbone=t.checked;build()}
    else if(t.id==='mapStrict'){alphaTh=+t.value;if(backbone)build()}
    else if(t.id==='mapEdges'){edgesPref=t.checked;hover=null;tip.hidden=true;legend();draw()}});
  $('mapSettings').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;
    if(b.dataset.act==='reset'){settings[layout]=clone(DEF[net][layout]);renderSettings()}
    userZoomed=false;startLayout()});
  const help=open=>{$('mapHelp').hidden=!open;$('mapHelpBtn').setAttribute('aria-expanded',open);};
  $('mapHelpBtn').addEventListener('click',()=>help($('mapHelp').hidden));
  $('mapHelpClose').addEventListener('click',()=>{help(false);$('mapHelpBtn').focus()});
  $('mapSetBtn').addEventListener('click',()=>{const p=$('mapSettings');p.hidden=!p.hidden;$('mapSetBtn').setAttribute('aria-expanded',!p.hidden)});

  /* ---- canvas, zoom, drawing ---- */
  const zoom=d3.zoom().scaleExtent([.03,8]).on('zoom',e=>{transform=e.transform;if(e.sourceEvent)userZoomed=true;if(!running)draw()});
  // drag a character to move it: it stays where it's dropped and its neighbours follow. Dragging empty space still pans.
  let nudge=null,lastTap=null,skipClick=0;
  const nodeAtScreen=(sx,sy)=>{const [x,y]=transform.invert([sx,sy]);let best=null,bd=Infinity;
    for(const d of nodes){const dd=Math.hypot(d.x-x,d.y-y);if(dd<=d.r+4/transform.k&&dd<bd){bd=dd;best=d}}return best};
  const nodeDrag=d3.drag().container(canvas)
    .subject(e=>{const n=nodeAtScreen(e.x,e.y);return n?{n,x:e.x,y:e.y}:null})
    .on('start',e=>{const n=e.subject.n;e.subject.sx=e.x;e.subject.sy=e.y;e.subject.moved=false;n._fx=n.fx;n._fy=n.fy;tip.hidden=true;canvas.style.cursor='grabbing';
      if(sim&&layout!=='spiral'&&!running){clearTimeout(nudge);sim.on('tick',draw).on('end',null).alphaDecay(.06).alphaTarget(.2).restart()}})
    .on('drag',e=>{if(Math.hypot(e.x-e.subject.sx,e.y-e.subject.sy)>3)e.subject.moved=true;if(!e.subject.moved)return;const n=e.subject.n,[x,y]=transform.invert([e.x,e.y]);n.fx=x;n.fy=y;if(!sim||layout==='spiral'||(!running&&!nudge)){n.x=x;n.y=y}draw()})
    .on('end',e=>{const n=e.subject.n;canvas.style.cursor='';
      if(!e.subject.moved){ // a tap, not a drag: two quick taps on the same character in Explore start again from it
        if(sim&&layout!=='spiral'&&!running)sim.alphaTarget(0).stop();n.fx=n._fx;n.fy=n._fy;
        const now=performance.now();if(view==='explore'){if(lastTap&&lastTap.id===n.id&&now-lastTap.t<450){lastTap=null;skipClick=now;restartFrom(n.id)}else lastTap={id:n.id,t:now}}
        return}
      if(sim&&layout!=='spiral'&&!running){sim.alphaTarget(0); // the character stays where it was dropped until the layout runs againclearTimeout(nudge);
        nudge=setTimeout(()=>{nudge=null;if(!running){sim.on('tick',null).stop();quad=d3.quadtree(nodes,d=>d.x,d=>d.y);draw()}},1500)}
      else{if(running){n.fx=n._fx;n.fy=n._fy}quad=d3.quadtree(nodes,d=>d.x,d=>d.y);draw()}});
  d3.select(canvas).call(nodeDrag).call(zoom).on('dblclick.zoom',null);
  function resize(){const r=stage.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px';draw()}
  function fit(animate){
    if(!nodes.length||!W)return;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const d of nodes){x0=Math.min(x0,d.x-d.r);y0=Math.min(y0,d.y-d.r);x1=Math.max(x1,d.x+d.r);y1=Math.max(y1,d.y+d.r)}
    const pad=36,k=Math.min(3,Math.min((W-2*pad)/Math.max(1,x1-x0),(H-2*pad)/Math.max(1,y1-y0)));
    const t=d3.zoomIdentity.translate(W/2-k*(x0+x1)/2,H/2-k*(y0+y1)/2).scale(k);
    const s=d3.select(canvas);if(animate)s.transition().duration(450).call(zoom.transform,t);else s.call(zoom.transform,t);
  }
  function draw(){
    if(!W)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    ctx.save();ctx.translate(transform.x,transform.y);ctx.scale(transform.k,transform.k);
    const k=transform.k,showE=edgesOn();
    const fn=showE?((selected&&selected.node)||(hover&&hover.node)):(selected&&selected.node)||null;
    const fe=(hover&&hover.link)||(selected&&selected.link)||null;
    if(layout==='levels'&&rings.length){ctx.setLineDash([4/k,6/k]);ctx.lineWidth=1/k;ctx.strokeStyle=col.ink3;for(const g of rings){ctx.beginPath();ctx.arc(0,0,g.r,0,Math.PI*2);ctx.stroke()}ctx.setLineDash([])}
    const dir=net==='parts',seg=l=>{ctx.moveTo(l.source.x,l.source.y);ctx.lineTo(l.target.x,l.target.y)};
    const arrow=(l,sz)=>{const a=l.source,b=l.target,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<b.r+sz)return;const ux=dx/d,uy=dy/d,tx=b.x-ux*(b.r+1/k),ty=b.y-uy*(b.r+1/k),w=sz*.5;
      ctx.moveTo(tx,ty);ctx.lineTo(tx-ux*sz-uy*w,ty-uy*sz+ux*w);ctx.lineTo(tx-ux*sz+uy*w,ty-uy*sz-ux*w);ctx.closePath()};
    ctx.lineWidth=Math.max(.4,1/k);ctx.globalAlpha=!showE?.05:links.length>8000?.22:links.length>2000?.4:.7;
    if(dir){const rc=roleCol(),arrows=showE&&links.length<=2500&&k>.3;
      for(const r of ['other','picture','meaning','sound']){const ls=links.filter(l=>l.e.role===r);ctx.strokeStyle=ctx.fillStyle=rc[r];ctx.beginPath();ls.forEach(seg);ctx.stroke();
        if(arrows){ctx.beginPath();ls.forEach(l=>arrow(l,6/k));ctx.fill()}}}
    else{ctx.strokeStyle=col.grid;ctx.beginPath();links.forEach(seg);ctx.stroke()}
    ctx.globalAlpha=1;
    const near=new Set();
    if(fn){ctx.strokeStyle=ctx.fillStyle=col.accent;ctx.lineWidth=Math.max(1.2,2/k);ctx.beginPath();const fl=links.filter(l=>l.source===fn||l.target===fn);
      for(const l of fl){seg(l);near.add(l.source);near.add(l.target)}ctx.stroke();if(dir){ctx.beginPath();fl.forEach(l=>arrow(l,8/k));ctx.fill()}}
    if(fe){ctx.strokeStyle=ctx.fillStyle=col.accent;ctx.lineWidth=Math.max(2,3.5/k);ctx.beginPath();seg(fe);ctx.stroke();if(dir){ctx.beginPath();arrow(fe,11/k);ctx.fill()}near.add(fe.source);near.add(fe.target)}
    const labelAll=nodes.length<400;
    for(const d of nodes){
      const seed=isSeed(d),hi=near.has(d)||d===fn;
      const f=d===fn?col.accent:hi&&mode()==='depth'?col.soft:fillFor(d);
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fillStyle=f;ctx.fill();
      const op=view==='explore'&&opened.has(d.id);
      ctx.lineWidth=Math.max(.6,(seed||hi||op?2:1)/k);ctx.strokeStyle=seed||hi||op?col.accent:col.line;ctx.stroke();
      if(d.r*k>=6.5||seed||(hi&&k>.3)||(labelAll&&k>.55)){
        const fs=Math.max(d.r*1.25,(d.r*k<9)?9/k:0);
        ctx.font=`${fs}px "Noto Serif SC","Songti SC",serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=lum(f)<.55?'#fff':'#1a1a1a';ctx.fillText(d.id,d.x,d.y+fs*.05);
      }
    }
    if(layout==='levels'&&rings.length){ctx.font=`600 ${12/k}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      for(const g of rings){const lab=g.l>=8?'Beyond HSK':g.l===7?'HSK 7–9':'HSK '+g.l;const w=ctx.measureText(lab).width+10/k;ctx.fillStyle=col.panel;ctx.fillRect(-w/2,-g.r-8/k,w,16/k);ctx.fillStyle=col.ink2;ctx.fillText(lab,0,-g.r)}}
    ctx.restore();
  }

  /* ---- hit testing, tooltip, details ---- */
  function pick(mx,my){
    if(running){if(view!=='explore')return null;quad=d3.quadtree(nodes,d=>d.x,d=>d.y)} // Explore stays clickable while it settles
    const [x,y]=transform.invert([mx,my]);
    if(quad){const d=quad.find(x,y,30/transform.k+16);if(d&&Math.hypot(d.x-x,d.y-y)<=d.r+4/transform.k)return {node:d}}
    const tol=6/transform.k;let bl=null,bd=tol;
    const sn=selected&&selected.node;
    const cand=edgesOn()?links:sn?links.filter(l=>l.source===sn||l.target===sn):[];
    for(const l of cand){const ax=l.source.x,ay=l.source.y,dx=l.target.x-ax,dy=l.target.y-ay,len=dx*dx+dy*dy;
      let t=len?((x-ax)*dx+(y-ay)*dy)/len:0;t=Math.max(0,Math.min(1,t));const dd=Math.hypot(x-(ax+t*dx),y-(ay+t*dy));if(dd<bd){bd=dd;bl=l}}
    return bl?{link:bl}:null;
  }
  const wordLine=w=>`<span class="cn" lang="zh-Hans">${esc(w.w)}</span> ${pyHTMLJoined(w.py)} <span class="gl">${esc(w.gl)}</span>`;
  function tipHTML(h){
    if(h.node){const c=h.node.id,p=charPy(c);return `<b class="cn" lang="zh-Hans">${esc(c)}</b> <span class="t${sylTone(p)}">${esc(p)}</span> <span class="gl">${esc((charDef(c)||'').split(';')[0])}</span>`}
    const e=h.link.e;
    if(net==='parts'){const p=charPy(e.b);return `<b class="cn" lang="zh-Hans">${esc(e.a)}</b> → <b class="cn" lang="zh-Hans">${esc(e.b)}</b> <span class="t${sylTone(p)}">${esc(p)}</span> <span class="gl">${ROLE[e.role]}</span>`}
    return `${wordLine(e.words[0])}${e.n>1?` <span class="more">+${e.n-1} more</span>`:''}`;
  }
  function showDefault(){info.innerHTML=`<p class="hint">${net==='parts'?'Arrows run from a part to the characters built from it.':'Hover or tap a line to see the word that joins two characters.'} ${view==='explore'?'Tap a character to open all of its links, or double-tap to start again from it. Characters with a coloured ring are already open.':'Tap a character for details; tap it again to centre on it.'}</p>`}
  const chipList=(cs,lab)=>`<div class="map-parts"><h3>${lab}</h3><div class="chips">${cs.slice(0,30).map(([c,r])=>`<button type="button" class="chip" data-centre="${esc(c)}"><span class="cn" lang="zh-Hans">${esc(c)}</span>${r&&r!=='other'?`<small>${r}</small>`:''}</button>`).join('')}${cs.length>30?`<span class="more">+${cs.length-30} more</span>`:''}</div></div>`;
  function showInfo(h){
    if(!h){showDefault();return}
    if(h.node){
      const c=h.node.id,o=CH[c],p=charPy(c);const deg=links.filter(l=>l.source===h.node||l.target===h.node);
      if(net==='parts'){
        const ins=deg.filter(l=>l.target===h.node).map(l=>[l.source.id,l.e.role]),outs=deg.filter(l=>l.source===h.node).map(l=>[l.target.id,l.e.role]).sort((a,b)=>(CH[a[0]].rank||1e5)-(CH[b[0]].rank||1e5));
        info.innerHTML=`<div class="map-sel"><span class="big cn" lang="zh-Hans">${esc(c)}</span><span class="t${sylTone(p)}">${esc(p)}</span><span class="gl">${esc(charDef(c))}</span>
          ${o.lv<=7?`<span class="pill lv">${LVNAME(o.lv)}</span>`:''}${o.rank?`<span class="pill">#${o.rank} most used</span>`:''}</div>
          ${ins.length?chipList(ins,'Built from'):''}${outs.length?chipList(outs,`Part of ${outs.length} character${outs.length===1?'':'s'} here`):''}
          <div class="map-act"><button class="btn primary" type="button" data-centre="${esc(c)}">${view==='explore'?'Start from':'Centre on'} ${esc(c)}</button><a class="btn" href="${path(c)}">Open ${esc(c)}</a></div>`;
        return}
      const ws=[...new Map(deg.flatMap(l=>l.e.words).map(w=>[w.w,w])).values()].sort((a,b)=>a.lv-b.lv).slice(0,8);
      info.innerHTML=`<div class="map-sel"><span class="big cn" lang="zh-Hans">${esc(c)}</span><span class="t${sylTone(p)}">${esc(p)}</span><span class="gl">${esc(charDef(c))}</span>
        ${o.lv<=7?`<span class="pill lv">${LVNAME(o.lv)}</span>`:''}${o.rank?`<span class="pill">#${o.rank} most used</span>`:''}<span class="pill">${deg.length} link${deg.length===1?'':'s'}</span></div>
        <ul class="map-words">${ws.map(w=>`<li>${wordLine(w)}</li>`).join('')}</ul>
        <div class="map-act"><button class="btn primary" type="button" data-centre="${esc(c)}">${view==='explore'?'Start from':'Centre on'} ${esc(c)}</button><a class="btn" href="${path(c)}">Open ${esc(c)}</a></div>`;
    }else if(net==='parts'){
      const e=h.link.e,p=charPy(e.b);
      info.innerHTML=`<div class="map-sel"><span class="big cn" lang="zh-Hans">${esc(e.a)}</span><span class="join">→</span><span class="big cn" lang="zh-Hans">${esc(e.b)}</span><span class="t${sylTone(p)}">${esc(p)}</span><span class="gl">${esc((charDef(e.b)||'').split(';')[0])}</span><span class="pill">${ROLE[e.role]}</span></div>
        <div class="map-act"><button class="btn" type="button" data-centre="${esc(e.a)}">${view==='explore'?'Start from':'Centre on'} ${esc(e.a)}</button><button class="btn" type="button" data-centre="${esc(e.b)}">${view==='explore'?'Start from':'Centre on'} ${esc(e.b)}</button><a class="btn" href="${path(e.b)}">Open ${esc(e.b)}</a></div>`;
    }else{
      const e=h.link.e;
      info.innerHTML=`<div class="map-sel"><span class="big cn" lang="zh-Hans">${esc(e.a)}</span><span class="join">—</span><span class="big cn" lang="zh-Hans">${esc(e.b)}</span><span class="pill">${e.n} word${e.n===1?'':'s'}</span></div>
        <ul class="map-words">${e.words.map(w=>`<li>${wordLine(w)} <span class="pill">${LVNAME(w.lv)}</span></li>`).join('')}</ul>
        <div class="map-act"><button class="btn" type="button" data-centre="${esc(e.a)}">${view==='explore'?'Start from':'Centre on'} ${esc(e.a)}</button><button class="btn" type="button" data-centre="${esc(e.b)}">${view==='explore'?'Start from':'Centre on'} ${esc(e.b)}</button></div>`;
    }
  }
  const pointer=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
  canvas.addEventListener('mousemove',e=>{
    const [mx,my]=pointer(e);const h=pick(mx,my);
    if(!(h&&hover&&h.node===hover.node&&h.link===hover.link)&&(h||hover)){hover=h;draw()}
    if(h){tip.hidden=false;tip.innerHTML=tipHTML(h);const tw=tip.offsetWidth;tip.style.left=Math.max(8,Math.min(W-tw-8,mx+14))+'px';tip.style.top=Math.max(8,my-44)+'px';canvas.style.cursor='pointer'}
    else{tip.hidden=true;canvas.style.cursor=''}
  },{passive:true});
  canvas.addEventListener('dblclick',e=>{if(view!=='explore')return;const [mx,my]=pointer(e);
    const id=lastOpen&&performance.now()-lastOpen.t<600?lastOpen.c:(pick(mx,my)||{}).node?.id;if(id)restartFrom(id)});
  canvas.addEventListener('mouseleave',()=>{hover=null;tip.hidden=true;draw()});
  canvas.addEventListener('click',e=>{
    if(performance.now()-skipClick<400)return;
    if(running&&view!=='explore')return;const [mx,my]=pointer(e);const h=pick(mx,my);
    if(view==='explore'&&h&&h.node){openNode(h.node);return}
    if(running)return;
    if(h&&h.node&&selected&&selected.node===h.node){centre(h.node.id);return}
    selected=h;showInfo(h);draw();
  });
  // switching between jumps, full network and link types restores the layout and size last used there
  function swapState(fn){const k0=stateKey();modeState[k0]={layout,size};fn();const k1=stateKey();if(k1!==k0)({layout,size}=modeState[k1]);if(isFull()&&layout==='rings')layout='force'}
  const snap=()=>({q,shown:new Set(shown),opened:new Map(opened)});
  let lastOpen=null; // the most recent tap, so a double tap can undo its expansion before restarting
  function openNode(n){
    const c=n.id;hist.push(snap());lastOpen={c,t:performance.now(),pushed:true};
    const r=expand(c);
    if(!r.added.length){hist.pop();lastOpen.pushed=false;if(!opened.has(c))opened.set(c,0);selected={node:n};showInfo(selected);draw();note(`All of ${c}’s links are already on the map.`);return}
    for(const x of r.added)spawn.set(x,{x:n.x,y:n.y});
    build({gentle:true,select:c,msg:r.left?`Showing ${r.added.length} more of ${c}’s links, most common first. Tap ${c} again for the next ${Math.min(BATCH,r.left)}.`:''});
  }
  function undo(){if(!hist.length)return;const h=hist.pop(),restart=h.q!==q;q=h.q;shown=h.shown;opened=h.opened;build({gentle:!restart})}
  // Explore: double-tap a character to start again from it (Undo goes back to the previous exploration)
  function restartFrom(c){
    if(lastOpen&&lastOpen.c===c&&lastOpen.pushed&&performance.now()-lastOpen.t<600&&hist.length){const h=hist.pop();q=h.q;shown=h.shown;opened=h.opened}
    lastOpen=null;if(c===q&&shown.size<=1+((curG&&nbOf(curG,c).size)||0)&&opened.size<=1)return;
    hist.push(snap());q=c;shown=new Set();opened=new Map();spawn=new Map();build()}
  function centre(c){if(view==='explore'){restartFrom(c);return}q=c;swapState(()=>{if(hops===0)hops=1});build()}

  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-hops],[data-view],[data-z],[data-centre],#mapRunBtn,#mapUndo,#mapRestart');if(!b)return;
    if(b.id==='mapUndo'){undo();return}
    if(b.id==='mapRestart'){resetExplore();build();return}
    if(b.dataset.view){if(b.dataset.view!==view){swapState(()=>{view=b.dataset.view});resetExplore();build()}return}
    if(b.id==='mapRunBtn'){if(b.dataset.run==='stop')stopLayout(false);else{userZoomed=false;startLayout()}return}
    if(b.dataset.centre){centre(b.dataset.centre);return}
    if(b.dataset.hops!=null){swapState(()=>{hops=+b.dataset.hops});build();return}
    const z=b.dataset.z,s=d3.select(canvas);
    if(z==='in')s.transition().duration(250).call(zoom.scaleBy,1.5);else if(z==='out')s.transition().duration(250).call(zoom.scaleBy,1/1.5);else{userZoomed=false;fit(true)}
  });
  // level picker: tick any mix of levels; the map rebuilds a moment after the last change
  let lvTimer;const lvMenu=$('mapLvMenu'),lvBtn=$('mapLvBtn');
  const lvOpen=o=>{lvMenu.hidden=!o;lvBtn.setAttribute('aria-expanded',o)};
  const setLv=k=>{if(k===lv)return;lv=k;$('mapLvTxt').textContent=lvLabel(lv);clearTimeout(lvTimer);lvTimer=setTimeout(()=>{if(view==='explore')resetExplore();build()},350)};
  lvBtn.addEventListener('click',()=>lvOpen(lvMenu.hidden));
  lvMenu.addEventListener('change',e=>{const b=e.target;if(!b.dataset.lvl)return;
    const a=[...root.querySelectorAll('[data-lvl]')].filter(x=>x.checked&&!x.closest('[hidden]')).map(x=>+x.dataset.lvl);
    if(!a.length){b.checked=true;return}setLv(lvKey(a))});
  lvMenu.addEventListener('click',e=>{const b=e.target.closest('[data-lvq]');if(!b)return;const k=b.dataset.lvq==='all'?'1,2,3,4,5,6,7':'1';
    root.querySelectorAll('[data-lvl]').forEach(x=>x.checked=lvArr(k).includes(+x.dataset.lvl));setLv(k)});
  document.addEventListener('click',e=>{if(!lvMenu.hidden&&!e.target.closest('.map-lvpick'))lvOpen(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!lvMenu.hidden){lvOpen(false);lvBtn.focus()}});
  $('mapNet').addEventListener('change',e=>{swapState(()=>{net=e.target.value;settings=SET[net];if(net==='parts'&&hops===1)hops=2});resetExplore();build()});
  $('mapSeed').addEventListener('submit',e=>{e.preventDefault();const v=$('mapQ').value.trim();
    const cs=[...v].filter(c=>CH[c]);if(!cs.length){note('Type a Chinese character or word.');return}
    q=cs.join('');if(view==='explore')resetExplore();else swapState(()=>{if(hops===0)hops=1});build()});
  document.addEventListener('keydown',e=>{if(view==='explore'&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){e.preventDefault();undo()}});
  let rt;new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(()=>{resize();if(!userZoomed&&!running)fit(false)},80)}).observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stopLayout(false)});
  renderSettings();resize();build();
}
})();
