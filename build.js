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
w('assets/data.json',dataStr);
let appSrc=fs.readFileSync(path.join(SRC,'core.js'),'utf8').replace("if(typeof module!=='undefined')module.exports=makeCore;",'')+'\n'+
  fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace("'/assets/data.json'",`'/assets/data.json?v=${dataV}'`);
fs.writeFileSync(TMP,appSrc);
try{appSrc=execSync(`npx terser "${TMP}" -c -m --ecma 2020`,{maxBuffer:1e8,cwd:SRC}).toString()}catch(e){console.warn('terser failed, shipping unminified')}
const appV=hash(appSrc);w('assets/app.js',appSrc);
fs.copyFileSync(path.join(SRC,'node_modules','hanzi-writer','dist','hanzi-writer.min.js'),path.join(OUT,'assets','hanzi-writer.min.js'));
w('assets/config.js',fs.readFileSync(path.join(SRC,'config.js'),'utf8'));
const CSS=fs.readFileSync(path.join(SRC,'style.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'').replace(/\s*([{};,>])\s*/g,'$1').replace(/;}/g,'}');

const cssV=hash(CSS);w('assets/style.css',CSS);
/* strokes: one small file per character */
let nStroke=0;
for(const c of Object.keys(CH)){const f=path.join(PKG,c+'.json');if(fs.existsSync(f)){w(`s/${c.codePointAt(0).toString(16)}.json`,JSON.stringify(JSON.parse(fs.readFileSync(f,'utf8'))));nStroke++}}

/* templates */
const FONTS='https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&family=Schibsted+Grotesk:wght@400;600;700&display=swap';
const LOGOFONT='https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=%E5%AD%97%E7%BD%91&display=swap';
const ICON={
  search:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  wander:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  palette:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/></svg>',
  cup:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/></svg>'
};
const header=(isHome)=>`
<header class="top">
  <a class="brand" href="/" aria-label="Zìwǎng home"><span class="logo" lang="zh-Hans" aria-hidden="true">字网</span><span class="name">Zìwǎng</span><span class="sub">a web of characters</span></a>
  <div class="search" role="search">${ICON.search}
    <input id="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="Search 电, dian, dian4 or “electric”" aria-label="Search by character, pinyin or English">
    <div class="results" id="results" hidden></div>
  </div>
  <div class="tools">
    <button class="btn" id="wander" type="button" aria-label="Wander to a random HSK 1–3 character" title="Jump to a random HSK 1–3 character">${ICON.wander}<span class="lbl">Wander</span></button>
    <div class="themepick"><button class="btn icon" id="themeBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="themes" aria-label="Choose a theme">${ICON.palette}<span class="lbl">Theme</span></button><div class="themes" id="themes" role="menu" aria-label="Themes" hidden></div></div>
    <a class="btn coffee" data-coffee href="#" target="_blank" rel="noopener" aria-label="Buy me a coffee" hidden>${ICON.cup}<span class="lbl">Buy me a coffee</span></a>
  </div>
</header>`;
const nWordsFmt=WORDS.length.toLocaleString('en-US');
const footer=`
<footer class="foot">
  <nav aria-label="Browse characters by HSK level"><b>Browse characters:</b>${[1,2,3,4,5,6,7].map(l=>` <a href="/hsk/${LVSLUG(l)}/">${LVNAME(l)}</a>`).join('')}</nav>
  <p>Zìwǎng is a free visual dictionary of Chinese characters for Mandarin learners. See how each character is written, what it is built from, which characters share its sound or meaning, and all of the ${nWordsFmt} words from the new HSK 3.0 syllabus that use it.</p>
  <p class="coffee-line" hidden>Zìwǎng is free and has no ads. If it helps you learn, you can <a data-coffee href="#" target="_blank" rel="noopener">buy me a coffee</a>.</p>
  <p>Word data: <a href="https://github.com/drkameleon/complete-hsk-vocabulary" rel="noopener">complete-hsk-vocabulary</a> (definitions from CC-CEDICT, CC BY-SA 4.0). Character breakdowns and stroke data: <a href="https://github.com/skishore/makemeahanzi" rel="noopener">Make Me a Hanzi</a>, animated with <a href="https://hanziwriter.org" rel="noopener">Hanzi Writer</a>. Audio uses your browser’s built-in Mandarin voice.</p>
</footer>`;
const explorer=({card,gtitle,wtitle,bar,wlist,fam})=>`
  <nav class="trail" id="trail" aria-label="Characters you have visited"></nav>
  <section class="main">
    <article class="panel card" id="card">${card}</article>
    <div class="panel graphp">
      <div class="gtop"><h2 id="gtitle">${gtitle}</h2><button class="btn" id="tonechars" type="button" aria-pressed="false" title="Colour characters by tone">Tone colours</button></div>
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
function page({title,desc,url,mode,char,body,jsonld=[],noindex=false,ogTitle}){
  const explorerMode=mode==='home'||mode==='char';
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">
<link rel="stylesheet" href="${LOGOFONT}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONTS}"><link rel="stylesheet" href="${LOGOFONT}"></noscript>
${explorerMode?`<link rel="preload" href="/assets/data.json?v=${dataV}" as="fetch" crossorigin>\n`:''}<link rel="stylesheet" href="/assets/style.css?v=${cssV}">
<script src="/assets/config.js" defer></script>
${explorerMode?'<script src="/assets/hanzi-writer.min.js" defer></script>\n':''}<script src="/assets/app.js?v=${appV}" defer></script>
${jsonld.map(j=>`<script type="application/ld+json">${JSON.stringify(j).replace(/</g,'\\u003c')}</script>`).join('\n')}
</head>
<body data-mode="${mode}"${char?` data-char="${esc(char)}"`:''}>
<div class="wrap">
${header(mode==='home')}
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
  const body=`<main id="main">${explorer({card:C.cardHTML(c),gtitle:o.words.length?`Words built with ${zh(c)}`:`Characters that contain ${zh(c)}`,wtitle:wr.title,bar:wr.bar,wlist:wr.body,fam:C.famHTML(c,{})})}</main>`;
  w(`zi/${c}/index.html`,page({title:m.title,desc:m.desc,url,mode:'char',char:c,body,jsonld,noindex:!indexable}));
  nPages++;
  if(indexable)urls.push({loc:SITE+url,pri:o.lv<=2?'0.8':o.lv<=4?'0.7':'0.6'});
}

/* home */
const HSK1=Object.values(CH).filter(o=>o.lv===1&&o.words.length>=2).map(o=>o.c).join('');
const homeDesc=`Explore Chinese characters as a web of words. See stroke order, character parts, sound and meaning families, and every HSK word a character appears in. Free for Mandarin learners.`;
const homeBody=`<section class="intro">
  <h1>Explore Chinese characters as a web of words</h1>
  <p>Pick any character to see how it’s written, what it’s built from, and every HSK word it appears in. Each visit starts on a random HSK 1 character.</p>
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
  const list=Object.values(CH).filter(o=>o.lv===L).sort((a,b)=>b.words.length-a.words.length);
  const name=LVNAME(L);
  const desc=`All ${list.length} Chinese characters that first appear in ${name} words, with pinyin and meanings. Open any one for stroke order, parts and the words it builds.`;
  const body=`<main id="main" class="panel listpage">
  <h1>${name} characters</h1>
  <p>The ${list.length} characters that first appear in ${name} vocabulary (new HSK 3.0 syllabus), ordered by how many HSK words use them. Open any character to see its stroke order, parts and word web.</p>
  ${tabs(L)}
  <ul class="cgrid">${list.map(o=>{const p=C.charPy(o.c);return `<li><a href="${C.path(o.c)}">${zh(o.c)}<b class="t${C.sylTone(p)}">${esc(p)}</b><small>${esc((C.charDef(o.c)||'').split(';')[0])}</small></a></li>`}).join('')}</ul>
</main>`;
  const url=`/hsk/${LVSLUG(L)}/`;
  w(`hsk/${LVSLUG(L)}/index.html`,page({title:`${name} characters: all ${list.length} with pinyin & meanings | Zìwǎng`,desc,url,mode:'list',body,
    jsonld:[{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Zìwǎng',item:SITE+'/'},{'@type':'ListItem',position:2,name:`${name} characters`,item:SITE+url}]}]}));
  hskUrls.push({loc:SITE+url,pri:'0.9'});
}

urls.splice(1,0,...hskUrls);
/* 404 */
w('404.html',page({title:'Page not found | Zìwǎng',desc:'This page doesn’t exist.',url:'/404.html',mode:'list',noindex:true,
  body:`<main id="main" class="panel listpage"><h1>That page isn’t here</h1><p>Search for a character above, <a href="/">start from a random one</a>, or browse by level.</p>${tabs(0)}</main>`}));

/* sitemap, robots, CNAME, manifest */
w('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`<url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>\n`);
w('robots.txt',`User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
w('CNAME','ziwang.app\n');
w('.nojekyll','');
w('site.webmanifest',JSON.stringify({name:'Zìwǎng 字网',short_name:'字网',description:'Explore Chinese characters as a web of words.',start_url:'/',display:'standalone',
  background_color:'#F6F8F2',theme_color:'#1D7556',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,1));

console.log({pages:nPages,strokes:nStroke,sitemap:urls.length,appKB:Math.round(appSrc.length/1024),cssKB:Math.round(CSS.length/1024)});
for(const f of ['favicon.svg','favicon-32.png','apple-touch-icon.png','icon-192.png','icon-512.png','og.png'])fs.copyFileSync(path.join(SRC,f),path.join(OUT,f));
fs.mkdirSync(path.join(OUT,'licenses'),{recursive:true});
fs.copyFileSync(path.join(PKG,'ARPHICPL.TXT'),path.join(OUT,'licenses','ARPHICPL.TXT'));
