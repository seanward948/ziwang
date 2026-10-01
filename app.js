/* Zìwǎng browser app */
(function(){
const cfg=window.ZIWANG_CONFIG||{};
const $=s=>document.querySelector(s);
const root=document.documentElement;
const store={get(k,d){try{const v=localStorage.getItem('ziwang.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('ziwang.'+k,JSON.stringify(v))}catch(e){}}};
const mode=document.body.dataset.mode||'list';

/* ---------- analytics: Cloudflare Web Analytics (cookieless, nothing personal stored) ---------- */
const cft=String(cfg.cfToken||'').trim();
if(/^[A-Za-z0-9]{20,64}$/.test(cft)){const s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon',JSON.stringify({token:cft,spa:true}));document.head.appendChild(s)}

/* ---------- Buy Me a Coffee ---------- */
const cu=String(cfg.coffeeUrl||'');
if(/^https:\/\/(www\.)?(buymeacoffee\.com|coff\.ee)\/[A-Za-z0-9_.-]+\/?$/.test(cu)&&!/yourname/i.test(cu)){
  document.querySelectorAll('[data-coffee]').forEach(a=>{a.href=cu;a.hidden=false;});
  document.querySelectorAll('.coffee-line').forEach(p=>p.hidden=false);
}

/* ---------- themes ---------- */
const SKINS=[
  ['auto','自动','Auto','Browser light/dark mode'],
  ['exercise','练习本','Exercise book','Light · green grid'],
  ['blackboard','黑板','Blackboard','Dark · chalk on slate'],
  ['porcelain','青花','Porcelain','Light · blue and white'],
  ['inkwash','水墨','Ink wash','Light · ink and red seal'],
  ['lantern','灯笼','Lantern','Dark · red and gold']];
let skin=store.get('skin','auto');
const themeMenu=$('#themes'),themeBtn=$('#themeBtn');
function paintThemeMeta(){const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=getComputedStyle(root).getPropertyValue('--paper').trim()}
function applySkin(s,user){skin=s;if(s==='auto')delete root.dataset.skin;else root.dataset.skin=s;store.set('skin',s);
  if(themeMenu)themeMenu.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-checked',b.dataset.skin===s));
  paintThemeMeta();document.dispatchEvent(new Event('skinchange'))}
if(themeMenu){
  themeMenu.innerHTML=SKINS.map(([k,zh,en,desc])=>`<button type="button" role="menuitemradio" data-skin="${k}" aria-checked="${k===skin}">
    <span class="sw sw-${k}" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="tn"><b>${en}</b><small>${desc}</small></span>
    <span class="tz cn" lang="zh-Hans" aria-hidden="true">${zh}</span></button>`).join('');
  themeBtn.addEventListener('click',e=>{e.stopPropagation();const open=themeMenu.hidden;themeMenu.hidden=!open;themeBtn.setAttribute('aria-expanded',open);if(open)themeMenu.querySelector('[aria-checked="true"]')?.focus()});
  themeMenu.addEventListener('click',e=>{const b=e.target.closest('[data-skin]');if(b){applySkin(b.dataset.skin,true);themeMenu.hidden=true;themeBtn.setAttribute('aria-expanded','false');themeBtn.focus()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!themeMenu.hidden){themeMenu.hidden=true;themeBtn.setAttribute('aria-expanded','false');themeBtn.focus()}});
  document.addEventListener('click',e=>{if(!e.target.closest('.themepick'))themeMenu.hidden=true});
}
applySkin(skin,false);
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{paintThemeMeta();document.dispatchEvent(new Event('skinchange'))})}catch(e){}

let tt;function toast(m){const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2800)}

/* ---------- data ---------- */
let core=null;
let readyP=null;
function getReady(){return readyP??=fetch('/assets/data.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>(core=makeCore(d)))}
// pages that need the dictionary straight away load it now; list pages wait until someone searches
const ready={then:(a,b)=>getReady().then(a,b),catch:f=>getReady().catch(f)};
if(mode!=='list')getReady().catch(()=>toast('The dictionary didn’t load. Check your connection and refresh.'));
if(mode!=='list')window.ZIWANG_READY=getReady();
/* extra (non-HSK) words load quietly after the page is ready */
let fullP=null;
function loadFull(){return fullP??=ready.then(c=>fetch('/assets/extra-words.tsv').then(r=>{if(!r.ok)throw 0;return r.text()}).then(tx=>{c.addWords(tx);document.dispatchEvent(new Event('ziwang-extra'));return c}).catch(()=>c))}
window.ZIWANG_LOAD_FULL=loadFull; // extra words load only when something asks for them

/* ---------- speech ---------- */
let zhVoice=null;
function pickVoice(){try{const v=speechSynthesis.getVoices();zhVoice=v.find(x=>/zh[-_]CN/i.test(x.lang))||v.find(x=>/^(zh|cmn)/i.test(x.lang)||/Chinese|Mandarin/i.test(x.name))||null}catch(e){}}
try{pickVoice();speechSynthesis.onvoiceschanged=pickVoice}catch(e){}
function speak(t){try{if(!('speechSynthesis' in window))throw 0;pickVoice();
  if(!zhVoice){toast('No Mandarin voice is installed in this browser, so audio is unavailable.');return}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.voice=zhVoice;u.lang=zhVoice.lang;u.rate=.8;speechSynthesis.speak(u);}
  catch(e){toast('Audio isn’t available in this browser.')}}

/* ---------- search ---------- */
/* rotating examples in the search box */
(function(){
  const box=document.getElementById('q');if(!box)return;
  const EX=['电','妈妈','ma3','shui','friend','学生','hao','tea','xue sheng','happy','朋友','ni3 hao3','cat','北京','zhong'];
  const base='Search ';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i=Math.floor(Math.random()*EX.length),t=null;
  const show=s=>{box.placeholder=base+s};
  const busy=()=>document.activeElement===box||box.value;
  function cycle(){
    const w=EX[i++%EX.length];const chars=[...w];
    if(reduce){show(w);t=setTimeout(cycle,3500);return}
    let n=0;
    (function type(){if(busy()){show(w);t=setTimeout(cycle,3000);return}
      show(chars.slice(0,++n).join('')+(n<chars.length?'':''));
      if(n<chars.length)t=setTimeout(type,110);else t=setTimeout(erase,2400)})();
    function erase(){if(busy()){t=setTimeout(cycle,3000);return}
      if(n>0){show(chars.slice(0,--n).join(''));t=setTimeout(erase,45)}else t=setTimeout(cycle,350)}
  }
  show('电, ma3 or “friend”');t=setTimeout(cycle,2500);
  document.addEventListener('visibilitychange',()=>{clearTimeout(t);if(!document.hidden)t=setTimeout(cycle,800)});
})();

const q=$('#q'),resBox=$('#results');let sel=-1;
function closeResults(){if(resBox)resBox.hidden=true}
function showResults(){
  const v=q.value;if(!v.trim()){closeResults();return}
  if(!core){resBox.innerHTML='<p class="empty">Loading the dictionary…</p>';resBox.hidden=false;ready.then(showResults);return}
  const r=core.search(v);sel=-1;resBox.innerHTML=core.resultsHTML(v,r);resBox.hidden=false;
}
function openWord(w){closeResults();const first=[...w].find(ch=>core&&core.CH[ch]);if(!first)return;
  if(explorer)explorer.go(first,{flashWord:w});else location.href=core.path(first)}
if(q){
  q.addEventListener('input',showResults);
  q.addEventListener('focus',()=>{getReady();loadFull();if(q.value.trim())showResults()},{passive:true});
  q.addEventListener('keydown',e=>{
    const rows=[...resBox.querySelectorAll('.rword')];
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!rows.length)return;sel=(sel+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows.forEach((r,i)=>r.classList.toggle('sel',i===sel));rows[sel].scrollIntoView({block:'nearest'})}
    else if(e.key==='Enter'){e.preventDefault();const v=q.value.trim();if(!core)return;
      if(sel>=0&&rows[sel])openWord(rows[sel].dataset.word);
      else{const han=[...v].filter(ch=>core.HAN.test(ch));
        if(han.length===1&&core.CH[han[0]])goChar(han[0]);
        else{const f=resBox.querySelector('[data-go],.rword');if(f)f.click()}}
      q.blur()}
    else if(e.key==='Escape'){closeResults();q.blur()}
  });
}
function goChar(c){closeResults();if(q)q.value='';if(explorer)explorer.go(c);else location.href=core.path(c)}

/* ---------- wander ---------- */
function wanderPool(){return Object.values(core.CH).filter(o=>o.lv<=3&&o.words.length>=3).map(o=>o.c)}
$('#wander')?.addEventListener('click',()=>ready.then(()=>{const p=wanderPool();let c;do{c=p[Math.floor(Math.random()*p.length)]}while(explorer&&c===explorer.cur()&&p.length>1);goChar(c)}));

/* ---------- games gallery previews ---------- */
(function(){
  const cards=document.querySelectorAll('.gcard .pv');if(!cards.length)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const touch=matchMedia('(hover: none)').matches;
  cards.forEach(pv=>{const card=pv.closest('.gcard');
    if(touch&&'IntersectionObserver' in window){new IntersectionObserver(es=>es.forEach(en=>pv.classList.toggle('play',en.isIntersecting)),{threshold:.6}).observe(pv)}
    else{card.addEventListener('mouseenter',()=>pv.classList.add('play'));card.addEventListener('mouseleave',()=>pv.classList.remove('play'));
      card.addEventListener('focus',()=>pv.classList.add('play'));card.addEventListener('blur',()=>pv.classList.remove('play'))}});
})();

/* ---------- global clicks ---------- */
let explorer=null;
document.addEventListener('click',e=>{
  if(!e.target.closest('.search'))closeResults();
  const t=e.target.closest('[data-go],[data-say],[data-word],[data-lv],[data-more],#clearTrail,.gl');
  if(!t)return;
  if(t.dataset.go){
    if(!explorer||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return; // normal link navigation
    e.preventDefault();closeResults();if(q)q.value='';
    explorer.go(t.dataset.go,{push:!t.dataset.nopush});
    if(t.closest('.lower,.card'))window.scrollTo({top:0,behavior:'smooth'});return}
  if(t.dataset.word){if(q)q.value='';if(core)openWord(t.dataset.word);return}
  if(explorer)explorer.click(t,e);
});

/* ---------- explorer (home + character pages) ---------- */
if(mode==='home'||mode==='char')ready.then(()=>{explorer=makeExplorer()});

function makeExplorer(){
  const C=core,{CH,WORDS,esc,sylTone,pyHTML,LVNAME,charPy}=C;
  let cur=null;
  let maxLv=store.get('maxLv',7),quiz=store.get('quiz',false),toneChars=store.get('toneChars',false),trail=store.get('trail',[]);
  const openLv=new Set();
  const homeTitle=document.title,homeDesc=document.querySelector('meta[name="description"]')?.content||'';

  /* writer */
  let writer=null;
  const cssv=n=>getComputedStyle(root).getPropertyValue(n).trim();
  const strokeCache={};
  function loadStroke(c){const hex=c.codePointAt(0).toString(16);
    strokeCache[hex]??=fetch(`/s/${hex}.json`).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).catch(e=>{delete strokeCache[hex];throw e});
    return strokeCache[hex]}
  function makeWriter(c){
    const host=$('#writer');if(!host)return;host.innerHTML='';writer=null;const fb=$('#fallback');
    if(!window.HanziWriter){fb.hidden=false;return}
    const size=host.clientWidth||240;
    writer=HanziWriter.create(host,c,{width:size,height:size,padding:size*.06,showOutline:true,
      strokeColor:cssv('--ink'),outlineColor:cssv('--grid-soft'),radicalColor:cssv('--accent'),highlightColor:cssv('--t2'),drawingColor:cssv('--t4'),
      strokeAnimationSpeed:1.1,delayBetweenStrokes:140,showHintAfterMisses:2,
      charDataLoader:(ch,ok,err)=>loadStroke(ch).then(d=>{fb.hidden=true;ok(d)}).catch(e=>{fb.hidden=false;err(e)})});
  }
  document.addEventListener('skinchange',()=>{if(cur)makeWriter(cur)});

  let firstPaint=true; // the page arrives with this character already rendered, so keep what's on screen
  function renderCard(){
    const card=$('#card');const oldTzg=card.querySelector('.tzg');const keep=firstPaint&&$('#fallback')&&$('#fallback').textContent===cur;
    if(!(firstPaint&&mode==='char'&&$('#anim'))){card.innerHTML=C.cardHTML(cur);if(keep&&oldTzg){const t=card.querySelector('.tzg');t.replaceWith(oldTzg);if(!oldTzg.querySelector('#writer')){const w=document.createElement('div');w.id='writer';oldTzg.appendChild(w)}}}
    makeWriter(cur);
    $('#anim').onclick=()=>{if(writer){writer.cancelQuiz?.();writer.showCharacter();writer.animateCharacter();}};
    $('#practice').onclick=()=>{if(!writer)return;toast('Trace each stroke in order. A hint appears after 2 misses.');
      writer.quiz({onComplete:s=>{toast(s.totalMistakes?`Finished with ${s.totalMistakes} miss${s.totalMistakes>1?'es':''}.`:'Perfect. No misses.');}})};
    $('#say').onclick=()=>speak(cur);
  }
  function renderWords(){
    const r=C.wordsHTML(cur,{maxLv,toneChars,openLv});
    $('#wtitle').innerHTML=r.title;$('#lvbar').innerHTML=r.bar;$('#wlist').innerHTML=r.body;
    $('#wordsPanel').classList.toggle('quiz',quiz);$('#quizbtn').classList.toggle('on',quiz);$('#quizbtn').setAttribute('aria-pressed',quiz);
  }
  function renderFam(){$('#fam').innerHTML=C.famHTML(cur,{maxLv})}
  function renderTrail(){
    const t=$('#trail');
    t.innerHTML=`<span class="lab">Trail</span>`+trail.map((c,i)=>`${i?'<span class="arr" aria-hidden="true">›</span>':''}<a class="step${c===cur?' cur':''}" href="${C.path(c)}" data-go="${esc(c)}" data-nopush="1" lang="zh-Hans"${c===cur?' aria-current="page"':''}>${esc(c)}</a>`).join('')+
      (trail.length>1?`<button type="button" class="linkbtn" id="clearTrail">Clear</button>`:'');
    t.scrollLeft=t.scrollWidth;
  }

  /* graph */
  const NS='http://www.w3.org/2000/svg';
  function el(tag,attrs={},parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
  function renderGraph(){
    const svg=$('#graph');svg.innerHTML='';const cb=$('#ctxBtn');if(cb)cb.href='/map/?q='+encodeURIComponent(cur);const nl=document.querySelector('.netlink');if(nl)nl.href='/map/?q='+encodeURIComponent(cur);
    const c=cur,o=CH[c];
    const W=svg.clientWidth||svg.parentNode.clientWidth||700;
    const narrow=W<560;
    const H=narrow?Math.round(W*1.25):Math.max(460,Math.min(620,Math.round(W*.68)));
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.style.height=H+'px';
    const cx=W/2,cy=H/2-(narrow?26:24);
    let ring=[],kidMode=false;
    if(o){ring=o.words.map(i=>WORDS[i]).filter(w=>w.w!==c&&w.lv<=maxLv).slice(0,narrow?8:12);
      const rest=w=>[...w.w].filter(x=>x!==c).join('')||'~';ring.sort((a,b)=>rest(a).localeCompare(rest(b),'zh'))}
    if(!ring.length&&o&&o.kids.length){kidMode=true;ring=o.kids.slice(0,narrow?10:14).map(k=>({w:k,py:charPy(k),gl:CH[k].def,lv:CH[k].lv,syl:[charPy(k)],kid:true}))}
    $('#gtitle').innerHTML=kidMode?`Characters that contain ${C.zh(c)}`:`Words built with ${C.zh(c)}`;
    const n=ring.length;
    const rx1=W*(narrow?.3:.25),ry1=H*(narrow?.24:.26),rx2=W*.43,ry2=H*.37;
    const gl=el('g',{},svg),gn=el('g',{},svg);
    const outer=new Map();
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const place=(g,x,y,delay)=>{g.classList.add('moving');g.style.transform=`translate(${cx}px,${cy}px)`;g.style.opacity=0;g.style.transitionDelay=delay+'ms';
      requestAnimationFrame(()=>requestAnimationFrame(()=>{g.style.transform=`translate(${x}px,${y}px)`;g.style.opacity=1}))};
    const lineEls=[];
    const caption=$('#caption');
    ring.forEach((w,i)=>{
      const a=-Math.PI/2+i*2*Math.PI/Math.max(n,1);
      const x=cx+rx1*Math.cos(a),y=cy+ry1*Math.sin(a);
      const L=el('line',{x1:cx,y1:cy,x2:x,y2:y,class:'gline fade'},gl);lineEls.push(L);
      const others=w.kid?[]:[...new Set(w.w)].filter(ch=>ch!==c&&CH[ch]);
      const spread=Math.min(.17,(2*Math.PI/Math.max(n,1))/(others.length+.6));
      const outs=[];
      others.forEach((ch,j)=>{
        let p=outer.get(ch);if(!p){p={sx:0,sy:0,ch,lines:[]};outer.set(ch,p)}
        const b=a+(j-(others.length-1)/2)*spread;p.sx+=Math.cos(b);p.sy+=Math.sin(b);
        const L2=el('line',{x1:x,y1:y,class:'gline out fade'},gl);lineEls.push(L2);outs.push(L2);p.lines.push(L2);
      });
      const g=el('g',{class:'gnode gword',tabindex:0,role:'button'},gn);el('title',{},g).textContent=`${w.w} ${w.py}: ${w.gl}`;
      const fs=narrow?18:21;const tw=Math.max([...w.w].length*fs+18,50);
      el('rect',{class:'bg',x:-tw/2,y:-22,width:tw,height:44,rx:10},g);
      const t=el('text',{class:'w','text-anchor':'middle',y:3,'font-size':fs},g);
      C.colorWord(w.w,w.kid?null:w,toneChars).forEach(({ch,cls})=>{const s=el('tspan',{},t);s.textContent=ch;if(ch===c)s.setAttribute('font-weight','600');if(cls)s.setAttribute('class',cls)});
      const pt=el('text',{class:'p','text-anchor':'middle',y:17},g);
      w.py.split(' ').forEach((s,k)=>{const sp=el('tspan',{class:'t'+sylTone(s)},pt);sp.textContent=(k?' ':'')+s});
      const show=()=>{L.classList.add('hi');outs.forEach(l=>l.classList.add('hi'));
        caption.innerHTML=`${C.zh(w.w)}<span>${pyHTML(w.py)}</span><span class="gl">${esc(w.gl)}</span><span class="pill lv">${LVNAME(w.lv)}</span>`};
      const hide=()=>{L.classList.remove('hi');outs.forEach(l=>l.classList.remove('hi'))};
      g.addEventListener('mouseenter',show);g.addEventListener('mouseleave',hide);g.addEventListener('focus',show);g.addEventListener('blur',hide);
      const act=()=>{show();if(w.kid)go(w.w);else speak(w.w)};
      g.addEventListener('click',act);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act()}});
      place(g,x,y,reduce?0:60+i*35);
    });
    const os=[...outer.values()];os.forEach(p=>p.b=Math.atan2(p.sy,p.sx));os.sort((u,v)=>u.b-v.b);
    const minGap=Math.min(.2,2*Math.PI/Math.max(os.length,1)*.9);
    for(let it=0;it<30&&os.length>1;it++){let moved=false;for(let i=0;i<os.length;i++){const u=os[i],v=os[(i+1)%os.length];let d=v.b-u.b;if(i===os.length-1)d+=2*Math.PI;if(d<minGap){const s=(minGap-d)/2;u.b-=s;v.b+=s;moved=true}}if(!moved)break}
    for(const p of os){const b=p.b;p.x=cx+rx2*Math.cos(b);p.y=cy+ry2*Math.sin(b);p.lines.forEach(l=>{l.setAttribute('x2',p.x);l.setAttribute('y2',p.y)})}
    let k=0;
    for(const p of outer.values()){
      const a=el('a',{class:'gnode gchar',href:C.path(p.ch),'aria-label':`Explore ${p.ch}`},gn);
      a.dataset.go=p.ch;
      el('circle',{class:'bg',r:narrow?17:20},a);
      const t=el('text',{class:'c','text-anchor':'middle',y:narrow?6:7,'font-size':narrow?18:21},a);t.textContent=p.ch;
      a.addEventListener('mouseenter',()=>{caption.innerHTML=`${C.zh(p.ch)}<span>${pyHTML(charPy(p.ch))}</span><span class="gl">${esc(C.charDef(p.ch))}</span><span class="hint">tap to explore</span>`});
      place(a,p.x,p.y,reduce?0:260+k*18);k++;
    }
    const g=el('g',{class:'gnode gcenter',tabindex:0,role:'button','aria-label':`Hear ${c}`},gn);
    el('circle',{class:'bg',r:narrow?40:48},g);
    el('circle',{r:narrow?46:55,fill:'none',stroke:'var(--grid-soft)','stroke-width':1,'stroke-dasharray':'2 4'},g);
    const ct=el('text',{class:'c','text-anchor':'middle',y:narrow?15:18,'font-size':narrow?44:54},g);ct.textContent=c;
    const cp=charPy(c);if(toneChars&&cp)ct.setAttribute('class','c t'+sylTone(cp));
    g.style.transform=`translate(${cx}px,${cy}px)`;
    g.addEventListener('click',()=>speak(c));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();speak(c)}});
    lineEls.forEach(l=>l.style.opacity=0);requestAnimationFrame(()=>requestAnimationFrame(()=>lineEls.forEach(l=>l.style.opacity=1)));
    if(!n){const t=el('text',{x:cx,y:cy+90,'text-anchor':'middle','font-size':14,fill:'var(--ink-3)',style:'font-family:var(--ui)'},svg);t.textContent=`No words at ${LVNAME(maxLv)} or below. Raise the level to see more.`}
    caption.innerHTML=n?`<span class="hint">${kidMode?'Tap a character to explore it.':'Tap a word to hear it.'} Tap an outer character to travel there.</span>`:'<span class="hint">Try another character, or raise the HSK level below.</span>';
  }

  function setMeta(c){
    const m=C.metaFor(c);document.title=m.title;
    const d=document.querySelector('meta[name="description"]');if(d)d.content=m.desc;
    const l=document.querySelector('link[rel="canonical"]');if(l)l.href='https://ziwang.app'+C.path(c);
  }
  function go(c,{push=true,hist=true,flashWord=null}={}){
    if(!c||!CH[c])return;
    const first=cur===null;cur=c;
    if(push){trail=trail.filter(x=>x!==c);trail.push(c);trail=trail.slice(-24);store.set('trail',trail)}
    if(hist){setMeta(c);const p=C.path(c);if(decodeURIComponent(location.pathname)!==decodeURIComponent(p))history.pushState({c},'',p)}
    const fresh=firstPaint&&mode==='char'&&maxLv===7&&!toneChars;
    renderCard();renderGraph();if(!fresh){renderWords();renderFam()}else{$('#wordsPanel').classList.toggle('quiz',quiz);$('#quizbtn').classList.toggle('on',quiz)}renderTrail();firstPaint=false;
    
    if(flashWord){const r=document.querySelector(`.wrow[data-w="${CSS.escape(flashWord)}"]`);if(r){r.scrollIntoView({block:'center',behavior:'smooth'});r.classList.add('flash')}}
  }
  function click(t){
    if(t.id==='clearTrail'){trail=[cur];store.set('trail',trail);renderTrail();return}
    if(t.dataset.say){speak(t.dataset.say);return}
    if(t.dataset.lv){maxLv=+t.dataset.lv;store.set('maxLv',maxLv);renderGraph();renderWords();renderFam();if(maxLv===8)loadFull().then(()=>{renderGraph();renderWords()});return}
    if(t.dataset.more){const k=cur+t.dataset.more;openLv.has(k)?openLv.delete(k):openLv.add(k);renderWords();return}
    if(t.classList.contains('gl')&&t.closest('.quiz'))t.classList.toggle('shown');
  }
  $('#quizbtn').onclick=()=>{quiz=!quiz;store.set('quiz',quiz);renderWords();};
  const tb=$('#tonechars');tb.classList.toggle('on',toneChars);tb.setAttribute('aria-pressed',toneChars);
  tb.onclick=()=>{toneChars=!toneChars;store.set('toneChars',toneChars);tb.classList.toggle('on',toneChars);tb.setAttribute('aria-pressed',toneChars);renderGraph();renderWords()};
  addEventListener('popstate',e=>{
    const m=decodeURIComponent(location.pathname).match(/^\/zi\/(.+?)\/?$/);
    const c=(e.state&&e.state.c)||(m&&m[1]);
    if(c&&CH[c])go(c,{push:false,hist:false}),setMeta(c);
    else if(location.pathname==='/'){document.title=homeTitle;const d=document.querySelector('meta[name="description"]');if(d)d.content=homeDesc;if(window.__start)go(window.__start,{push:false,hist:false})}
  });
  let lastW=innerWidth,rw;addEventListener('resize',()=>{if(Math.abs(innerWidth-lastW)<40)return;lastW=innerWidth;clearTimeout(rw);rw=setTimeout(()=>{renderGraph();makeWriter(cur)},200)});

  document.addEventListener('ziwang-extra',()=>{if(cur&&maxLv===8){renderGraph();renderWords()}const qq=$('#q');if(qq&&qq.value.trim()&&!$('#results').hidden)qq.dispatchEvent(new Event('input'))});
  /* start */
  let start=null,hist=false;
  if(mode==='char')start=document.body.dataset.char;
  const h=location.hash.match(/^#u([0-9a-f]{4,5})$/i);
  if(h){const ch=String.fromCodePoint(parseInt(h[1],16));if(CH[ch]){start=ch;hist=true;history.replaceState(null,'',C.path(ch))}}
  if(!start){start=window.__start;if(!start||!CH[start]){const p=Object.values(CH).filter(o=>o.lv===1&&o.words.length>=2).map(o=>o.c);start=p[Math.floor(Math.random()*p.length)]}}
  go(start,{hist:false,push:true});if(hist)setMeta(start);
  if(mode==='char')history.replaceState({c:start},'');
  return {go,click,cur:()=>cur};
}
})();
