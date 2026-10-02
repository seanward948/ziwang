// Builds the static Zìwǎng site into ../ziwang-site
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execSync}=require('child_process');
const SRC=__dirname,OUT=path.join(SRC,'_site'),PKG=path.join(SRC,'node_modules','hanzi-writer-data'),TMP=path.join(require('os').tmpdir(),'ziwang-app.js');
const SITE='https://ziwang.app';
const makeCore=require('./core.js');
const DATA=JSON.parse(fs.readFileSync(path.join(SRC,'data.json'),'utf8'));
const C=makeCore(DATA);const {CH,WORDS,esc,zh,LVNAME,LVSLUG}=C;
const hash=s=>crypto.createHash('md5').update(s).digest('hex').slice(0,8);
const today=new Date().toISOString().slice(0,10);

fs.rmSync(OUT,{recursive:true,force:true});
const w=(p,s)=>{const f=path.join(OUT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)};

/* assets */
const dataStr=JSON.stringify(DATA);const dataV=hash(dataStr);
const extraStr=fs.readFileSync(path.join(SRC,'extra-words.tsv'),'utf8');const extraV=hash(extraStr);w('assets/extra-words.tsv',extraStr);
w('assets/data.json',dataStr);
let appSrc=fs.readFileSync(path.join(SRC,'core.js'),'utf8').replace("if(typeof module!=='undefined')module.exports=makeCore;",'')+'\n'+
  fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace("'/assets/data.json'",`'/assets/data.json?v=${dataV}'`).replace("'/assets/extra-words.tsv'",`'/assets/extra-words.tsv?v=${extraV}'`);
fs.writeFileSync(TMP,appSrc);
try{appSrc=execSync(`npx terser "${TMP}" -c -m --ecma 2020`,{maxBuffer:1e8,cwd:SRC}).toString()}catch(e){console.warn('terser failed, shipping unminified')}
const appV=hash(appSrc);w('assets/app.js',appSrc);
fs.copyFileSync(path.join(SRC,'node_modules','hanzi-writer','dist','hanzi-writer.min.js'),path.join(OUT,'assets','hanzi-writer.min.js'));
w('assets/config.js',fs.readFileSync(path.join(SRC,'config.js'),'utf8'));
const minCss=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'').replace(/\s*([{};,>])\s*/g,'$1').replace(/;}/g,'}');
const GCSS=minCss(fs.readFileSync(path.join(SRC,'games.css'),'utf8'));
const CSS=fs.readFileSync(path.join(SRC,'style.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'').replace(/\s*([{};,>])\s*/g,'$1').replace(/;}/g,'}');

const cssV=hash(CSS);w('assets/style.css',CSS);const gcssV=hash(GCSS);w('assets/games.css',GCSS);
/* games assets */
const gameV={};
for(const [name,file] of [['six','game-six.js'],['drop','game-drop.js'],['map','map.js']]){
  let src=fs.readFileSync(path.join(SRC,file),'utf8');const tmp=path.join(require('os').tmpdir(),'zw-'+file);fs.writeFileSync(tmp,src);
  try{src=execSync(`npx terser "${tmp}" -c -m --ecma 2020`,{maxBuffer:1e8,cwd:SRC}).toString()}catch(e){}
  gameV[name]=hash(src);w(`assets/games/${name}.js`,src);
}
const pairsStr=fs.readFileSync(path.join(SRC,'radical-pairs.json'),'utf8');const pairsV=hash(pairsStr);w('assets/radical-pairs.json',pairsStr);
/* strokes: one small file per character */
let nStroke=0;
for(const c of Object.keys(CH)){const f=path.join(PKG,c+'.json');if(fs.existsSync(f)){w(`s/${c.codePointAt(0).toString(16)}.json`,JSON.stringify(JSON.parse(fs.readFileSync(f,'utf8'))));nStroke++}}

/* templates */
/* the coffee link is written into each page at build time, so the header doesn't jump when it appears */
const COFFEE=(()=>{const m=fs.readFileSync(path.join(SRC,'config.js'),'utf8').match(/coffeeUrl\s*:\s*["']([^"']*)["']/);const u=m?m[1].trim():'';
  return /^https:\/\/(www\.)?(buymeacoffee\.com|coff\.ee)\/[A-Za-z0-9_.-]+\/?$/.test(u)&&!/yourname/i.test(u)?u:''})();
const coffeeAttr=COFFEE?`href="${COFFEE}"`:'href="#" hidden';
/* fonts and d3 are served from this site, so visitors' browsers don't contact Google or a CDN */
const FONTPKG=path.join(__dirname,'node_modules','@fontsource');
const fontFiles=new Set();let fontCSS='';let bodyFont='';
function addFonts(pkg,css,keep=()=>true){
  const src=fs.readFileSync(path.join(FONTPKG,pkg,css),'utf8');
  for(const rule of src.match(/@font-face\s*\{[^}]*\}/g)){
    const f=(rule.match(/url\(\.\/files\/([^)]+\.woff2)\)/)||[])[1];if(!f||!keep(rule))continue;
    fontFiles.add(pkg+'/'+f);
    fontCSS+=rule.replace(/src:[^;]*;/,`src:url(/assets/fonts/${f}) format('woff2');`).replace(/\s*\n\s*/g,'')+'\n';
  }
}
const covers=(rule,cp)=>{const r=(rule.match(/unicode-range:([^;]+)/)||[])[1];if(!r)return false;
  return r.split(',').some(x=>{const [a,b]=x.trim().replace(/^U\+/i,'').split('-').map(h=>parseInt(h,16));return cp>=a&&cp<=(b??a)})};
