/* Radical Drop: falling character parts that join into real characters */
(function(){
const root=document.getElementById('drop');if(!root)return;
const store={get(k,d){try{const v=localStorage.getItem('ziwang.drop.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('ziwang.drop.'+k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MARK={'̄':1,'́':2,'̌':3,'̀':4};
const tone=s=>{for(const ch of String(s).normalize('NFD'))if(MARK[ch])return MARK[ch];return 5};
const COLS=6,ROWS=10;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

root.innerHTML='<p class="g-loading">Loading…</p>';
fetch(root.dataset.pairs).then(r=>r.json()).then(init).catch(()=>{root.innerHTML='<p class="g-loading">The game didn’t load. Check your connection and refresh.</p>'});

function init(PAIRS){
  const ALL=PAIRS.map(([ch,t,a,b,py,def,lv])=>({ch,t,a,b,py,def,lv}));
  const H=new Map(),V=new Map();for(const o of ALL)(o.t==='h'?H:V).set(o.a+'|'+o.b,o);
  const LEVELS=[['all','All levels'],[1,'HSK 1'],[2,'HSK 1–2'],[3,'HSK 1–3'],[4,'HSK 1–4'],[5,'HSK 1–5'],[6,'HSK 1–6']];
  const levelName=l=>(LEVELS.find(x=>String(x[0])===String(l))||LEVELS[0])[1];
  let diff=store.get('level','all'),pool,byComp,COMMON;
  function setLevel(l){
    diff=l;store.set('level',l);const max=l==='all'?7:+l;
    const set=ALL.filter(o=>o.lv<=max);pool=[];byComp=new Map();const freq=new Map();
    for(const o of set){const wgt=l==='all'?[0,12,9,7,5,3,2,1][o.lv]:Math.max(1,4-(max-o.lv));for(let i=0;i<wgt;i++)pool.push(o);
      for(const k of [o.a,o.b]){freq.set(k,(freq.get(k)||0)+1);if(!byComp.has(k))byComp.set(k,[]);byComp.get(k).push(o)}}
    const ln=root.querySelector('#lvname');if(ln)ln.textContent=levelName(l);
    COMMON=[...freq.entries()].sort((x,y)=>y[1]-x[1]).slice(0,30).map(e=>e[0]);
  }
  setLevel(diff);
  const levelPicker=()=>`<div class="ov-level"><label for="dropLevel">Characters from</label><select id="dropLevel">${LEVELS.map(([k,n])=>`<option value="${k}"${String(k)===String(diff)?' selected':''}>${n}</option>`).join('')}</select></div>`;

  root.innerHTML=`
  <div class="drop">
    <div class="drop-stage">
      <div class="drop-board" id="board" style="--cols:${COLS};--rows:${ROWS}" aria-label="Game board" role="application">
        <div class="drop-grid" aria-hidden="true"></div>
        <div class="drop-ghost" id="ghost" aria-hidden="true"></div>
      </div>
      <div class="drop-overlay" id="overlay"></div>
    </div>
    <div class="drop-hud">
      <div class="drop-stats"><div><small>Score</small><b id="score">0</b></div><div><small>Speed</small><b id="level">1</b></div><div><small>Best</small><b id="best">0</b></div></div>
      <div class="drop-next"><small>Next</small><span id="next" class="cn" lang="zh-Hans"></span></div>
      <p class="drop-hint" id="hint" aria-live="polite"></p>
    </div>
    <aside class="drop-side">
      <div class="drop-made"><small>Characters you’ve built</small><ol id="made"></ol></div>
      <p class="drop-lv">Characters from <b id="lvname"></b></p>
      <label class="drop-toggle"><input type="checkbox" id="hintsOn" checked> Show hints</label>
    </aside>
    <div class="drop-controls" aria-label="Controls">
      <button class="btn" type="button" data-k="left" aria-label="Move left">◀</button>
      <button class="btn" type="button" data-k="down" aria-label="Move down">▼</button>
      <button class="btn" type="button" data-k="drop" aria-label="Drop">Drop</button>
      <button class="btn" type="button" data-k="right" aria-label="Move right">▶</button>
      <button class="btn" type="button" data-k="pause" aria-label="Pause">Ⅱ</button>
    </div>
  </div>`;
  root.querySelector('#lvname').textContent=levelName(diff);
  const board=root.querySelector('#board'),ghost=root.querySelector('#ghost'),overlay=root.querySelector('#overlay');
  const $s=id=>root.querySelector('#'+id);
  const hintsBox=$s('hintsOn');hintsBox.checked=store.get('hints',true);
  hintsBox.addEventListener('change',()=>{store.set('hints',hintsBox.checked);updateHint()});

  let grid,piece,queue,score,made,level,timer,state='idle',best=store.get('best',0),busy=false,bag=[];
  $s('best').textContent=best;

  function mkTile(ch,cls=''){const el=document.createElement('div');el.className='dtile '+cls;el.innerHTML=`<span lang="zh-Hans">${esc(ch)}</span>`;board.appendChild(el);return el}
  const place=(el,r,c)=>{el.style.transform=`translate(${c*100}%,${r*100}%)`};
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  function surface(){const s=[];for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++)if(grid[r][c]){s.push(grid[r][c].ch);break}return s}
  function refill(){while(queue.length<4){
    if(!bag.length){
      const surf=surface().filter(ch=>byComp.has(ch));
      if(surf.length&&Math.random()<.45){const ch=pick(surf);const opts=byComp.get(ch);const o=pick(opts.length?opts:byComp.get(ch));bag=[o.a===ch?o.b:o.a]}
      else{const o=pick(pool);bag=Math.random()<.5?[o.a,o.b]:[o.b,o.a];if(Math.random()<.15)bag.splice(Math.floor(Math.random()*3),0,pick(COMMON))}
    }
    queue.push(bag.shift())}}
  function speed(){return Math.max(170,820-(level-1)*70)}

  function reset(){
    board.querySelectorAll('.dtile,.dpop').forEach(e=>e.remove());
    grid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    queue=[];bag=[];score=0;made=[];level=1;piece=null;busy=false;
    $s('made').innerHTML='';updateStats();
  }
  function updateStats(){$s('score').textContent=score;$s('level').textContent=level;if(score>best){best=score;store.set('best',best)}$s('best').textContent=best}

  function spawn(){
    refill();const ch=queue.shift();refill();
    $s('next').textContent=queue[0];
    const c=Math.floor(COLS/2)-1;
    if(grid[0][c]){gameOver();return}
    piece={ch,r:0,c,el:mkTile(ch,'falling')};place(piece.el,0,c);
    updateGhost();updateHint();schedule();
  }
  function schedule(){clearTimeout(timer);if(state==='play')timer=setTimeout(()=>{stepDown();},speed())}
  const free=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS&&!grid[r][c];
  function landRow(c){let r=piece?piece.r:0;while(free(r+1,c))r++;return r}
  function move(dx){if(!piece||busy||state!=='play')return;if(free(piece.r,piece.c+dx)){piece.c+=dx;place(piece.el,piece.r,piece.c);updateGhost();updateHint()}}
  function stepDown(){if(!piece||busy||state!=='play')return;
    if(free(piece.r+1,piece.c)){piece.r++;place(piece.el,piece.r,piece.c);schedule()}else land()}
  function hardDrop(){if(!piece||busy||state!=='play')return;const r=landRow(piece.c);score+=2*(r-piece.r);piece.r=r;place(piece.el,r,piece.c);land()}
  function updateGhost(){if(!piece){ghost.hidden=true;return}ghost.hidden=false;place(ghost,landRow(piece.c),piece.c)}

  function matchesFor(ch,r,c){ // what would this piece form if it landed at r,c
    const out=[];const g=(rr,cc)=>rr>=0&&rr<ROWS&&cc>=0&&cc<COLS?grid[rr][cc]:null;
    const L=g(r,c-1),R=g(r,c+1),B=g(r+1,c);
    if(L&&H.has(L.ch+'|'+ch))out.push(H.get(L.ch+'|'+ch));
    if(R&&H.has(ch+'|'+R.ch))out.push(H.get(ch+'|'+R.ch));
    if(B&&V.has(ch+'|'+B.ch))out.push(V.get(ch+'|'+B.ch));
    return out}
  function updateHint(){
    const h=$s('hint');board.querySelectorAll('.dtile.glow').forEach(e=>e.classList.remove('glow'));
    if(!piece||!hintsBox.checked){h.textContent='';return}
    let found=null;
    for(let c=0;c<COLS&&!found;c++){if(!free(piece.r,c))continue;let r=piece.r;while(free(r+1,c))r++;const m=matchesFor(piece.ch,r,c);if(m.length)found={m:m[0],c}}
    if(found){const o=found.m;h.innerHTML=`<span class="cn" lang="zh-Hans">${esc(o.a)}</span> ${o.t==='h'?'next to':'on top of'} <span class="cn" lang="zh-Hans">${esc(o.b)}</span> makes <b class="cn" lang="zh-Hans">${esc(o.ch)}</b> <span class="t${tone(o.py)}">${esc(o.py)}</span>`;
      const other=o.a===piece.ch?o.b:o.a;for(const row of grid)for(const t of row)if(t&&t.ch===other)t.el.classList.add('glow')}
    else h.innerHTML=`No match for <span class="cn" lang="zh-Hans">${esc(piece.ch)}</span> yet. Park it somewhere useful.`;
  }

  function land(){
    clearTimeout(timer);const p=piece;piece=null;ghost.hidden=true;
    p.el.classList.remove('falling');grid[p.r][p.c]={ch:p.ch,el:p.el};
    busy=true;resolve(1);
  }
  function resolve(chain){
    const used=new Set(),found=[];
    for(let r=ROWS-1;r>=0;r--)for(let c=0;c<COLS;c++){
      const t=grid[r][c];if(!t||used.has(r+','+c))continue;
      const R=c+1<COLS?grid[r][c+1]:null;
      if(R&&!used.has(r+','+(c+1))&&H.has(t.ch+'|'+R.ch)){found.push({o:H.get(t.ch+'|'+R.ch),cells:[[r,c],[r,c+1]]});used.add(r+','+c);used.add(r+','+(c+1));continue}
      const Bt=r+1<ROWS?grid[r+1][c]:null;
      if(Bt&&!used.has((r+1)+','+c)&&V.has(t.ch+'|'+Bt.ch)){found.push({o:V.get(t.ch+'|'+Bt.ch),cells:[[r,c],[r+1,c]]});used.add(r+','+c);used.add((r+1)+','+c)}
    }
    if(!found.length){busy=false;if(state==='play')spawn();return}
    for(const f of found){
      const [[r1,c1],[r2,c2]]=f.cells;
      for(const [r,c] of f.cells){const t=grid[r][c];t.el.classList.add('merging');const el=t.el;setTimeout(()=>el.remove(),reduce?0:320);grid[r][c]=null}
      const pop=document.createElement('div');pop.className='dpop';
      pop.style.setProperty('--r',(r1+r2)/2);pop.style.setProperty('--c',(c1+c2)/2);
      pop.innerHTML=`<b lang="zh-Hans">${esc(f.o.ch)}</b><small class="t${tone(f.o.py)}">${esc(f.o.py)}</small>`;
      board.appendChild(pop);setTimeout(()=>pop.remove(),1500);
      const pts=(100+40*(Math.min(f.o.lv,5)-1))*chain;score+=pts;
      made.unshift(f.o);
      const li=document.createElement('li');li.innerHTML=`<a href="/zi/${encodeURIComponent(f.o.ch)}/" target="_blank" rel="noopener"><span class="cn" lang="zh-Hans">${esc(f.o.ch)}</span><span class="t${tone(f.o.py)}">${esc(f.o.py)}</span><small>${esc(f.o.def)}</small></a>`;
      const list=$s('made');list.prepend(li);while(list.children.length>8)list.lastChild.remove();
    }
    level=1+Math.floor(made.length/6);updateStats();
    setTimeout(()=>{gravity();setTimeout(()=>resolve(chain+1),reduce?0:200)},reduce?0:330);
  }
  function gravity(){for(let c=0;c<COLS;c++){let w=ROWS-1;for(let r=ROWS-1;r>=0;r--){const t=grid[r][c];if(t){if(r!==w){grid[w][c]=t;grid[r][c]=null;place(t.el,w,c)}w--}}}}

  function show(html){overlay.innerHTML=html;overlay.hidden=!html}
  function startGame(){reset();state='play';show('');spawn();board.focus({preventScroll:true});if(matchMedia('(max-width:720px)').matches)root.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});$s('lvname').textContent=levelName(diff)}
  function pause(){if(state==='play'){state='paused';clearTimeout(timer);show(`<div class="ov"><h2>Paused</h2><button class="btn primary" type="button" data-ov="resume">Resume</button></div>`)}
    else if(state==='paused'){state='play';show('');schedule()}}
  function gameOver(){
    state='over';clearTimeout(timer);updateStats();
    const uniq=[...new Map(made.map(o=>[o.ch,o])).values()];
    show(`<div class="ov"><h2>Board full</h2><p>Score <b>${score}</b>${score>=best&&score>0?' · new best':''}</p>
      ${uniq.length?`<p class="hint">You built ${made.length} character${made.length>1?'s':''}:</p><div class="ov-made">${uniq.slice(0,24).map(o=>`<a href="/zi/${encodeURIComponent(o.ch)}/" title="${esc(o.py)}: ${esc(o.def)}"><span class="cn" lang="zh-Hans">${esc(o.ch)}</span><small class="t${tone(o.py)}">${esc(o.py)}</small></a>`).join('')}</div>`:''}
      ${levelPicker()}<button class="btn primary" type="button" data-ov="start">Play again</button></div>`);
  }
  show(`<div class="ov"><h2>Radical Drop</h2>
    <p>Parts of characters fall one at a time. Put two parts <b>side by side</b> or <b>stack</b> them to build a real character and clear them.</p>
    <div class="ov-eg"><span class="cn" lang="zh-Hans">女</span>+<span class="cn" lang="zh-Hans">马</span>=<span class="cn" lang="zh-Hans">妈</span><span class="sep"></span><span class="stack"><span class="cn" lang="zh-Hans">艹</span><span class="cn" lang="zh-Hans">早</span></span>=<span class="cn" lang="zh-Hans">草</span></div>
    <p class="hint">Arrow keys or the buttons to move · Space to drop · P to pause</p>
    ${levelPicker()}<button class="btn primary" type="button" data-ov="start">Start</button></div>`);

  overlay.addEventListener('change',e=>{if(e.target.id==='dropLevel')setLevel(e.target.value==='all'?'all':+e.target.value)});
  overlay.addEventListener('click',e=>{const b=e.target.closest('[data-ov]');if(!b)return;if(b.dataset.ov==='start')startGame();else pause()});
  root.querySelector('.drop-controls').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;
    const k=b.dataset.k;if(k==='left')move(-1);else if(k==='right')move(1);else if(k==='down')stepDown();else if(k==='drop')hardDrop();else pause()});
  document.addEventListener('keydown',e=>{
    if(e.target.closest&&e.target.closest('input,textarea'))return;
    const k=e.key;
    if(state==='play'&&['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(k))e.preventDefault();
    if(k==='ArrowLeft')move(-1);else if(k==='ArrowRight')move(1);else if(k==='ArrowDown')stepDown();
    else if(k===' '||k==='ArrowUp')hardDrop();else if(k==='p'||k==='P')pause();
    else if(k==='Enter'&&(state==='idle'||state==='over'))startGame();
  });
  let sx=0,sy=0,st=0;
  board.addEventListener('touchstart',e=>{const t=e.touches[0];sx=t.clientX;sy=t.clientY;st=Date.now()},{passive:true});
  board.addEventListener('touchend',e=>{const t=e.changedTouches[0];const dx=t.clientX-sx,dy=t.clientY-sy;const cell=board.clientWidth/COLS;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>cell*.5){const n=Math.round(dx/cell);for(let i=0;i<Math.abs(n);i++)move(Math.sign(n))}
    else if(dy>cell)hardDrop();
    else if(Date.now()-st<250&&Math.abs(dx)<10&&Math.abs(dy)<10){const x=t.clientX-board.getBoundingClientRect().left;move(x<board.clientWidth/2?-1:1)}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause()});
  board.tabIndex=0;
}
})();
