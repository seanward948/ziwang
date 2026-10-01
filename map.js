/* Zìwǎng character network: characters as nodes, shared words as edges */
(function(){
const root=document.getElementById('map');if(!root)return;
const store={get(k,d){try{const v=localStorage.getItem('ziwang.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('ziwang.'+k,JSON.stringify(v))}catch(e){}}};
const track=(n,p)=>{try{if(window.gtag)window.gtag('event',n,p||{})}catch(e){}};
const esc0=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));

/* what this device can comfortably draw and simulate */
const small=matchMedia('(max-width:700px)').matches||(navigator.hardwareConcurrency||8)<=2||(navigator.deviceMemory||8)<=2;
const MAX_LINKS=small?7000:45000, MAX_NODES=small?700:1600;

root.innerHTML=`<div class="map-stage map-boot"><div class="map-load"><span class="spin" aria-hidden="true"></span><span>Loading the dictionary…</span></div></div>`;
if(!window.d3){root.innerHTML='<p class="g-loading">The network viewer couldn’t load. Check your connection and refresh.</p>';return}
(window.ZIWANG_READY||Promise.reject()).then(init).catch(()=>{root.innerHTML='<p class="g-loading">The dictionary didn’t load. Check your connection and refresh.</p>'});

function init(C){
  const {CH,WORDS,esc,charPy,charDef,path,sylTone,pyHTMLJoined,LVNAME,rankBand}=C;
  const LEVELS=[[1,'HSK 1'],[2,'HSK 1–2'],[3,'HSK 1–3'],[4,'HSK 1–4'],[5,'HSK 1–5'],[6,'HSK 1–6'],[7,'All HSK'],[8,'All HSK + more words']];
  const LAYOUTS=[['force','Force-directed'],['fa2','ForceAtlas2'],['rings','Rings by distance'],['levels','Rings by HSK level'],['spiral','Frequency spiral']];
  const DEFAULTS={force:{distance:34,repulsion:70,gravity:.05,overlap:true},fa2:{scaling:2.5,gravity:1,strong:false,linlog:false,weight:.5,overlap:true},rings:{spacing:120},levels:{spacing:1},spiral:{spacing:9}};
  const params=new URLSearchParams(location.search);
  const trail=store.get('trail',[]);
  let q=(params.get('q')||trail[trail.length-1]||'电').trim();
  let hops=params.has('hops')?+params.get('hops'):1, lv=params.has('lv')?+params.get('lv'):1;
  let layout=params.get('layout')||'force',colour='auto',size='default',runSecs=6,edgesPref=null;
  const settings=JSON.parse(JSON.stringify(DEFAULTS));
  if(![0,1,2,3].includes(hops))hops=1;if(!(lv>=1&&lv<=8))lv=1;if(!LAYOUTS.some(l=>l[0]===layout))layout='force';

  root.innerHTML=`
  <div class="map-bar">
    <form class="map-seed" id="mapSeed" autocomplete="off"><input id="mapQ" type="text" lang="zh-Hans" aria-label="Character or word to centre on" placeholder="电 or 电脑"><button class="btn" type="submit">Show</button></form>
    <div class="map-seg" role="group" aria-label="How far to reach">
      ${[[1,'1 jump'],[2,'2 jumps'],[3,'3 jumps'],[0,'Full network']].map(([k,n])=>`<button type="button" data-hops="${k}">${n}</button>`).join('')}
    </div>
    <label class="map-lv">Words <select id="mapLv">${LEVELS.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label>
    <button class="btn" type="button" id="mapSetBtn" aria-expanded="false" aria-controls="mapSettings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>Layout settings</button>
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
  let W=0,H=0,dpr=1,transform=d3.zoomIdentity,sim=null,nodes=[],links=[],byId=new Map(),hover=null,selected=null,seeds=[],quad=null,maxDeg=1,rings=[],running=false,runStart=0,userZoomed=false,buildId=0;

  const edgesOn=()=>edgesPref!=null?edgesPref:(links.length<=150&&nodes.length<=80);
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
    if(edgeCache[level])return edgeCache[level];
    const E=new Map(),adj=new Map();
    for(const w of WORDS){
      if(w.lv>level)continue;const cs=[...new Set(w.w)].filter(c=>CH[c]);if(cs.length<2||cs.length>4)continue;
      for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){
        const a=cs[i]<cs[j]?cs[i]:cs[j],b=cs[i]<cs[j]?cs[j]:cs[i],k=a+'|'+b;
        let e=E.get(k);if(!e){e={a,b,words:[],n:0};E.set(k,e);
          if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a)}
        e.n++;if(e.words.length<8)e.words.push(w);
      }
    }
    return edgeCache[level]={E,adj};
  }
  const fullTooBig=level=>{if(level===8&&!C.extraLoaded())return small;return edgesFor(level).E.size>MAX_LINKS};
  function updateLevelOptions(){
    const opts=$('mapLv').options;
    for(const o of opts){const l=+o.value;const big=hops===0&&fullTooBig(l);
      o.disabled=big;o.textContent=LEVELS.find(x=>x[0]===l)[1]+(big?' (too large for full view)':'')}
  }

  /* ---- community detection: Louvain modularity, weighted by shared words ---- */
  let comm=new Map(),commList=[];
  function detectCommunities(){
    const ids=nodes.map(n=>n.id),idx=new Map(ids.map((id,i)=>[id,i]));
    let adj=Array.from({length:ids.length},()=>new Map());
    for(const l of links){const a=idx.get(l.source.id),b=idx.get(l.target.id),w=l.e.n;adj[a].set(b,(adj[a].get(b)||0)+w);adj[b].set(a,(adj[b].get(a)||0)+w)}
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
  const mode=()=>colour!=='auto'?colour:layout==='levels'?'level':hops===0?'community':'depth';
  function radius(d){
    if(isSeed(d))return 14;
    if(size==='degree')return 3.5+11*Math.sqrt(d.deg/maxDeg);
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
  }

  /* ---- build the visible graph ---- */
  async function build(){
    const id=++buildId;stopLayout(true);
    if(lv===8&&!C.extraLoaded()){loading('Loading more words…');const F=window.ZIWANG_LOAD_FULL?window.ZIWANG_LOAD_FULL():window.ZIWANG_FULL;if(F)await F;delete edgeCache[8];if(id!==buildId)return}
    loading('Building the network…');await nextFrame();if(id!==buildId)return;
    updateLevelOptions();
    if(hops===0&&fullTooBig(lv)){ // step down to the largest level this device can show in full
      let l=lv;while(l>1&&fullTooBig(l))l--;note(`The full network at ${levelName(lv)} is too large for this device, so it’s showing ${levelName(l)}. Use jumps to explore bigger levels.`);lv=l;
    }else note('');
    let {E,adj}=edgesFor(lv);
    const chars=[...new Set([...q])].filter(c=>CH[c]);
    seeds=chars.filter(c=>adj.has(c));
    if(hops!==0&&!seeds.length&&chars.length){ // raise the word level until the character has links
      let l=lv;while(l<7&&!chars.some(c=>edgesFor(l).adj.has(c)))l++;
      if(l!==lv){note(`${q} has no links at ${levelName(lv)}, so the map is showing ${levelName(l)}.`);lv=l;({E,adj}=edgesFor(lv));seeds=chars.filter(c=>adj.has(c))}
    }
    const depth=new Map();let truncated=false;
    if(hops===0){for(const c of adj.keys())depth.set(c,seeds.includes(c)?0:null)}
    else{
      const qq=[];for(const s of seeds){depth.set(s,0);qq.push(s)}
      for(let i=0;i<qq.length;i++){const x=qq[i],d=depth.get(x);if(d>=hops)continue;
        const nb=[...adj.get(x)].sort((m,n)=>(CH[m].rank||1e5)-(CH[n].rank||1e5));
        for(const y of nb)if(!depth.has(y)){if(depth.size>=MAX_NODES){truncated=true;break}depth.set(y,d+1);qq.push(y)}}
    }
    const prev=new Map(nodes.map(n=>[n.id,n]));
    nodes=[...depth.keys()].map(c=>{const p=prev.get(c);return {id:c,depth:depth.get(c),rank:CH[c].rank,x:p?p.x:(Math.random()-.5)*60,y:p?p.y:(Math.random()-.5)*60,vx:0,vy:0}});
    byId=new Map(nodes.map(n=>[n.id,n]));
    links=[];for(const e of E.values())if(byId.has(e.a)&&byId.has(e.b))links.push({source:byId.get(e.a),target:byId.get(e.b),e});
    if(links.length>MAX_LINKS){ // keep the strongest links so the page stays responsive
      links.sort((a,b)=>b.e.n-a.e.n);links.length=MAX_LINKS;truncated=true}
    const deg=new Map();for(const l of links){deg.set(l.source.id,(deg.get(l.source.id)||0)+1);deg.set(l.target.id,(deg.get(l.target.id)||0)+1)}
    maxDeg=1;for(const n of nodes){n.deg=deg.get(n.id)||0;maxDeg=Math.max(maxDeg,n.deg)}
    nodes.forEach(n=>n.r=radius(n));
    detectCommunities();
    hover=null;selected=null;edgesPref=null;
    root.querySelectorAll('[data-hops]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.hops===hops));
    $('mapLv').value=lv;$('mapQ').value=q;
    updateLevelOptions();legend();renderSettings();
    try{const u=new URL(location.href);u.searchParams.set('q',q);u.searchParams.set('hops',hops);u.searchParams.set('lv',lv);u.searchParams.set('layout',layout);history.replaceState(null,'',u)}catch(e){}
    stats=`${nodes.length.toLocaleString()} characters · ${links.length.toLocaleString()} links${truncated?' · trimmed to fit this device':''}`;
    if(!seeds.length&&hops!==0)info.innerHTML=`<p class="hint">${esc(q)} doesn’t link to anything yet. Try more word levels or another character.</p>`;else showDefault();
    loading('');userZoomed=false;startLayout();
  }
  let stats='';
  const levelName=l=>(LEVELS.find(x=>x[0]===l)||LEVELS[0])[1];
  function note(t){const n=$('mapNote');n.textContent=t;n.hidden=!t}

  /* ---- layouts ---- */
  function applyForces(){
    const n=nodes.length,s=settings[layout]||{};
    sim.force('link',null).force('charge',null).force('collide',null).force('x',null).force('y',null).force('radial',null).force('attract',null).force('gravity',null);
    nodes.forEach(d=>{d.fx=null;d.fy=null});
    const collide=on=>{if(on)sim.force('collide',d3.forceCollide(d=>d.r+1.5).iterations(1))};
    if(layout==='force'){
      sim.force('link',d3.forceLink(links).distance(s.distance).strength(.4)).force('charge',d3.forceManyBody().strength(-s.repulsion).distanceMax(500).theta(.9))
        .force('x',d3.forceX(0).strength(s.gravity)).force('y',d3.forceY(0).strength(s.gravity));collide(s.overlap);
    }else if(layout==='fa2'){ // ForceAtlas2-style: degree-weighted repulsion, (lin-log) attraction, gravity
      sim.force('charge',d3.forceManyBody().strength(d=>-s.scaling*(d.deg+1)).theta(.9));
      sim.force('attract',alpha=>{const k=.05*alpha;for(const l of links){const a=l.source,b=l.target,dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
        let f=s.linlog?Math.log(1+dist)/dist*6:1;f*=Math.pow(l.e.n,s.weight);a.vx+=dx*k*f;a.vy+=dy*k*f;b.vx-=dx*k*f;b.vy-=dy*k*f}});
      sim.force('gravity',alpha=>{const g=.04*s.gravity*alpha;for(const d of nodes){const dist=Math.hypot(d.x,d.y)||1;const f=s.strong?g*.05:g*(d.deg+1)/dist;d.vx-=d.x*f;d.vy-=d.y*f}});
      collide(s.overlap);
    }else if(layout==='rings'){
      sim.force('link',d3.forceLink(links).distance(40).strength(.15)).force('charge',d3.forceManyBody().strength(-40).distanceMax(300))
        .force('radial',d3.forceRadial(d=>(d.depth||0)*s.spacing,0,0).strength(d=>d.depth===0?1:.8));collide(true);
      const sp=seeds.length;nodes.forEach(d=>{const i=seeds.indexOf(d.id);if(d.depth===0&&i>=0){d.fx=sp===1?0:(i-(sp-1)/2)*70;d.fy=0}});
    }else if(layout==='levels'){
      const cnt=new Map();for(const d of nodes){const l=Math.min(CH[d.id].lv,8);cnt.set(l,(cnt.get(l)||0)+1)}
      const band=new Map();let R=0;rings=[];
      for(let l=1;l<=8;l++){const c=cnt.get(l)||0;if(!c)continue;const area=c*Math.PI*64*1.5*s.spacing;const R2=Math.sqrt(R*R+area/Math.PI);band.set(l,l===1?R2*.55:(R+R2)/2);rings.push({r:R2+9,l});R=R2+18*s.spacing}
      sim.force('link',d3.forceLink(links).distance(30).strength(.03)).force('charge',d3.forceManyBody().strength(-12))
        .force('radial',d3.forceRadial(d=>band.get(Math.min(CH[d.id].lv,8)),0,0).strength(1));sim.force('collide',d3.forceCollide(d=>d.r+1.5).iterations(2));
    }
  }
  function startLayout(){
    stopLayout(true);rings=layout==='levels'?rings:[];
    if(layout==='spiral'){
      const s=settings.spiral;const order=nodes.slice().sort((a,b)=>(a.rank||1e5)-(b.rank||1e5));
      order.forEach((d,i)=>{const a=i*2.39996,r=s.spacing*Math.sqrt(i);d.x=r*Math.cos(a);d.y=r*Math.sin(a);d.vx=d.vy=0});
      quad=d3.quadtree(nodes,d=>d.x,d=>d.y);fit(false);draw();runUI('static');return;
    }
    sim=d3.forceSimulation(nodes).stop().velocityDecay(.45);applyForces();
    // cool down over the chosen run time (about 60 steps a second), then freeze
    const ticks=Math.max(60,runSecs*60);sim.alpha(1).alphaMin(.001).alphaDecay(1-Math.pow(.001,1/ticks));
    running=true;runStart=performance.now();let lastDraw=0,lastFit=0;
    sim.on('tick',()=>{const now=performance.now(),el=(now-runStart)/1000;
      if(now-lastDraw>(links.length>8000?50:16)){draw();lastDraw=now}
      if(!userZoomed&&now-lastFit>400){fit(false);lastFit=now}
      runUI('run',Math.min(1,el/runSecs));
      if(el>=runSecs)stopLayout(false)});
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
    spiral:[['spacing','Spacing',4,20,1]]};
  const TOGGLES={force:[['overlap','Prevent overlap']],fa2:[['linlog','LinLog mode'],['strong','Strong gravity'],['overlap','Prevent overlap']]};
  function renderSettings(){
    const s=settings[layout];const name=LAYOUTS.find(l=>l[0]===layout)[1];
    const sel=(id,opts,cur)=>`<select id="${id}">${opts.map(([k,n,dis])=>`<option value="${k}"${k===cur?' selected':''}${dis?' disabled':''}>${n}</option>`).join('')}</select>`;
    $('mapSettings').innerHTML=`<div class="ms-sec"><h3>Display</h3><div class="ms-grid">
        <label class="ms-f">Layout ${sel('mapLayout',LAYOUTS.map(([k,n])=>[k,n+(k==='rings'&&hops===0?' (needs jumps)':''),k==='rings'&&hops===0]),layout)}</label>
        <label class="ms-f">Node size ${sel('mapSize',[['default','Same size'],['degree','Degree (links)'],['freq','Frequency']],size)}</label>
        <label class="ms-f">Colour ${sel('mapColour',[['auto','Automatic'],['depth','Distance'],['level','HSK level'],['community','Communities']],colour)}</label>
        <label class="ms-t"><input type="checkbox" id="mapEdges"${edgesOn()?' checked':''}> Show all links</label></div>
        <p class="ms-hint">With links hidden, click a character to see its links, then hover a link for its word.</p></div>
      <div class="ms-sec"><h3>${name}</h3>${layout==='spiral'?'':`<label class="ms-f">Run for <select id="msRun">${[3,6,12,30].map(v=>`<option value="${v}"${v===runSecs?' selected':''}>${v} seconds</option>`).join('')}</select></label>`}
      <div class="ms-grid">${(SLIDERS[layout]||[]).map(([k,label,min,max,step])=>`<label class="ms-s"><span>${label} <output>${s[k]}</output></span><input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`).join('')}
      ${(TOGGLES[layout]||[]).map(([k,label])=>`<label class="ms-t"><input type="checkbox" data-set="${k}"${s[k]?' checked':''}> ${label}</label>`).join('')}</div>
      <div class="ms-act"><button class="btn primary" type="button" data-act="apply">${layout==='spiral'?'Apply':'Apply and run'}</button><button class="btn" type="button" data-act="reset">Reset to defaults</button></div></div>`;
  }
  $('mapSettings').addEventListener('input',e=>{const k=e.target.dataset.set;if(!k)return;const s=settings[layout];
    if(e.target.type==='checkbox')s[k]=e.target.checked;else{s[k]=+e.target.value;e.target.previousElementSibling.querySelector('output').textContent=e.target.value}});
  $('mapSettings').addEventListener('change',e=>{const t=e.target;
    if(t.id==='msRun')runSecs=+t.value;
    else if(t.id==='mapLayout'){layout=t.value;track('map_layout',{layout});renderSettings();legend();userZoomed=false;
      try{const u=new URL(location.href);u.searchParams.set('layout',layout);history.replaceState(null,'',u)}catch(err){}startLayout()}
    else if(t.id==='mapSize'){size=t.value;nodes.forEach(n=>n.r=radius(n));if(sim&&sim.force('collide'))sim.force('collide').radius(d=>d.r+1.5);quad=d3.quadtree(nodes,d=>d.x,d=>d.y);draw()}
    else if(t.id==='mapColour'){colour=t.value;legend();draw()}
    else if(t.id==='mapEdges'){edgesPref=t.checked;hover=null;tip.hidden=true;draw()}});
  $('mapSettings').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;
    if(b.dataset.act==='reset'){settings[layout]=JSON.parse(JSON.stringify(DEFAULTS[layout]));renderSettings()}
    userZoomed=false;track('map_layout_settings',{layout});startLayout()});
  $('mapSetBtn').addEventListener('click',()=>{const p=$('mapSettings');p.hidden=!p.hidden;$('mapSetBtn').setAttribute('aria-expanded',!p.hidden)});

  /* ---- canvas, zoom, drawing ---- */
  const zoom=d3.zoom().scaleExtent([.03,8]).on('zoom',e=>{transform=e.transform;if(e.sourceEvent)userZoomed=true;if(!running)draw()});
  d3.select(canvas).call(zoom).on('dblclick.zoom',null);
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
    ctx.lineWidth=Math.max(.4,1/k);ctx.strokeStyle=col.grid;ctx.globalAlpha=!showE?.05:links.length>8000?.22:links.length>2000?.4:.7;
    ctx.beginPath();for(const l of links){ctx.moveTo(l.source.x,l.source.y);ctx.lineTo(l.target.x,l.target.y)}ctx.stroke();ctx.globalAlpha=1;
    const near=new Set();
    if(fn){ctx.strokeStyle=col.accent;ctx.lineWidth=Math.max(1.2,2/k);ctx.beginPath();
      for(const l of links)if(l.source===fn||l.target===fn){ctx.moveTo(l.source.x,l.source.y);ctx.lineTo(l.target.x,l.target.y);near.add(l.source);near.add(l.target)}ctx.stroke()}
    if(fe){ctx.strokeStyle=col.accent;ctx.lineWidth=Math.max(2,3.5/k);ctx.beginPath();ctx.moveTo(fe.source.x,fe.source.y);ctx.lineTo(fe.target.x,fe.target.y);ctx.stroke();near.add(fe.source);near.add(fe.target)}
    const labelAll=nodes.length<400;
    for(const d of nodes){
      const seed=isSeed(d),hi=near.has(d)||d===fn;
      const f=d===fn?col.accent:hi&&mode()==='depth'?col.soft:fillFor(d);
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fillStyle=f;ctx.fill();
      ctx.lineWidth=Math.max(.6,(seed||hi?2:1)/k);ctx.strokeStyle=seed||hi?col.accent:col.line;ctx.stroke();
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
    if(running)return null;
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
    const e=h.link.e;return `${wordLine(e.words[0])}${e.n>1?` <span class="more">+${e.n-1} more</span>`:''}`;
  }
  function showDefault(){info.innerHTML=`<p class="hint">Hover or tap a line to see the word that joins two characters. Tap a character for details; tap it again to centre on it.</p>`}
  function showInfo(h){
    if(!h){showDefault();return}
    if(h.node){
      const c=h.node.id,o=CH[c],p=charPy(c);const deg=links.filter(l=>l.source===h.node||l.target===h.node);
      const ws=[...new Map(deg.flatMap(l=>l.e.words).map(w=>[w.w,w])).values()].sort((a,b)=>a.lv-b.lv).slice(0,8);
      info.innerHTML=`<div class="map-sel"><span class="big cn" lang="zh-Hans">${esc(c)}</span><span class="t${sylTone(p)}">${esc(p)}</span><span class="gl">${esc(charDef(c))}</span>
        ${o.lv<=7?`<span class="pill lv">${LVNAME(o.lv)}</span>`:''}${o.rank?`<span class="pill">#${o.rank} most used</span>`:''}<span class="pill">${deg.length} link${deg.length===1?'':'s'}</span></div>
        <ul class="map-words">${ws.map(w=>`<li>${wordLine(w)}</li>`).join('')}</ul>
        <div class="map-act"><button class="btn primary" type="button" data-centre="${esc(c)}">Centre on ${esc(c)}</button><a class="btn" href="${path(c)}">Open ${esc(c)}</a></div>`;
    }else{
      const e=h.link.e;
      info.innerHTML=`<div class="map-sel"><span class="big cn" lang="zh-Hans">${esc(e.a)}</span><span class="join">—</span><span class="big cn" lang="zh-Hans">${esc(e.b)}</span><span class="pill">${e.n} word${e.n===1?'':'s'}</span></div>
        <ul class="map-words">${e.words.map(w=>`<li>${wordLine(w)} <span class="pill">${LVNAME(w.lv)}</span></li>`).join('')}</ul>
        <div class="map-act"><button class="btn" type="button" data-centre="${esc(e.a)}">Centre on ${esc(e.a)}</button><button class="btn" type="button" data-centre="${esc(e.b)}">Centre on ${esc(e.b)}</button></div>`;
    }
  }
  const pointer=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
  canvas.addEventListener('mousemove',e=>{
    const [mx,my]=pointer(e);const h=pick(mx,my);
    if(!(h&&hover&&h.node===hover.node&&h.link===hover.link)&&(h||hover)){hover=h;draw()}
    if(h){tip.hidden=false;tip.innerHTML=tipHTML(h);const tw=tip.offsetWidth;tip.style.left=Math.max(8,Math.min(W-tw-8,mx+14))+'px';tip.style.top=Math.max(8,my-44)+'px';canvas.style.cursor='pointer'}
    else{tip.hidden=true;canvas.style.cursor=''}
  },{passive:true});
  canvas.addEventListener('mouseleave',()=>{hover=null;tip.hidden=true;draw()});
  canvas.addEventListener('click',e=>{
    if(running)return;const [mx,my]=pointer(e);const h=pick(mx,my);
    if(h&&h.node&&selected&&selected.node===h.node){centre(h.node.id);return}
    selected=h;showInfo(h);draw();
  });
  function centre(c){q=c;if(hops===0)hops=1;track('map_centre',{character:c});build()}

  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-hops],[data-z],[data-centre],#mapRunBtn');if(!b)return;
    if(b.id==='mapRunBtn'){if(b.dataset.run==='stop')stopLayout(false);else{userZoomed=false;startLayout()}return}
    if(b.dataset.centre){centre(b.dataset.centre);return}
    if(b.dataset.hops!=null){hops=+b.dataset.hops;if(hops===0&&layout==='rings')layout='force';track('map_view',{hops});build();return}
    const z=b.dataset.z,s=d3.select(canvas);
    if(z==='in')s.transition().duration(250).call(zoom.scaleBy,1.5);else if(z==='out')s.transition().duration(250).call(zoom.scaleBy,1/1.5);else{userZoomed=false;fit(true)}
  });
  $('mapLv').addEventListener('change',e=>{lv=+e.target.value;build()});
  $('mapSeed').addEventListener('submit',e=>{e.preventDefault();const v=$('mapQ').value.trim();
    const cs=[...v].filter(c=>CH[c]);if(!cs.length){note('Type a Chinese character or word.');return}
    q=cs.join('');if(hops===0)hops=1;build()});
  let rt;new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(()=>{resize();if(!userZoomed&&!running)fit(false)},80)}).observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stopLayout(false)});
  renderSettings();resize();build();
}
})();