addFonts('schibsted-grotesk','400.css');addFonts('schibsted-grotesk','600.css');addFonts('schibsted-grotesk','700.css');
// only the Noto Serif SC slices that contain a character the site actually shows
const siteCps=new Set();for(const t of [fs.readFileSync(path.join(SRC,'data.json'),'utf8'),fs.readFileSync(path.join(SRC,'extra-words.tsv'),'utf8')])for(const ch of t){const cp=ch.codePointAt(0);if(cp>=0x2e80)siteCps.add(cp)}
const usedSlice=rule=>{for(const cp of siteCps)if(covers(rule,cp))return true;return false};
addFonts('noto-serif-sc','400.css',usedSlice);addFonts('noto-serif-sc','600.css',usedSlice);
addFonts('ma-shan-zheng','400.css',rule=>[...'字网'].some(c=>covers(rule,c.codePointAt(0)))); // the logo only uses 字网
fs.mkdirSync(path.join(OUT,'assets','fonts'),{recursive:true});
for(const f of fontFiles)fs.copyFileSync(path.join(FONTPKG,...f.replace('/','/files/').split('/')),path.join(OUT,'assets','fonts',path.basename(f)));
bodyFont=[...fontFiles].find(f=>/schibsted-grotesk-latin-400-normal/.test(f));
const fontsV=hash(fontCSS);w('assets/fonts.css',fontCSS);
fs.mkdirSync(path.join(OUT,'licenses'),{recursive:true});
for(const p of ['noto-serif-sc','schibsted-grotesk','ma-shan-zheng'])fs.copyFileSync(path.join(FONTPKG,p,'LICENSE'),path.join(OUT,'licenses',`OFL-${p}.txt`));
fs.copyFileSync(path.join(__dirname,'node_modules','d3','dist','d3.min.js'),path.join(OUT,'assets','d3.min.js'));
const ICON={
  search:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  wander:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  palette:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/></svg>',
  games:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.8" cy="13.8" r=".9" fill="currentColor"/></svg>',
  net:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><path d="M6 6.5 9.5 10M18 6.5 14.5 10M6 17.5 9.5 14M18 17.5 14.5 14"/></svg>',
  cup:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/></svg>'
};
const header=(isHome,char)=>`
<header class="top">
  <a class="brand" href="/"><span class="logo" lang="zh-Hans" aria-hidden="true">字网</span><span class="name">Zìwǎng</span><span class="sub">a web of characters</span></a>
  <div class="search" role="search">${ICON.search}
    <input id="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="Search 电, ma3 or “friend”" aria-label="Search by character, pinyin or English">
    <div class="results" id="results" hidden></div>
  </div>
  <div class="tools">
    <button class="btn" id="wander" type="button" title="Jump to a random HSK 1–3 character">${ICON.wander}<span class="lbl">Wander</span></button>
    <div class="themepick"><button class="btn icon" id="themeBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="themes">${ICON.palette}<span class="lbl">Theme</span></button><div class="themes" id="themes" role="menu" aria-label="Themes" hidden></div></div>
    <a class="btn netlink" href="/map/${char?`?q=${encodeURIComponent(char)}`:''}"${char?' rel="nofollow"':''}>${ICON.net}<span class="lbl">Network</span></a>
    <a class="btn games" href="/games/">${ICON.games}<span class="lbl">Games</span></a>
    <a class="btn coffee" data-coffee ${coffeeAttr} target="_blank" rel="noopener">${ICON.cup}<span class="lbl">Buy me a coffee</span></a>
  </div>
</header>`;
const nWordsFmt=WORDS.length.toLocaleString('en-US');
const footer=`
<footer class="foot">
  <nav aria-label="Browse characters by HSK level"><b>Browse:</b>${[1,2,3,4,5,6,7].map(l=>` <a href="/hsk/${LVSLUG(l)}/">${LVNAME(l)}</a>`).join('')} <span aria-hidden="true">·</span> <a href="/map/">Network</a> <span aria-hidden="true">·</span> <a href="/games/">Games</a> <span aria-hidden="true">·</span> <a href="/feedback/">Feedback</a></nav>
  <p>Privacy: no accounts, no cookies. Your settings stay in your browser, and visits are counted with <a href="https://www.cloudflare.com/web-analytics/" rel="noopener">Cloudflare Web Analytics</a>, which doesn’t track you across sites.</p>
  <p class="coffee-line"${COFFEE?'':' hidden'}>Free and ad-free. <a data-coffee href="${COFFEE||'#'}" target="_blank" rel="noopener">Buy me a coffee</a> if it helps.</p>
  <p>Data: <a href="https://github.com/drkameleon/complete-hsk-vocabulary" rel="noopener">HSK lists</a>, <a href="https://cc-cedict.org" rel="noopener">CC-CEDICT</a> (CC BY-SA 4.0), <a href="https://github.com/skishore/makemeahanzi" rel="noopener">Make Me a Hanzi</a>, <a href="https://www.dong-chinese.com" rel="noopener">Dong Chinese</a>, <a href="https://lingua.mtsu.edu/chinese-computing/" rel="noopener">Jun Da</a> and <a href="https://github.com/fxsjy/jieba" rel="noopener">jieba</a> frequencies. Strokes drawn with <a href="https://hanziwriter.org" rel="noopener">Hanzi Writer</a>.</p>
</footer>`;
const explorer=({card,gtitle,wtitle,bar,wlist,fam,char})=>`
  <nav class="trail" id="trail" aria-label="Characters you have visited"></nav>
  <section class="main">
    <article class="panel card" id="card">${card}</article>
    <div class="panel graphp">
      <div class="gtop"><h2 id="gtitle">${gtitle}</h2><a class="btn" id="ctxBtn" rel="nofollow" href="/map/${char?`?q=${encodeURIComponent(char)}`:''}">Full network map</a><button class="btn" id="tonechars" type="button" aria-pressed="false" title="Colour characters by tone">Tone colours</button></div>
      <svg id="graph" role="img" aria-label="Network of words containing this character"></svg>
      <div class="caption" id="caption"><span class="hint">Tap a word to hear it. Tap an outer character to travel there.</span></div>
    </div>
  </section>
  <section class="lower">
    <div class="panel words" id="wordsPanel">
      <div class="top2"><h2 id="wtitle">${wtitle}</h2><button class="btn" id="quizbtn" type="button" aria-pressed="false" title="Blur the English so you can test yourself">Hide English</button></div>
      <div class="lvbar" id="lvbar">${bar}</div>
      <div id="wlist">${wlist}</div>
    </div>
    <aside class="panel fam" id="fam">${fam}</aside>
  </section>`;
