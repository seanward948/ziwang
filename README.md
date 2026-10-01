# Zìwǎng 字网

**A free website for exploring Chinese characters as a web of words.**

**[ziwang.app](https://ziwang.app)**

![Zìwǎng: explore Chinese characters as a web of words](og.png)

Pick any character and see how it is written, what it is made of, and every word it appears in. From 电 (electricity) you can jump to 电视 (television), 电脑 (computer) and 电影 (film), then click through to 视, 脑 or 影 and keep going.

It is free, has no ads and needs no account.

---

## Why I made this

I'm learning Mandarin. The tools I liked best were the ones that let me look at a single character and see where else it turns up, and I wanted one that did exactly that, looked good, and was quick to wander around in.

I'm not a software developer. I built Zìwǎng with [Claude](https://claude.ai). If you spot something broken or a definition that looks wrong, please [open an issue](../../issues).

---

## What you can do

**Explore a character**
- Watch the stroke order animate on a practice grid (田字格)
- Practise writing it yourself by tracing each stroke, with hints if you get stuck
- Hear it read aloud, using your browser's built-in Mandarin voice
- See its pinyin, meaning, HSK level, radical and stroke count
- See how common it is, and how common each of its words is

**See how it's built**
- The parts it's made from, labelled as the *meaning*, *sound* or *picture* part where that applies
- A short note on where the character comes from, e.g. 休 is a person 亻 leaning against a tree 木
- **Sound family:** characters that share its sound part (妈 吗 码 骂)
- **Meaning family:** characters that share its meaning part
- **Found inside:** characters that contain it

**Explore its words**
- A word web: the character in the middle, words around it, and the other characters in those words on the outside. Click any outer character to travel there.
- A full word list grouped by HSK level, with pinyin coloured by tone
- Common words beyond the HSK lists, under **Beyond HSK**
- **Hide English**, which blurs the meanings so you can test yourself
- Filter everything by HSK level (1 to 7–9)

**See the network**
- Open any character or word in the character network, where characters are linked by the words they share. Hover over a link to see the word.
- Switch the links to **Character parts** to see how characters are built instead: arrows run from a part to each character that uses it, coloured by the part's job: meaning, sound, picture or other. Jumps can follow the arrows forward, backward or both ways, you can show only some kinds of part, and there's a layered hierarchy layout. Open it from **Parts network** on any character page.
- Choose how many jumps out to show and which HSK levels to include, or view the full network
- Layouts: force-directed, ForceAtlas2 (with gravity, LinLog, dissuade hubs and other settings), rings by distance, rings by HSK level and a frequency spiral
- Size characters by connections or by frequency, and colour them by HSK level, distance or community
- Show or hide the links. When they're hidden, click a character to see its links.

**Play games**
- **Six Degrees of 字:** get from one character to another by hopping through words that share them. There's a new puzzle every day with a result you can share, plus a random mode you can set to an HSK level.
- **Radical Drop:** parts of characters fall from above, and you put them together to build real characters. You can pick an HSK level.

**Get around**
- Search by character, pinyin (`ma`, `ma3`) or English (`horse`)
- **Wander** jumps to a random HSK 1–3 character
- A trail of the characters you've visited
- Lists of every character by HSK level
- Five themes: 练习本 Exercise book, 黑板 Blackboard, 青花 Porcelain, 水墨 Ink wash and 灯笼 Lantern

---

## What's inside

| | |
|---|---|
| Words | 10,969 words from the new HSK 3.0 syllabus, levels 1 to 7–9, plus 20,000 common words beyond HSK |
| Characters | 2,970 HSK characters, plus about 360 components such as 讠 and 氵 |

### Data

| Source | Used for | Licence |
|---|---|---|
| [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | HSK word lists, levels and pinyin | MIT |
| [CC-CEDICT](https://cc-cedict.org) | English definitions, and the words beyond HSK | CC BY-SA 4.0 |
| [Jun Da's character frequency list](https://lingua.mtsu.edu/chinese-computing/) | How common each character is | Free for non-commercial use |
| [jieba](https://github.com/fxsjy/jieba) | How common each word is, and which extra words to include | MIT |
| [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) | Character parts, origins and stroke data | Arphic Public License / LGPL |
| [Dong Chinese](https://www.dong-chinese.com) ([chinese-lexicon](https://www.npmjs.com/package/chinese-lexicon)) | What each part does (meaning, sound or picture) for about 2,100 characters | ISC |
| [Hanzi Writer](https://hanziwriter.org) | Stroke animation and writing practice | MIT |
| [D3](https://d3js.org) | Drawing and laying out the character network | ISC |

Fonts are Noto Serif SC, Schibsted Grotesk and Ma Shan Zheng (SIL Open Font License), installed from [Fontsource](https://fontsource.org) and served from the site itself, along with D3. Apart from Cloudflare's analytics script, pages don't load anything from other sites.

---

## How it works

The site is plain HTML, CSS and JavaScript.

| File | What it does |
|---|---|
| `build.js` | Generates the whole site into `_site/` |
| `core.js` | Dictionary lookups, search, and the HTML for each section |
| `app.js` | Everything interactive: word web, themes, stroke animation, audio |
| `style.css` | Layout and the five themes |
| `games.css` | Styles for the games and the network |
| `map.js` | The character network |
| `game-six.js` | Six Degrees of 字 |
| `game-drop.js` | Radical Drop |
| `data.json` | HSK words and characters, prepared from the sources above |
| `extra-words.tsv` | The words beyond HSK, loaded in the background |
| `radical-pairs.json` | Which parts make which characters, for Radical Drop |
| `config.js` | Cloudflare Web Analytics token and support link |

### Run it yourself

You'll need [Node.js](https://nodejs.org).

```bash
npm install
node build.js
cd _site && python3 -m http.server 8000
```

Then open http://localhost:8000. The site expects to be served from the root of a domain, so it won't work from a subfolder.

---

## Privacy

There are no accounts. Your theme, trail, game progress and settings are saved in your own browser and never leave it. Visits are counted with [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/), which uses no cookies, doesn't fingerprint visitors and doesn't track you across sites.

---

## Support

If Zìwǎng helps you learn, you can [buy me a coffee](https://buymeacoffee.com/ygQf1M8jAA).

---

## Licence

The code is licensed under the [GNU AGPL v3](LICENSE). You're free to use, change and share it. If you run a modified version publicly, please share your changes under the same licence.

The dictionary data keeps its original licences, listed under [Data](#data).
