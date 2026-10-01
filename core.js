/* Zìwǎng core: pure data + HTML-string rendering. Runs in the browser and at build time (Node). */
function makeCore(DATA){
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LVNAME=l=>l>=8?'Beyond HSK':l>=7?'HSK 7–9':'HSK '+l;
const LVSLUG=l=>l>=7?'7-9':String(l);
const HAN=/[\u3400-\u9fff\u2e80-\u2fdf\u31c0-\u31ef]/;
const zh=(s,cls='cn')=>`<span class="${cls}" lang="zh-Hans">${esc(s)}</span>`;
const path=c=>'/zi/'+encodeURIComponent(c)+'/';

/* pinyin */
const MARK={'\u0304':1,'\u0301':2,'\u030c':3,'\u0300':4};
function sylTone(s){for(const ch of String(s).normalize('NFD'))if(MARK[ch])return MARK[ch];return 5}
function sylPlain(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
const pyHTML=py=>py.split(' ').map(s=>`<span class="t${sylTone(s)}">${esc(s)}</span>`).join(' ');
const pyHTMLJoined=py=>py.split(' ').map(s=>`<span class="t${sylTone(s)}">${esc(s)}</span>`).join('');

/* data */
function parseWord(l,i){const [w,py,gl,lv,fb]=l.split('\t');
  return {i,w,py,gl,lv:+lv,fb:+(fb||0),syl:py.split(' ')}}
let indexed=0; // search keys are built the first time someone searches
function ensureIndex(){for(;indexed<WORDS.length;indexed++){const w=WORDS[indexed];const plain=w.syl.map(sylPlain);
  w.key=plain.join('').replace(/ü/g,'v');w.nkey=plain.map((p,k)=>p.replace(/ü/g,'v')+sylTone(w.syl[k])).join('');w.glLow=w.gl.toLowerCase()}}
const WORDS=DATA.w.split('\n').map(parseWord);
const WORDMAP=new Map(WORDS.map(w=>[w.w,w]));
const CH={};
for(const [c,a] of Object.entries(DATA.c))CH[c]={c,py:a[0]?a[0].split(','):[],def:a[1],parts:[...a[2]],rad:a[3],type:a[4],hint:a[5],ph:a[6],se:a[7],strokes:a[8]||0,rank:a[9]||0,rc:a[10]||'',words:[],kids:[],lv:99};
for(const w of WORDS)for(const c of new Set(w.w)){const o=CH[c];if(o){o.words.push(w.i);if(w.lv<o.lv)o.lv=w.lv}}
let extraLoaded=false;
function addWords(tsv){if(extraLoaded)return;extraLoaded=true;for(const l of tsv.split('\n')){if(!l)continue;const w=parseWord(l,WORDS.length);if(WORDMAP.has(w.w))continue;WORDS.push(w);WORDMAP.set(w.w,w);for(const c of new Set(w.w)){const o=CH[c];if(o)o.words.push(w.i)}}}
const hskCount=o=>o.words.reduce((n,i)=>n+(WORDS[i].lv<=7),0);
for(const o of Object.values(CH))for(const p of o.parts)if(CH[p])CH[p].kids.push(o.c);
const byLv=(a,b)=>CH[a].lv-CH[b].lv||CH[b].words.length-CH[a].words.length;
for(const o of Object.values(CH))o.kids.sort(byLv);
const phonFam={},semFam={};
for(const o of Object.values(CH)){if(o.lv>7)continue;if(o.ph)(phonFam[o.ph]??=[]).push(o.c);if(o.se)(semFam[o.se]??=[]).push(o.c)}
function charPy(c){const o=CH[c];if(!o)return '';const w=WORDMAP.get(c);if(w&&w.syl.length===1)return w.py.toLowerCase();return o.py[0]||''}
function charDef(c){const o=CH[c];const w=WORDMAP.get(c);if(w&&w.syl.length===1)return w.gl;return o?o.def:''}
function readings(c){const o=CH[c];if(!o)return [];const w=WORDMAP.get(c);
  const first=(w&&w.syl.length===1)?w.py.toLowerCase():null;return first?[first,...o.py.filter(p=>p.toLowerCase()!==first)]:o.py}

/* frequency */
const FREQ=['','Rare','Less common','Fairly common','Common','Very common'];
const meter=(b,extra='')=>b?`<span class="freq f${b}" role="img" title="${FREQ[b]}${extra}" aria-label="${FREQ[b]}${extra}"><i></i><i></i><i></i><i></i><i></i></span>`:'';
const rankBand=r=>!r?0:r<=100?5:r<=500?4:r<=1500?3:r<=3000?2:1;

/* shared bits */
function charLink(c,cls='chip'){const o=CH[c];const p=o?charPy(c):'';
  return `<a class="${cls}" href="${path(c)}" data-go="${esc(c)}" title="${esc(charDef(c))}">${zh(c)}${p?`<small class="t${sylTone(p)}">${esc(p)}</small>`:''}</a>`}
function colorWord(w,wordObj,toneChars){
  return [...w].map((ch,k)=>({ch,cls:toneChars&&wordObj&&wordObj.syl.length===[...w].length?'t'+sylTone(wordObj.syl[k]):''}))}
const SPK='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const TYPE={pictographic:'Pictograph',ideographic:'Ideograph',pictophonetic:'Sound + meaning'};
/* what a part does in a character: Dong Chinese where it covers the part, otherwise Make Me a Hanzi */
const RC={m:'meaning',s:'sound',p:'picture',o:'other'};
function roleOf(o,p){const i=o.parts.indexOf(p),k=i>=0?o.rc[i]:'';if(k&&k!=='-')return RC[k];return p===o.ph?'sound':p===o.se?'meaning':'other'}

/* card */
function cardHTML(c){
  const o=CH[c]||{c,py:[],def:'',parts:[],words:[],kids:[],lv:99,strokes:0};
  const pys=readings(c),def=charDef(c);
  const parts=o.parts.map(p=>{const po=CH[p];
    const r=roleOf(o,p),role=r==='other'?'':`<span class="role ${r}">${r}</span>`;
    return `<a class="part" href="${path(p)}" data-go="${esc(p)}"><span class="g" lang="zh-Hans">${esc(p)}</span><span class="m">${role}<b>${po&&po.py[0]?pyHTML(po.py[0]):'&nbsp;'}</b><small>${esc(po&&po.def?po.def:'component')}</small></span></a>`}).join('');
  let story='';
  // a short hint is a gloss of the meaning part, so it reads as part of the sound/meaning sentence
  if((o.ph||o.se)&&(o.type==='pictophonetic'||!o.hint||o.hint.split(' ').length<4)){
    const sp=o.ph&&CH[o.ph]?CH[o.ph].py[0]:'';
    story=(o.se?`${zh(o.se)} hints at the meaning${o.hint?` (${esc(o.hint)})`:''}`:'')+(o.se&&o.ph?', and ':'')+
      (o.ph?`${zh(o.ph)}${sp?` <span class="t${sylTone(sp)}">${esc(sp)}</span>`:''} hints at the sound`:'')+'.';
  }else if(o.hint){story=esc(o.hint).replace(/([\u3400-\u9fff])/g,'<span class="cn" lang="zh-Hans">$1</span>')+'.'}
  return `
    <div class="tzg">
      <svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 50H100M50 0V100" stroke="var(--grid)" stroke-width=".6" stroke-dasharray="2.2 2" fill="none"/>
        <path d="M0 0L100 100M100 0L0 100" stroke="var(--grid-soft)" stroke-width=".5" stroke-dasharray="1.6 2" fill="none"/>
      </svg>
      <div class="fallback" id="fallback" lang="zh-Hans" aria-hidden="true">${esc(c)}</div>
      <div id="writer" role="img" aria-label="Stroke order animation for ${esc(c)}"></div>
    </div>
    <div class="ctrl">
      <button class="btn" id="anim" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>Strokes</button>
      <button class="btn" id="practice" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>Write it</button>
      <button class="btn" id="say" type="button">${SPK}Listen</button>
    </div>
    <div class="head">
      <h1 class="ctitle">${zh(c,'cn hc')} <span class="py">${pys.length?pys.map(pyHTML).join('<span class="sep"> · </span>'):''}</span></h1>
      <p class="def">${esc(def||'')}</p>
    </div>
    <div class="facts">
      ${o.lv<=7?`<a class="pill lv" href="/hsk/${LVSLUG(o.lv)}/">${LVNAME(o.lv)}</a>`:'<span class="pill">Component</span>'}
      ${o.strokes?`<span class="pill">${o.strokes} stroke${o.strokes>1?'s':''}</span>`:''}
      ${o.rad&&o.rad!==c?`<span class="pill">Radical ${zh(o.rad)}</span>`:''}
      ${o.type?`<span class="pill">${TYPE[o.type]||esc(o.type)}</span>`:''}
      ${o.rank?`<span class="pill freqpill" title="Rank among the most-used characters in written Chinese">#${o.rank.toLocaleString('en-US')} most used ${meter(rankBand(o.rank))}</span>`:''}
      <span class="pill">${hskCount(o)} HSK word${hskCount(o)===1?'':'s'}</span>
    </div>
    ${o.parts.length?`<div class="sect"><h2>Built from ${partsLink(c)}</h2><div class="parts">${parts}</div></div>`:''}
    ${story?`<div class="sect"><h2>How it works</h2><p class="story">${story}</p></div>`:''}`;
}

const partsLink=c=>`<a class="sect-link" rel="nofollow" href="/map/?q=${encodeURIComponent(c)}&amp;links=parts">Parts network</a>`;

/* words */
function wordsHTML(c,{maxLv=7,toneChars=false,openLv=new Set()}={}){
  const o=CH[c];
  const bar='<span>Show up to</span>'+[1,2,3,4,5,6,7,8].map(l=>`<button type="button" data-lv="${l}" class="${l===maxLv?'on':''}" aria-pressed="${l===maxLv}"${l===8?' title="Add common words that aren’t on the HSK lists"':''}>${l===8?'+ more':l===7?'7–9':l}</button>`).join('');
  const list=o?o.words.map(i=>WORDS[i]).filter(w=>w.lv<=maxLv):[];
  let body;
  if(!list.length){body=`<p class="empty">${o&&o.words.length?`No words at ${LVNAME(maxLv)} or below.`:`${zh(c)} doesn’t appear in any HSK word on its own. It works as a building block inside other characters.`}</p>`}
  else{
    const groups={};list.forEach(w=>(groups[w.lv]??=[]).push(w));
    body=Object.keys(groups).sort((a,b)=>a-b).map(lv=>{
      const g=groups[lv],open=openLv.has(c+lv),LIM=10,shown=open?g:g.slice(0,LIM);
      return `<div class="lvgroup"><h3>${LVNAME(+lv)} · ${g.length}</h3>${shown.map(w=>{
        const cw=colorWord(w.w,w,toneChars);
        return `<div class="wrow" data-w="${esc(w.w)}"><div class="w" lang="zh-Hans">${cw.map(({ch,cls})=>CH[ch]&&ch!==c?`<a href="${path(ch)}" data-go="${esc(ch)}" class="${cls}">${esc(ch)}</a>`:`<span class="me ${cls}">${esc(ch)}</span>`).join('')}</div>
        <div class="py">${pyHTMLJoined(w.py)}</div><div class="gl">${esc(w.gl)}</div>${meter(w.fb)||'<span class="freq"></span>'}
        <span class="wact"><a class="ico ctx" rel="nofollow" href="/map/?q=${encodeURIComponent(w.w)}" title="Full network map" aria-label="Show ${esc(w.w)} on the full network map"></a><button type="button" class="ico spk" data-say="${esc(w.w)}" title="Listen" aria-label="Hear ${esc(w.w)}"></button></span></div>`}).join('')}
        ${g.length>LIM?`<button type="button" class="linkbtn more" data-more="${lv}">${open?'Show fewer':`Show all ${g.length}`}</button>`:''}</div>`}).join('');
  }
  return {title:`Words with ${zh(c)}`,bar,body};
}

/* families */
function famHTML(c,{maxLv=7}={}){
  const o=CH[c];const secs=[];
  if(o){
    const kids=o.kids.filter(k=>CH[k].lv<=maxLv).slice(0,30);
    if(kids.length)secs.push(`<div class="sect"><h2>Found inside ${partsLink(c)}</h2><div class="chips">${kids.map(k=>charLink(k)).join('')}</div></div>`);
    if(o.ph){const f=(phonFam[o.ph]||[]).filter(x=>x!==c&&CH[x].lv<=maxLv).sort(byLv).slice(0,24);
      if(f.length)secs.push(`<div class="sect"><h2>Sound family · ${zh(o.ph)}</h2><p class="why">Same sound part${CH[o.ph]&&CH[o.ph].py[0]?`, ${esc(CH[o.ph].py[0])}`:''}.</p><div class="chips">${f.map(k=>charLink(k)).join('')}</div></div>`)}
    const sk=o.se||(o.rad&&o.rad!==c?o.rad:'');
    if(sk){const f=(semFam[sk]||Object.values(CH).filter(x=>x.rad===sk&&x.lv<=7).map(x=>x.c)).filter(x=>x!==c&&CH[x].lv<=maxLv).sort(byLv).slice(0,24);
      if(f.length)secs.push(`<div class="sect"><h2>Meaning family · ${zh(sk)}</h2><p class="why">Same meaning part${CH[sk]?`, “${esc((CH[sk].def||'').split(/[;,]/)[0])}”`:''}.</p><div class="chips">${f.map(k=>charLink(k)).join('')}</div></div>`)}
  }
  if(!secs.length)secs.push(`<p class="empty">No close relatives found at this level. Try raising the HSK level.</p>`);
  return secs.join('');
}

/* page meta */
function metaFor(c){
  const o=CH[c];const py=readings(c).slice(0,2).join(', ');
  const def=(charDef(c)||'').replace(/\s+/g,' ');
  const top=o?o.words.map(i=>WORDS[i]).filter(w=>w.w!==c).slice(0,3).map(w=>w.w):[];
  const title=`${c} (${py||'component'}): meaning, stroke order & words | Zìwǎng`;
  let desc=`${c} ${py?`(${py}) `:''}means “${def.split(';').slice(0,2).join(';').trim()}”. `+
    (o&&o.lv<=7?`${LVNAME(o.lv)}. `:'')+
    `See its stroke order${o&&o.parts.length?`, parts (${o.parts.join(' + ')})`:''}`+
    (o&&hskCount(o)?` and ${hskCount(o)} HSK words that use it${top.length?`, like ${top.join(', ')}`:''}.`:'.');
  if(desc.length>150)desc=[...desc].slice(0,147).join('').replace(/[\s,;(]+\S*$/,'')+'…';
  return {title,desc};
}

/* search */
function search(q){
  q=q.trim();if(!q)return null;ensureIndex();
  const chars=[],words=[];
  if(HAN.test(q)){
    for(const ch of new Set([...q].filter(ch=>HAN.test(ch))))if(CH[ch])chars.push(ch);
    for(const w of WORDS){if(w.w.includes(q))words.push(w);if(words.length>=40)break}
    words.sort((a,b)=>(b.w===q)-(a.w===q)||a.lv-b.lv||a.w.length-b.w.length);
  }else{
    const ql=q.toLowerCase();
    const plain=ql.replace(/[\s']/g,'').replace(/u:/g,'v').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ü/g,'v');
    if(/^([a-z]+[1-5]?)+$/.test(plain)){
      const numeric=/\d/.test(plain);
      const m=WORDS.filter(w=>numeric?w.nkey.startsWith(plain):w.key.startsWith(plain));
      m.sort((a,b)=>((b.key===plain)||(b.nkey===plain))-((a.key===plain)||(a.nkey===plain))||a.w.length-b.w.length||a.lv-b.lv);
      words.push(...m.slice(0,25));
      const cs=Object.values(CH).filter(o=>o.lv<=7&&o.py.some(p=>{const pl=sylPlain(p).replace(/ü/g,'v');return numeric?pl+sylTone(p)===plain:pl===plain}));
      cs.sort((a,b)=>a.lv-b.lv);chars.push(...cs.slice(0,24).map(o=>o.c));
    }
    if(ql.length>=2&&!/\d/.test(ql)){
      const re=new RegExp('(^|[^a-z])'+ql.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z])');
      const en=WORDS.filter(w=>re.test(w.glLow)&&!words.includes(w));
      en.sort((a,b)=>(a.glLow.indexOf(ql)>0)-(b.glLow.indexOf(ql)>0)||a.lv-b.lv||a.w.length-b.w.length);
      words.push(...en.slice(0,25));
      if(!chars.length)chars.push(...Object.values(CH).filter(o=>o.lv<=7&&re.test(o.def.toLowerCase())).sort((a,b)=>a.lv-b.lv).slice(0,16).map(o=>o.c));
    }
  }
  return {chars,words:words.slice(0,30)};
}
function resultsHTML(q,r){
  return (r.chars.length?`<h4>Characters</h4><div class="rchars">${r.chars.map(c=>charLink(c)).join('')}</div>`:'')+
    (r.words.length?`<h4>Words</h4>${r.words.map((w,i)=>`<button type="button" class="rword" data-word="${esc(w.w)}" data-i="${i}">${zh(w.w)}<span class="py">${pyHTMLJoined(w.py)} <span class="pill">${LVNAME(w.lv)}</span></span><span class="gl">${esc(w.gl)}</span></button>`).join('')}`:'')+
    (!r.chars.length&&!r.words.length?`<p class="empty">Nothing matched “${esc(q)}”. Try a character, pinyin like <b>dian</b> or <b>dian4</b>, or an English word.</p>`:'');
}

return {roleOf,addWords,meter,rankBand,FREQ,hskCount,extraLoaded:()=>extraLoaded,esc,zh,path,LVNAME,LVSLUG,HAN,sylTone,sylPlain,pyHTML,pyHTMLJoined,WORDS,WORDMAP,CH,byLv,charPy,charDef,readings,
  charLink,colorWord,cardHTML,wordsHTML,famHTML,metaFor,search,resultsHTML,SPK};
}
if(typeof module!=='undefined')module.exports=makeCore;