function page({title,desc,url,mode,char,body,jsonld=[],noindex=false,ogTitle,scripts=[]}){
  const explorerMode=mode==='home'||mode==='char';
  const wantsData=explorerMode||scripts.includes('six')||scripts.includes('map');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${url}">
${noindex?'<meta name="robots" content="noindex,follow">\n':''}<meta name="theme-color" content="#F6F8F2">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zìwǎng 字网">
<meta property="og:title" content="${esc(ogTitle||title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Zìwǎng 字网: explore Chinese characters as a web of words">
<meta name="twitter:card" content="summary_large_image">
<script>try{var s=JSON.parse(localStorage.getItem('ziwang.skin'));if(s&&s!=='auto')document.documentElement.dataset.skin=s}catch(e){}</script>
<link rel="preload" href="/assets/fonts/${path.basename(bodyFont)}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css?v=${fontsV}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="/assets/fonts.css?v=${fontsV}"></noscript>
<link rel="stylesheet" href="/assets/style.css?v=${cssV}">${scripts.length||url.startsWith('/games')?`\n<link rel="stylesheet" href="/assets/games.css?v=${gcssV}">`:''}
<script src="/assets/config.js" defer></script>
${explorerMode?'<script src="/assets/hanzi-writer.min.js" defer></script>\n':''}${scripts.includes('map')?'<script src="/assets/d3.min.js?v=7.9.0" defer></script>\n':''}<script src="/assets/app.js?v=${appV}" defer></script>${scripts.map(s=>`\n<script src="/assets/games/${s}.js?v=${gameV[s]}" defer></script>`).join('')}
${jsonld.map(j=>`<script type="application/ld+json">${JSON.stringify(j).replace(/</g,'\\u003c')}</script>`).join('\n')}
</head>
<body data-mode="${mode}"${char?` data-char="${esc(char)}"`:''}>
<div class="wrap">
${header(mode==='home',char)}
${body}
${footer}
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
</body>
</html>
`;
}

/* character pages */
const urls=[];
let nPages=0;
for(const c of Object.keys(CH)){
  const o=CH[c];const m=C.metaFor(c);const wr=C.wordsHTML(c,{});
  const indexable=o.lv<=7;
  const url=C.path(c);
  const jsonld=[{'@context':'https://schema.org','@type':'DefinedTerm',name:c,alternateName:C.readings(c).join(', ')||undefined,description:C.charDef(c)||undefined,
      url:SITE+url,inLanguage:'zh-Hans',inDefinedTermSet:{'@type':'DefinedTermSet',name:'Zìwǎng Chinese character dictionary',url:SITE+'/'}},
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Zìwǎng',item:SITE+'/'},
      ...(indexable?[{'@type':'ListItem',position:2,name:LVNAME(o.lv)+' characters',item:`${SITE}/hsk/${LVSLUG(o.lv)}/`}]:[]),
      {'@type':'ListItem',position:indexable?3:2,name:c,item:SITE+url}]}];
  const body=`<main id="main">${explorer({char:c,card:C.cardHTML(c),gtitle:o.words.length?`Words built with ${zh(c)}`:`Characters that contain ${zh(c)}`,wtitle:wr.title,bar:wr.bar,wlist:wr.body,fam:C.famHTML(c,{})})}</main>`;
  w(`zi/${c}/index.html`,page({title:m.title,desc:m.desc,url,mode:'char',char:c,body,jsonld,noindex:!indexable}));
  nPages++;
  if(indexable)urls.push({loc:SITE+url,pri:o.lv<=2?'0.8':o.lv<=4?'0.7':'0.6'});
}

/* home */
const HSK1=Object.values(CH).filter(o=>o.lv===1&&o.words.length>=2).map(o=>o.c).join('');
const homeDesc=`A free visual Chinese dictionary: explore any character’s stroke order, parts, sound and meaning families, and every HSK word it appears in.`;
const homeBody=`<section class="intro">
  <h1>Explore Chinese characters as a web of words</h1>
</section>
<main id="main">${explorer({
  card:`<div class="tzg"><svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50H100M50 0V100" stroke="var(--grid)" stroke-width=".6" stroke-dasharray="2.2 2" fill="none"/><path d="M0 0L100 100M100 0L0 100" stroke="var(--grid-soft)" stroke-width=".5" stroke-dasharray="1.6 2" fill="none"/></svg><div class="fallback" id="fallback" lang="zh-Hans"></div></div>
  <script>(function(){var h=${JSON.stringify(HSK1)};var a=Array.from(h);var c=a[Math.floor(Math.random()*a.length)];window.__start=c;document.getElementById('fallback').textContent=c})()</script>
  <div class="skel" style="width:40%;height:28px"></div><div class="skel" style="width:70%"></div>`,
  gtitle:'Word web',wtitle:'Words',bar:'',wlist:'',fam:''})}</main>`;
w('index.html',page({title:'Zìwǎng 字网: explore Chinese characters, stroke order & HSK words',ogTitle:'Zìwǎng 字网: a web of Chinese characters',desc:homeDesc,url:'/',mode:'home',body:homeBody,
  jsonld:[{'@context':'https://schema.org','@type':'WebSite',name:'Zìwǎng 字网',alternateName:['Ziwang','字网'],url:SITE+'/',inLanguage:'en'},
    {'@context':'https://schema.org','@type':'WebApplication',name:'Zìwǎng',url:SITE+'/',applicationCategory:'EducationalApplication',operatingSystem:'Any',
     description:homeDesc,inLanguage:'en',isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},
     about:{'@type':'Language',name:'Mandarin Chinese',alternateName:'zh'}}]}));
urls.unshift({loc:SITE+'/',pri:'1.0'});

/* HSK list pages */
const hskUrls=[];
const tabs=cur=>`<nav class="lvtabs" aria-label="HSK levels">${[1,2,3,4,5,6,7].map(l=>`<a href="/hsk/${LVSLUG(l)}/"${l===cur?' aria-current="page"':''}>${LVNAME(l)}</a>`).join('')}</nav>`;
for(const L of [1,2,3,4,5,6,7]){
  const list=Object.values(CH).filter(o=>o.lv===L).sort((a,b)=>(a.rank||1e6)-(b.rank||1e6));
  const name=LVNAME(L);
  const desc=`All ${list.length} Chinese characters that first appear in ${name} words, with pinyin and meanings. Open any one for stroke order, parts and the words it builds.`;
  const body=`<main id="main" class="panel listpage">
  <h1>${name} characters</h1>
  <p>The ${list.length} characters first taught at ${name} (HSK 3.0), most used first.</p>
  ${tabs(L)}
  <ul class="cgrid">${list.map(o=>{const p=C.charPy(o.c);return `<li><a href="${C.path(o.c)}">${zh(o.c)}<b class="t${C.sylTone(p)}">${esc(p)}${C.meter(C.rankBand(o.rank),o.rank?' · #'+o.rank:'')}</b><small>${esc((C.charDef(o.c)||'').split(';')[0])}</small></a></li>`}).join('')}</ul>
</main>`;
  const url=`/hsk/${LVSLUG(L)}/`;
  w(`hsk/${LVSLUG(L)}/index.html`,page({title:`${name} characters: all ${list.length} with pinyin & meanings | Zìwǎng`,desc,url,mode:'list',body,
    jsonld:[{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Zìwǎng',item:SITE+'/'},{'@type':'ListItem',position:2,name:`${name} characters`,item:SITE+url}]}]}));
  hskUrls.push({loc:SITE+url,pri:'0.9'});
}

urls.splice(1,0,...hskUrls);

/* games: gallery + one page per game */
const zhs=s=>`<span lang="zh-Hans">${s}</span>`;
const SIX_PATH=['火','车','汽','水','海'],SIX_WORDS=['火车','汽车','汽水','海水'];
const sixPreview=`<div class="pv pv-six" aria-hidden="true"><div class="pv-row">${SIX_PATH.map((c,i)=>(i?`<span class="e" style="--i:${i}"><i></i><em lang="zh-Hans">${SIX_WORDS[i-1]}</em></span>`:'')+`<span class="n${i===0?' first':''}${i===SIX_PATH.length-1?' last':''}" style="--i:${i}" lang="zh-Hans">${c}</span>`).join('')}</div></div>`;
const dropCell=(ch,r,c,cls='')=>`<span class="t ${cls}" style="--r:${r};--c:${c}" lang="zh-Hans">${ch}</span>`;
const dropPreview=`<div class="pv pv-drop" aria-hidden="true"><div class="pv-board">
  ${dropCell('口',3,0)}${dropCell('木',3,1)}${dropCell('女',3,2,'mA')}${dropCell('早',3,4,'mB')}${dropCell('氵',2,0)}${dropCell('亻',2,1)}
  ${dropCell('马',-1,3,'fA')}${dropCell('艹',-1,4,'fB')}
  <span class="pop pA" style="--r:3;--c:2.5"><b lang="zh-Hans">妈</b><small class="t1">mā</small></span>
  <span class="pop pB" style="--r:2.5;--c:4"><b lang="zh-Hans">草</b><small class="t3">cǎo</small></span>
</div></div>`;
const GAMES=[
  {slug:'six-degrees',script:'six',name:'Six Degrees of 字',zh:'连字',py:'liánzì',tag:'Daily puzzle',preview:sixPreview,
   blurb:'Get from one character to another by hopping through words that share them. 火 to 海 takes four hops. A new puzzle every day.',
   title:'Six Degrees of 字: a daily Chinese character puzzle | Zìwǎng',
   desc:'A free daily puzzle for Mandarin learners. Hop from one Chinese character to another through the HSK words they share, in as few steps as you can.',
   how:`<h2>How to play</h2><p>Reach the target character by hopping between characters that share a word. From ${zhs('火')}, ${zhs('火车')} (train) takes you to ${zhs('车')}, then ${zhs('汽车')} (car) to ${zhs('汽')}. Tap a character to see the linking word, tap again to hop, or type any word you know. Par is the fewest hops possible.</p>`,
   mount:'<div id="six" class="six"></div>'},
  {slug:'radical-drop',script:'drop',name:'Radical Drop',zh:'拼字',py:'pīnzì',tag:'Arcade',preview:dropPreview,
   blurb:'Parts of characters fall from above. Put them side by side or stack them to build real characters before the board fills up.',
   title:'Radical Drop: build Chinese characters from falling parts | Zìwǎng',
   desc:'A free falling-block game for Mandarin learners. Line up or stack character parts like 女 and 马 to build real characters such as 妈 before the board fills.',
   how:`<h2>How to play</h2><p>Line up parts left to right (${zhs('女')} + ${zhs('马')} = ${zhs('妈')}) or stack them (${zhs('艹')} over ${zhs('早')} = ${zhs('草')}) to build a character and clear it. Keys: ← → move, ↓ nudge, Space drop, P pause. On a phone, swipe or use the buttons.</p>`,
   mount:`<div id="drop" data-pairs="/assets/radical-pairs.json?v=${pairsV}"></div>`}];
const gameUrls=[{loc:SITE+'/games/',pri:'0.8'}];
w('games/index.html',page({title:'Chinese character games for Mandarin learners | Zìwǎng',ogTitle:'Zìwǎng games',
  desc:'Free games built on Chinese characters and HSK words: a daily character-hopping puzzle and a falling-parts arcade game.',url:'/games/',mode:'list',
  jsonld:[{'@context':'https://schema.org','@type':'ItemList',name:'Zìwǎng games',itemListElement:GAMES.map((g,i)=>({'@type':'ListItem',position:i+1,name:g.name,url:SITE+`/games/${g.slug}/`}))},
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Zìwǎng',item:SITE+'/'},{'@type':'ListItem',position:2,name:'Games',item:SITE+'/games/'}]}],
  body:`<main id="main" class="panel listpage gamespage">
  <h1>Chinese character games</h1>
  <div class="ggrid">
  ${GAMES.map(g=>`<a class="gcard" href="/games/${g.slug}/">
    ${g.preview}
    <span class="gc-body"><span class="gc-top"><span class="gc-name">${g.name.replace('字',zhs('字'))}</span><span class="pill">${g.tag}</span></span>
    <span class="gc-zh"><span lang="zh-Hans" class="cn">${g.zh}</span> ${g.py}</span>
    <span class="gc-blurb">${g.blurb.replace(/([㐀-鿿]+)/g,'<span lang="zh-Hans">$1</span>')}</span>
    <span class="gc-play">Play</span></span></a>`).join('')}
  </div>
</main>`}));
for(const g of GAMES){
  const url=`/games/${g.slug}/`;gameUrls.push({loc:SITE+url,pri:'0.8'});
  w(`games/${g.slug}/index.html`,page({title:g.title,desc:g.desc,url,mode:'game',scripts:[g.script],ogTitle:`${g.name} · Zìwǎng`,
    jsonld:[{'@context':'https://schema.org','@type':'VideoGame',name:g.name,url:SITE+url,description:g.desc,genre:g.tag,gamePlatform:'Web browser',applicationCategory:'Game',operatingSystem:'Any',isAccessibleForFree:true,inLanguage:['en','zh-Hans'],offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}},
      {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Zìwǎng',item:SITE+'/'},{'@type':'ListItem',position:2,name:'Games',item:SITE+'/games/'},{'@type':'ListItem',position:3,name:g.name,item:SITE+url}]}],
    body:`<main id="main" class="panel gamepage">
  <a class="crumb" href="/games/">← All games</a>
  <div class="gp-head"><h1>${g.name.replace('字',zhs('字'))}</h1><span class="gc-zh"><span lang="zh-Hans" class="cn">${g.zh}</span> ${g.py}</span></div>
  ${g.mount}
  <section class="gp-how">${g.how}</section>
</main>`}));
}
urls.splice(1,0,...gameUrls);
/* character network */
w('map/index.html',page({title:'Chinese character network: see how characters connect | Zìwǎng',ogTitle:'Zìwǎng character network',
  desc:'An interactive map of Chinese characters linked by the words they share. Explore one character’s neighbours or the full HSK network.',url:'/map/',mode:'map',scripts:['map'],
  jsonld:[{'@context':'https://schema.org','@type':'WebApplication',name:'Zìwǎng character network',url:SITE+'/map/',description:'An interactive map of Chinese characters linked by the words they share.',applicationCategory:'EducationalApplication',operatingSystem:'Any',isAccessibleForFree:true,inLanguage:['en','zh-Hans'],offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}},
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Zìwǎng',item:SITE+'/'},{'@type':'ListItem',position:2,name:'Character network',item:SITE+'/map/'}]}],
  body:`<main id="main" class="panel mappage"><div class="gp-head"><h1>Chinese character network</h1><span class="gc-zh"><span lang="zh-Hans" class="cn">字网</span> zìwǎng</span></div><div id="map" class="map"></div></main>`}));
urls.splice(1,0,{loc:SITE+'/map/',pri:'0.8'});
/* feedback: the form posts to a small Cloudflare Worker that emails it on, so no address appears on the site */
const FEEDBACK_URL='https://feedback.ziwang.app/';
w('feedback/index.html',page({title:'Feedback | Zìwǎng',desc:'Send feedback about Zìwǎng: a wrong definition, a bug or an idea.',url:'/feedback/',mode:'list',noindex:true,
  body:`<main id="main" class="panel listpage fbpage">
  <h1>Feedback</h1>
  <p>Spotted a wrong definition or a bug, or have an idea? Let me know.</p>
  <form id="fb" class="fb" novalidate>
    <label class="fb-f">Message<textarea name="message" rows="7" maxlength="4000" required></textarea></label>
    <label class="fb-f">Your email <small>(optional, only if you'd like a reply)</small><input name="email" type="email" maxlength="200" autocomplete="email"></label>
    <label class="fb-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    <div class="fb-act"><button class="btn primary" type="submit">Send</button><span class="fb-status" id="fbStatus" role="status" aria-live="polite"></span></div>
  </form>
  <p class="fb-note">Your message is emailed to me through Cloudflare and isn't stored anywhere else.</p>
</main>
<script>(function(){var f=document.getElementById('fb'),st=document.getElementById('fbStatus'),t=Date.now(),from='';
try{var r=document.referrer&&new URL(document.referrer);if(r&&r.origin===location.origin&&r.pathname!=='/feedback/')from=r.href}catch(e){}
f.addEventListener('submit',function(e){e.preventDefault();var m=f.message.value.trim();if(m.length<3){st.textContent='Please write a little more.';f.message.focus();return}
var b=f.querySelector('button');b.disabled=true;st.textContent='Sending…';
fetch('${FEEDBACK_URL}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,email:f.email.value.trim(),website:f.website.value,page:from,t:t})})
.then(function(r){return r.json().catch(function(){return{}}).then(function(d){if(!r.ok||!d.ok)throw new Error(d.error||'')})})
.then(function(){f.reset();st.textContent='Thanks, it’s on its way.'})
.catch(function(err){st.textContent=err.message||'It couldn’t be sent just now. Please try again later.'})
.finally(function(){b.disabled=false})})})();</script>`}));

/* 404 */
w('404.html',page({title:'Page not found | Zìwǎng',desc:'This page doesn’t exist.',url:'/404.html',mode:'list',noindex:true,
  body:`<main id="main" class="panel listpage"><h1>That page isn’t here</h1><p>Search for a character above, <a href="/">start from a random one</a>, or browse by level.</p>${tabs(0)}</main>`}));

/* sitemap, robots, CNAME, manifest */
w('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`<url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>\n`);
w('robots.txt',`User-agent: *\nAllow: /\nDisallow: /map/?\n\nSitemap: ${SITE}/sitemap.xml\n`);
w('CNAME','ziwang.app\n');
w('.nojekyll','');
w('site.webmanifest',JSON.stringify({name:'Zìwǎng 字网',short_name:'字网',description:'Explore Chinese characters as a web of words.',start_url:'/',display:'standalone',
  background_color:'#F6F8F2',theme_color:'#1D7556',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,1));

console.log({pages:nPages,strokes:nStroke,sitemap:urls.length,appKB:Math.round(appSrc.length/1024),cssKB:Math.round(CSS.length/1024)});
for(const f of ['favicon.svg','favicon-32.png','apple-touch-icon.png','icon-192.png','icon-512.png','og.png'])fs.copyFileSync(path.join(SRC,f),path.join(OUT,f));
fs.mkdirSync(path.join(OUT,'licenses'),{recursive:true});
fs.copyFileSync(path.join(PKG,'ARPHICPL.TXT'),path.join(OUT,'licenses','ARPHICPL.TXT'));
