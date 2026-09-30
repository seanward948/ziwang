/* Six Degrees of 字: travel across a web of characters, one shared word at a time */
(function(){
const root=document.getElementById('six');if(!root)return;
const store={get(k,d){try{const v=localStorage.getItem('ziwang.six.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('ziwang.six.'+k,JSON.stringify(v))}catch(e){}}};
const track=(n,p)=>{try{if(window.gtag)window.gtag('event',n,p||{})}catch(e){}};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS='http://www.w3.org/2000/svg';
const K=20; // neighbours shown around each character
root.innerHTML='<p class="g-loading">Loading the word web…</p>';
(window.ZIWANG_READY||Promise.reject()).then(init).catch(()=>{root.innerHTML='<p class="g-loading">The dictionary didn’t load. Check your connection and refresh.</p>'});

function init(C){
  const {CH,WORDS,esc,pyHTML,pyHTMLJoined,charPy,charDef,path,sylTone}=C;
  const shortDef=c=>{const ds=(charDef(c)||'').split(';').map(s=>s.trim()).filter(Boolean);let d=ds.find(s=>!s.startsWith('(')&&!/^(surname|variant|abbr)/i.test(s))||ds[0]||'';return d.replace(/\s*\(.*?\)\s*/g,' ').trim()};
  const goodTarget=c=>{const d=(charDef(c)||'').split(';')[0].trim();return !d.startsWith('(')&&!/particle|classifier|measure word|surname|interjection/i.test(charDef(c))};
  const LEVELS=[['all','All words'],[1,'HSK 1'],[2,'HSK 1–2'],[3,'HSK 1–3'],[4,'HSK 1–4'],[5,'HSK 1–5'],[6,'HSK 1–6']];
  const levelName=l=>(LEVELS.find(x=>String(x[0])===String(l))||LEVELS[0])[1];

  /* ---- graph: each character links to its K most common neighbours ---- */
  const graphs={};
  function graph(level){
    const key=String(level);if(graphs[key])return graphs[key];
    const max=level==='all'?7:+level;const best=new Map();
    for(const w of WORDS){ // WORDS is ordered by level, then frequency
      if(w.lv>max||[...w.w].length>4)continue;
      const cs=[...new Set(w.w)].filter(c=>CH[c]);if(cs.length<2)continue;
      for(const a of cs){if(!best.has(a))best.set(a,new Map());const m=best.get(a);for(const b of cs)if(a!==b&&!m.has(b))m.set(b,w)}
    }
    const out=new Map(),rev=new Map();
    for(const [a,m] of best){const list=[...m.entries()].slice(0,K).map(([n,w])=>({n,w}));out.set(a,list);
      for(const {n} of list){if(!rev.has(n))rev.set(n,new Set());rev.get(n).add(a)}}
    return graphs[key]={out,rev,max};
  }
  function bfs(G,s){const d=new Map([[s,0]]),q=[s];for(let i=0;i<q.length;i++){const x=q[i];for(const {n} of G.out.get(x)||[])if(!d.has(n)){d.set(n,d.get(x)+1);q.push(n)}}return d}
  function bfsTo(G,t){const d=new Map([[t,0]]),q=[t];for(let i=0;i<q.length;i++){const x=q[i];for(const p of G.rev.get(x)||[])if(!d.has(p)){d.set(p,d.get(x)+1);q.push(p)}}return d}
  function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  function makePuzzle(level,seed){
    const G=graph(level),r=rng(seed),cap=level==='all'?3:Math.min(+level,3);
    const starts=[...G.out.keys()].filter(c=>CH[c].lv<=Math.min(cap,2)&&G.out.get(c).length>=4&&goodTarget(c)).sort();
    for(const [lo,hi] of [[3,4],[2,5]])for(let tries=0;tries<40;tries++){
      const s=starts[Math.floor(r()*starts.length)];if(!s)break;const d=bfs(G,s);
      const ts=[...d.keys()].filter(c=>d.get(c)>=lo&&d.get(c)<=hi&&CH[c].lv<=cap&&goodTarget(c)).sort();
      if(ts.length){const t=ts[Math.floor(r()*ts.length)];return {start:s,target:t,par:d.get(t)}}
    }
    return {start:'火',target:'海',par:4};
  }
  const EPOCH=Date.UTC(2026,8,30);
  const now=new Date();const dayNo=Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-EPOCH)/864e5)+1;

  /* ---- state ---- */
  let S,G,distT,practiceLevel=store.get('level','all');
  function start(mode,seed){
    const level=mode==='daily'?'all':practiceLevel;G=graph(level);
    const p=makePuzzle(level,seed);
    S={mode,level,no:dayNo,...p,path:[p.start],words:[],fb:[],hints:0,done:false,gaveUp:false,sel:null,hint:null};
    if(mode==='daily'){const sv=store.get('daily',null);if(sv&&sv.no===dayNo&&sv.start===p.start&&sv.target===p.target)Object.assign(S,sv,{sel:null,hint:null})}
    distT=bfsTo(G,S.target);renderAll(true);
  }
  function save(){if(S.mode==='daily')store.set('daily',{no:S.no,start:S.start,target:S.target,par:S.par,path:S.path,words:S.words,fb:S.fb,hints:S.hints,done:S.done,gaveUp:S.gaveUp})}
  const cur=()=>S.path[S.path.length-1];
  const steps=()=>S.path.length-1;
  const nextBest=c=>{const dc=distT.get(c);if(dc==null)return null;return (G.out.get(c)||[]).find(x=>distT.get(x.n)===dc-1)||null};

  /* ---- layout ---- */
  root.innerHTML=`
  <div class="sx">
    <div class="sx-bar">
      <div class="sx-tabs" role="tablist">
        <button type="button" role="tab" data-tab="daily">Daily #${dayNo}</button>
        <button type="button" role="tab" data-tab="practice">Random</button>
      </div>
      <div class="sx-levels" id="sxLevels"></div>
    </div>
    <div class="sx-hud" id="sxHud"></div>
    <div class="sx-stage" id="sxStage"></div>
    <div class="sx-trail" id="sxTrail" aria-label="Your route"></div>
    <div class="sx-actions" id="sxActions"></div>
  </div>`;
  const $=id=>root.querySelector('#'+id);

  function renderAll(fresh){
    root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.mode));
    $('sxLevels').innerHTML=S.mode==='daily'
      ?`<span class="sx-lvnote">Daily puzzles use all words</span>`
      :`<label for="sxLevel">Words</label><select id="sxLevel">${LEVELS.map(([k,n])=>`<option value="${k}"${String(k)===String(practiceLevel)?' selected':''}>${n}</option>`).join('')}</select><button class="btn" type="button" data-act="new">New puzzle</button>`;
    renderHud();renderTrail();
    if(S.done)renderEnd(!fresh);else{renderActions();drawWeb(fresh?'burst':'none')}
  }
  function tile(c,cls){const p=charPy(c);return `<a class="sx-tile ${cls}" href="${path(c)}" title="${esc(shortDef(c))}"><span class="cn" lang="zh-Hans">${esc(c)}</span><small class="t${sylTone(p)}">${esc(p)}</small></a>`}
  function renderHud(){
    const last=S.fb[S.fb.length-1];
    const fb=!S.done&&last?`<span class="sx-fb ${last}">${last==='c'?'Getting closer':last==='f'?'Further away':'No closer'}</span>`:'';
    const pips=Array.from({length:Math.max(S.par,steps())},(_,i)=>`<i class="${i<steps()?(S.fb[i]||'x'):''}${i>=S.par?' over':''}"></i>`).join('');
    $('sxHud').innerHTML=`
      <div class="sx-ends">${tile(S.start,'is-start')}<span class="sx-road" aria-hidden="true">${pips}</span>${tile(S.target,'is-target')}</div>
      <div class="sx-status"><span class="pill">Steps ${steps()}</span><span class="pill">Par ${S.par}</span>${S.mode==='practice'?`<span class="pill">${levelName(S.level)}</span>`:''}${S.hints?`<span class="pill">Hints ${S.hints}</span>`:''}${fb}</div>
      <p class="sx-goal">Travel from <b class="cn" lang="zh-Hans">${esc(S.start)}</b> to <b class="cn" lang="zh-Hans">${esc(S.target)}</b> (${esc(shortDef(S.target))}). Each hop follows a word that both characters share.</p>`;
  }
  function renderTrail(){
    $('sxTrail').innerHTML=S.path.map((c,i)=>(i?`<span class="sx-link" lang="zh-Hans">${esc(S.words[i-1])}</span>`:'')+`<span class="sx-step${i===S.path.length-1&&!S.done?' here':''}${c===S.target?' goal':''}" lang="zh-Hans">${esc(c)}</span>`).join('');
  }
  function renderActions(){
    $('sxActions').innerHTML=`<button class="btn" type="button" data-act="undo"${S.path.length<2?' disabled':''}>Undo</button>
      <button class="btn" type="button" data-act="hint">Hint</button>
      <button class="btn" type="button" data-act="giveup">Show solution</button>`;
  }

  /* ---- the web ---- */
  let lastLayout=null;
  function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
  function drawWeb(anim){
    const stage=$('sxStage');
    stage.innerHTML=`<svg class="sx-web" id="sxWeb" role="group" aria-label="Characters you can hop to"></svg><div class="sx-card" id="sxCard" aria-live="polite"></div>`;
    const svg=$('sxWeb');const W=stage.clientWidth||700;const narrow=W<560;
    const H=narrow?Math.round(W*1.08):Math.min(520,Math.max(440,Math.round(W*.6)));
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.style.height=H+'px';
    const cx=W/2,cy=H/2,c=cur();
    const list=G.out.get(c)||[];
    const inner=list.slice(0,8),outer=list.slice(8);
    const pos=[];
    const ring=(arr,rx,ry,off)=>arr.forEach((x,i)=>{const a=-Math.PI/2+off+i*2*Math.PI/arr.length;pos.push({...x,x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)})});
    ring(inner,W*(narrow?.26:.2),H*(narrow?.24:.26),0);
    ring(outer,W*(narrow?.43:.38),H*(narrow?.41:.42),Math.PI/Math.max(outer.length,1));
    lastLayout={cx,cy,pos};
    const gl=el('g',{},svg),gn=el('g',{},svg);
    const visited=new Set(S.path);
    const hintN=S.hint&&S.hint.from===c?S.hint.n:null;
    pos.forEach((p,i)=>{
      const line=el('line',{x1:cx,y1:cy,x2:p.x,y2:p.y,class:'sx-edge','data-n':p.n},gl);
      const g=el('g',{class:'sx-node'+(p.n===S.target?' target':'')+(visited.has(p.n)?' visited':'')+(p.n===hintN?' hinted':''),tabindex:0,role:'button','data-n':p.n,'aria-label':`${p.n}, via ${p.w.w}`},gn);
      el('circle',{r:narrow?19:22,class:'bg'},g);
      const t=el('text',{'text-anchor':'middle',y:narrow?6.5:7.5,class:'ch'},g);t.textContent=p.n;
      if(p.n===S.target)el('circle',{r:narrow?25:29,class:'ring'},g);
      if(anim==='burst'&&!reduce){g.style.transform=`translate(${cx}px,${cy}px) scale(.3)`;g.style.opacity=0;g.classList.add('mv');g.style.transitionDelay=(40+i*22)+'ms';
        line.style.opacity=0;requestAnimationFrame(()=>requestAnimationFrame(()=>{g.style.transform=`translate(${p.x}px,${p.y}px)`;g.style.opacity=1;line.style.opacity='';}))}
      else g.style.transform=`translate(${p.x}px,${p.y}px)`;
    });
    const me=el('g',{class:'sx-me'},gn);me.style.transform=`translate(${cx}px,${cy}px)`;
    el('circle',{r:narrow?40:46,class:'halo'},me);el('circle',{r:narrow?34:40,class:'bg'},me);
    const mt=el('text',{'text-anchor':'middle',y:narrow?12:14,class:'ch'},me);mt.textContent=c;
    if(!list.length){const t=el('text',{x:cx,y:cy+80,'text-anchor':'middle',class:'sx-empty'},svg);t.textContent='Dead end. Undo to try another way.'}
    if(hintN)select(hintN);else card();
  }
  function card(){
    const c=cur();const p=charPy(c);
    $('sxCard').innerHTML=`<div class="sx-here"><span class="cn" lang="zh-Hans">${esc(c)}</span><span class="t${sylTone(p)}">${esc(p)}</span><span class="gl">${esc(shortDef(c))}</span></div><p class="hint">Tap a character around ${esc(c)} to see the word that links them.</p>`;
  }
  function select(n){
    S.sel=n;const c=cur();const x=(G.out.get(c)||[]).find(v=>v.n===n);if(!x)return;
    root.querySelectorAll('.sx-node').forEach(g=>g.classList.toggle('sel',g.dataset.n===n));
    root.querySelectorAll('.sx-edge').forEach(l=>l.classList.toggle('sel',l.dataset.n===n));
    const w=x.w;
    $('sxCard').innerHTML=`<div class="sx-word"><span class="w cn" lang="zh-Hans">${[...w.w].map(ch=>`<span class="${ch===c?'from':ch===n?'to':''}">${esc(ch)}</span>`).join('')}</span><span>${pyHTMLJoined(w.py)}</span><span class="gl">${esc(w.gl)}</span><span class="pill">${w.lv>=7?'HSK 7–9':'HSK '+w.lv}</span></div>
      <button class="btn primary sx-go" type="button" data-hop="${esc(n)}">Hop to <span class="cn" lang="zh-Hans">${esc(n)}</span> →</button>`;
  }
  function hop(n){
    const c=cur();const x=(G.out.get(c)||[]).find(v=>v.n===n);if(!x||S.busy)return;
    S.busy=true;
    const before=distT.get(c),after=distT.get(n);
    const go=()=>{
      S.busy=false;S.path.push(n);S.words.push(x.w.w);S.fb.push(after<before?'c':after>before?'f':'s');S.sel=null;S.hint=null;
      if(n===S.target){S.done=true;track('six_degrees_complete',{mode:S.mode,level:String(S.level),steps:steps(),par:S.par,hints:S.hints});
        if(S.mode==='daily'){const st=store.get('stats',{played:0,streak:0,last:0});if(st.last!==S.no){st.played++;st.streak=st.last===S.no-1?st.streak+1:1;st.last=S.no;store.set('stats',st)}}}
      save();renderHud();renderTrail();
      if(S.done)renderEnd(true);else{renderActions();drawWeb('burst')}
    };
    if(reduce||!lastLayout){go();return}
    const {cx,cy}=lastLayout;
    root.querySelectorAll('.sx-node').forEach(g=>{g.classList.add('mv');g.style.transitionDelay='0ms';
      if(g.dataset.n===n){g.style.transform=`translate(${cx}px,${cy}px) scale(1.6)`;g.classList.add('sel')}else g.style.opacity=0});
    root.querySelectorAll('.sx-edge').forEach(l=>l.style.opacity=0);
    const me=root.querySelector('.sx-me');if(me){me.classList.add('mv');me.style.opacity=0;me.style.transform+=' scale(.5)'}
    setTimeout(go,420);
  }

  /* ---- ending: journey animation, results, share ---- */
  function shareText(){
    const sq=S.fb.map(f=>f==='c'?'🟩':f==='s'?'🟨':f==='f'?'🟥':'⬛').join('');
    const d=steps()-S.par;
    const line=S.gaveUp?`${sq||''} gave up`:`${sq}  ${steps()} step${steps()===1?'':'s'} · par ${S.par}${d?` (${d>0?'+':''}${d})`:''}`;
    return `Six Degrees of 字 #${S.no}\n${S.start} → ${S.target}\n${line}${S.hints?`\n💡 ${S.hints} hint${S.hints>1?'s':''}`:''}\nziwang.app/games/six-degrees`;
  }
  function parRoute(){const p=[S.start],w=[];let c=S.start;while(c!==S.target){const o=nextBest(c);if(!o)break;p.push(o.n);w.push(o.w.w);c=o.n}return {path:p,words:w}}
  const usedList=words=>words.map(w=>{const o=C.WORDMAP.get(w);return `<li><span class="cn" lang="zh-Hans">${esc(w)}</span> <span>${o?pyHTMLJoined(o.py):''}</span> <span class="gl">${esc(o?o.gl:'')}</span></li>`}).join('');
  function renderEnd(animate){
    $('sxActions').innerHTML='';
    const stage=$('sxStage');
    const diff=steps()-S.par;
    const verdict=S.gaveUp?'Here’s a shortest route from where you stopped.':diff<0?'Under par!':diff===0?'Right on par.':`${diff} over par.`;
    const st=store.get('stats',null);
    const same=!S.gaveUp&&diff===0;
    stage.innerHTML=`<div class="sx-routes" role="group" aria-label="Which route to show">
        <button type="button" data-route="mine" aria-pressed="true">${S.gaveUp?'Your route + solution':'Your route'} · ${steps()}</button>
        <button type="button" data-route="par" aria-pressed="false">Par route · ${S.par}</button>
      </div>
      <div class="sx-journey" id="sxJourney" aria-hidden="true"></div>
    <div class="sx-result${animate&&!reduce?' pending':''}" id="sxResult">
      <h2>${S.gaveUp?'Solution':`You reached <span class="cn" lang="zh-Hans">${esc(S.target)}</span>`}</h2>
      <p class="sx-verdict">${S.gaveUp?verdict:`${steps()} step${steps()===1?'':'s'} · par ${S.par}. ${verdict}`}${S.hints&&!S.gaveUp?` ${S.hints} hint${S.hints>1?'s':''} used.`:''}</p>
      <p class="hint" id="sxRouteNote">${same?'Your route matches par. Tap “Par route” to see another way there.':'Tap “Par route” to watch the shortest way there.'}</p>
      <ol class="sx-used" id="sxUsed">${usedList(S.words)}</ol>
      ${S.mode==='daily'?`<div class="sx-share"><pre id="sxShareText">${esc(shareText())}</pre><button class="btn primary" type="button" data-act="share">Copy result</button></div>
        ${st?`<p class="hint">Played ${st.played} · Streak ${st.streak} · A new puzzle arrives at midnight.</p>`:''}`:''}
      <div class="sx-endbtns">${S.mode==='daily'?'<button class="btn" type="button" data-act="random">Play a random puzzle</button>':'<button class="btn primary" type="button" data-act="new">Next puzzle</button><button class="btn" type="button" data-act="daily">Today’s daily</button>'}
        <a class="btn" href="${path(S.target)}">Explore ${esc(S.target)}</a></div>
    </div>`;
    journey({path:S.path,words:S.words},animate&&!reduce);
  }
  function showRoute(which){
    root.querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.route===which));
    const r=which==='par'?parRoute():{path:S.path,words:S.words};
    $('sxUsed').innerHTML=usedList(r.words);
    $('sxRouteNote').textContent=which==='par'?`One of the shortest routes: ${r.path.length-1} step${r.path.length===2?'':'s'}.`:'Your route.';
    journey(r,!reduce);
  }
  let animToken=0;
  function journey(route,animate){
    const token=++animToken;
    const box=$('sxJourney');box.innerHTML='';const W=box.clientWidth||700;const P=route.path,Wd=route.words,n=P.length;
    const pad=34,stepMin=74;const perRow=Math.max(2,Math.min(n,Math.floor((W-2*pad)/stepMin)+1));
    const rows=Math.ceil(n/perRow);const rowH=104;const H=rows*rowH+30;
    const stepX=perRow>1?Math.min(150,(W-2*pad)/(perRow-1)):0;const offX=(W-2*pad-stepX*(perRow-1))/2;
    const pts=P.map((c,i)=>{const r=Math.floor(i/perRow);let col=i%perRow;if(r%2)col=perRow-1-col;return {c,x:pad+offX+col*stepX,y:52+r*rowH+(col%2?-12:12)}});
    const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,class:'sx-jsvg'});svg.style.height=H+'px';box.appendChild(svg);
    const track=el('polyline',{points:pts.map(p=>p.x+','+p.y).join(' '),class:'track'},svg);
    const done=el('polyline',{points:pts[0].x+','+pts[0].y,class:'trail'},svg);
    const labels=[],nodes=[];
    for(let i=1;i<n;i++){const a=pts[i-1],b=pts[i];const t=el('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-10,'text-anchor':'middle',class:'wl'},svg);t.textContent=Wd[i-1];labels.push(t)}
    const marker=el('circle',{r:7,class:'marker',cx:pts[0].x,cy:pts[0].y},svg);
    pts.forEach((p,i)=>{const g=el('g',{class:'jn'+(i===0?' first':'')+(i===n-1?' last':'')},svg);g.setAttribute('transform',`translate(${p.x},${p.y})`);
      el('circle',{r:22,class:'bg'},g);const t=el('text',{'text-anchor':'middle',y:7.5,class:'ch'},g);t.textContent=p.c;nodes.push(g)});
    const result=$('sxResult');
    const finish=spark=>{nodes.forEach(g=>g.classList.add('on'));labels.forEach(l=>l.classList.add('on'));done.setAttribute('points',track.getAttribute('points'));
      marker.setAttribute('cx',pts[n-1].x);marker.setAttribute('cy',pts[n-1].y);nodes[n-1].classList.add('arrive');
      skip.remove();if(spark)burst(box,pts[n-1],P);setTimeout(()=>result&&result.classList.remove('pending'),spark?400:0)};
    const skip=document.createElement('button');skip.type='button';skip.className='btn sx-skip';skip.textContent='Skip';
    if(!animate){finish(false);return}
    if(n-1>=10){box.appendChild(skip);skip.addEventListener('click',()=>{animToken++;finish(true)})}
    nodes[0].classList.add('on');const trailPts=[pts[0]];let i=0;
    const seg=()=>{
      if(token!==animToken)return;
      if(i>=n-1){finish(true);return}
      const a=pts[i],b=pts[i+1],t0=performance.now(),dur=n>10?420:650;
      const f=now=>{if(token!==animToken)return;const k=Math.min(1,(now-t0)/dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;const x=a.x+(b.x-a.x)*e,y=a.y+(b.y-a.y)*e;
        marker.setAttribute('cx',x);marker.setAttribute('cy',y);done.setAttribute('points',[...trailPts,{x,y}].map(p=>p.x+','+p.y).join(' '));
        if(k<1)requestAnimationFrame(f);else{trailPts.push(b);nodes[i+1].classList.add('on');labels[i].classList.add('on');i++;setTimeout(seg,n>10?90:160)}};
      requestAnimationFrame(f)};
    setTimeout(seg,350);
  }
  function burst(box,p,route){
    const chars=[...new Set(route||S.path)];
    for(let k=0;k<14;k++){const s=document.createElement('span');s.className='sx-spark';s.lang='zh-Hans';s.textContent=chars[k%chars.length];
      const ang=Math.random()*Math.PI*2,dist=50+Math.random()*70;
      s.style.left=p.x+'px';s.style.top=p.y+'px';s.style.setProperty('--dx',Math.cos(ang)*dist+'px');s.style.setProperty('--dy',Math.sin(ang)*dist-30+'px');s.style.animationDelay=(k*25)+'ms';
      box.appendChild(s);setTimeout(()=>s.remove(),1600)}
  }

  /* ---- events ---- */
  root.addEventListener('click',e=>{
    const node=e.target.closest('.sx-node');
    if(node&&!S.done){const n=node.dataset.n;if(S.sel===n)hop(n);else select(n);return}
    const rt=e.target.closest('[data-route]');if(rt){showRoute(rt.dataset.route);return}
    const b=e.target.closest('[data-hop],[data-act],[data-tab]');if(!b)return;
    if(b.dataset.hop){hop(b.dataset.hop);return}
    if(b.dataset.tab){if(b.dataset.tab!==S.mode)b.dataset.tab==='daily'?start('daily',dayNo*7919+13):start('practice',Math.floor(Math.random()*1e9));return}
    const a=b.dataset.act;
    if(a==='undo'&&S.path.length>1){S.path.pop();S.words.pop();S.fb.pop();S.sel=null;S.hint=null;save();renderHud();renderTrail();renderActions();drawWeb('burst')}
    else if(a==='hint'){const o=nextBest(cur());if(!o)return;S.hints++;S.hint={from:cur(),n:o.n};save();renderHud();drawWeb('none');track('six_degrees_hint')}
    else if(a==='giveup'){let c=cur();while(c!==S.target){const o=nextBest(c);if(!o)break;S.path.push(o.n);S.words.push(o.w.w);S.fb.push('x');c=o.n}
      S.done=true;S.gaveUp=true;save();renderHud();renderTrail();renderEnd(true);track('six_degrees_giveup',{mode:S.mode})}
    else if(a==='new'||a==='random'){start('practice',Math.floor(Math.random()*1e9));track('six_degrees_practice',{level:String(practiceLevel)})}
    else if(a==='daily')start('daily',dayNo*7919+13);
    else if(a==='share'){
      const text=shareText();const done=()=>{b.textContent='Copied!';setTimeout(()=>b.textContent='Copy result',1800)};
      const fallback=()=>{const pre=$('sxShareText');const r=document.createRange();r.selectNodeContents(pre);const s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='Selected. Copy it now'};
      try{navigator.clipboard.writeText(text).then(done,fallback)}catch(err){fallback()}
      track('six_degrees_share')}
  });
  root.addEventListener('change',e=>{if(e.target.id==='sxLevel'){practiceLevel=e.target.value==='all'?'all':+e.target.value;store.set('level',practiceLevel);start('practice',Math.floor(Math.random()*1e9))}});
  root.addEventListener('keydown',e=>{const node=e.target.closest&&e.target.closest('.sx-node');if(node&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const n=node.dataset.n;if(S.sel===n)hop(n);else select(n)}});
  let rw,lw=innerWidth;addEventListener('resize',()=>{if(Math.abs(innerWidth-lw)<40)return;lw=innerWidth;clearTimeout(rw);rw=setTimeout(()=>{if(S.done)renderEnd(false);else drawWeb('none')},200)});
  start('daily',dayNo*7919+13);
}
})();
