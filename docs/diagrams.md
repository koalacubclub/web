# Diagrams — convention

**When you add an architecture/flow diagram to this repo, make it an Excalidraw
PNG with the scene _embedded_.** That single file both renders inline on GitHub
and is fully editable: drag it onto [excalidraw.com](https://excalidraw.com), edit,
then re-export with **"Embed scene"** on. This is the convention the multiplayer
diagram follows ([multiplayer.md](./multiplayer.md)).

Do **not** commit flat PNGs (nobody can edit them), raw Mermaid-only for anything
spatial (it auto-lays-out and gets ugly fast), or screenshots of a drawing tool.
Mermaid is fine for _sequence_ diagrams inside markdown (see multiplayer.md); use
embedded Excalidraw for _architecture/box-and-arrow_ diagrams.

## Rules

- Store under `docs/`. Name the image `<topic>-<name>.excalidraw.png` (the
  `.excalidraw.png` suffix signals "embedded scene, editable").
- Commit the extracted `.excalidraw` **source** next to it (same basename) so the
  scene is greppable/diffable and openable directly.
- Reference it from markdown with a normal image tag:
  `![Alt text](./<topic>-<name>.excalidraw.png)`.
- Add a one-line "drag onto excalidraw.com to edit" note above the image.

## Reproducible recipe (no manual drawing)

You can generate the whole thing programmatically — the multiplayer diagram was
built this way. The key insight: `@excalidraw/utils` ships a **self-contained ESM
bundle** (pako + PNG `tEXt` encoding + the embed machinery are all inlined), and
`exportToBlob({ appState: { exportEmbedScene: true } })` produces a genuine
editable Excalidraw PNG. Render it in headless Chrome (it needs a canvas).

### 1. Scratch dir + the export lib

```bash
mkdir -p /tmp/excal && cd /tmp/excal
npm init -y >/dev/null && npm i @excalidraw/utils
cp node_modules/@excalidraw/utils/dist/prod/index.js ./excalidraw-utils.js
```

### 2. Author the scene (`make.html`)

Serve this over http and open it in Chrome. It builds full Excalidraw elements
from tiny `rect` / `text` / `arrow` helpers, then exports with the scene embedded
and stashes the data URL on `window.__png`.

```html
<!doctype html><meta charset="utf-8" />
<div id="status">working…</div>
<script type="module">
  import { exportToBlob } from './excalidraw-utils.js'
  let S = 1
  const seed = () => (S = (S * 1103515245 + 12345) & 0x7fffffff)
  const els = []
  const base = (o) => ({
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    ...o,
  })

  function rect(x, y, w, h, o = {}) {
    els.push(
      base({
        id: 'r' + seed(),
        type: 'rectangle',
        x,
        y,
        width: w,
        height: h,
        roundness: { type: 3 },
        strokeColor: o.stroke || '#1e1e1e',
        backgroundColor: o.bg || 'transparent',
      }),
    )
  }

  function text(x, y, str, o = {}) {
    const fontSize = o.size || 16,
      fontFamily = o.font || 1,
      lh = 1.25
    const lines = str.split('\n'),
      cw = fontFamily === 3 ? 0.62 : 0.55
    const width =
      o.width || Math.max(...lines.map((l) => l.length)) * fontSize * cw
    els.push(
      base({
        id: 't' + seed(),
        type: 'text',
        x,
        y,
        width,
        height: lines.length * fontSize * lh,
        strokeColor: o.color || '#1e1e1e',
        fontSize,
        fontFamily,
        text: str,
        originalText: str,
        textAlign: o.align || 'left',
        verticalAlign: 'top',
        containerId: null,
        lineHeight: lh,
      }),
    )
  }

  function arrow(x1, y1, x2, y2, o = {}) {
    els.push(
      base({
        id: 'a' + seed(),
        type: 'arrow',
        x: x1,
        y: y1,
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        roundness: { type: 2 },
        strokeColor: o.stroke || '#1e1e1e',
        strokeStyle: o.strokeStyle || 'solid',
        points: [
          [0, 0],
          [x2 - x1, y2 - y1],
        ],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: o.startHead || null,
        endArrowhead: o.endHead === null ? null : o.endHead || 'arrow',
      }),
    )
  }

  // ---- your diagram here ----
  text(40, 24, 'My Diagram Title', { size: 30, font: 1 })
  rect(40, 80, 300, 120, { bg: '#e7f5ff', stroke: '#1971c2' })
  text(56, 92, 'A box', { size: 17, font: 1, color: '#1971c2' })
  text(56, 120, 'body line one\nbody line two', { size: 13, font: 3 })
  arrow(190, 200, 190, 260, { stroke: '#1971c2' })
  // ---------------------------

  ;(async () => {
    try {
      const blob = await exportToBlob({
        elements: els,
        files: {},
        mimeType: 'image/png',
        exportPadding: 24,
        appState: {
          exportBackground: true,
          viewBackgroundColor: '#ffffff',
          exportEmbedScene: true,
          exportWithDarkMode: false,
          exportScale: 2,
        },
      })
      const r = new FileReader()
      r.onload = () => {
        window.__png = r.result
        status.textContent = 'DONE'
      }
      r.readAsDataURL(blob)
    } catch (e) {
      window.__err = String(e.stack || e)
      status.textContent = 'ERR:' + window.__err
    }
  })()
</script>
```

Conventions used above: `font` 1 = Virgil (hand-drawn, for titles/labels),
3 = Cascadia mono (for code-ish body text). Position text manually (top-left,
`textAlign:"left"`) inside boxes — bound/auto-centered text needs the editor's
layout pass, which the headless export skips. `exportScale:2` gives a crisp raster.
Palette that reads well: blue `#1971c2`/`#e7f5ff`, purple `#7048e8`/`#f3f0ff`,
green `#2f9e44`/`#ebfbee`, amber `#f08c00`/`#fff3bf`.

### 3. Render in headless Chrome

Any headless-Chrome path works (the `eye` browser tool, or Playwright/Puppeteer).
Serve the dir, open `make.html`, poll until `#status` reads `DONE`, then read
`window.__png` and decode it. Sketch with the `eye` tool:

```bash
(cd /tmp/excal && python3 -m http.server 8899 >/dev/null 2>&1 &)
curl -s localhost:9223/navigate -H 'Content-Type: application/json' \
  -d '{"url":"http://localhost:8899/make.html","wait":"load","snapshot":false}' >/dev/null
# poll #status for DONE, then:
curl -s localhost:9223/eval -H 'Content-Type: application/json' \
  -d '{"expression":"window.__png"}' -o png.json
node -e 'const fs=require("fs");const u=JSON.parse(fs.readFileSync("png.json","utf8")).result;
  fs.writeFileSync("docs/<topic>-<name>.excalidraw.png", Buffer.from(u.split(",")[1],"base64"));'
```

### 4. Verify the scene round-trips (don't skip this)

Confirms you shipped an _editable_ PNG, not a flat one. Decode the
`application/vnd.excalidraw+json` `tEXt` chunk, inflate, and parse. This also
writes the `.excalidraw` source to commit alongside.

```bash
node -e '
const fs=require("fs"), zlib=require("zlib");
const buf=fs.readFileSync("docs/<topic>-<name>.excalidraw.png");
let off=8, found=null;
while(off<buf.length){ const len=buf.readUInt32BE(off), type=buf.toString("ascii",off+4,off+8),
  data=buf.slice(off+8,off+8+len);
  if(type==="tEXt"){ const z=data.indexOf(0);
    if(data.toString("latin1",0,z)==="application/vnd.excalidraw+json") found=data.toString("latin1",z+1); }
  off+=12+len; }
if(!found){ console.error("NO EMBED — this is a flat PNG, fix exportEmbedScene"); process.exit(1); }
const env=JSON.parse(found); const bytes=Buffer.from(env.encoded,"latin1");
let out; try{out=zlib.inflateSync(bytes);}catch(e){out=zlib.inflateRawSync(bytes);}
const scene=JSON.parse(out.toString("utf8"));
console.log("OK:", scene.type, "|", scene.elements.length, "elements");
fs.writeFileSync("docs/<topic>-<name>.excalidraw", JSON.stringify(scene,null,2));
'
```

### 5. Reference + commit

```markdown
> Drag onto excalidraw.com to edit, then re-export with "Embed scene" on.

![My Diagram](./<topic>-<name>.excalidraw.png)
```

Commit the `.png` **and** the `.excalidraw` source. Clean up the scratch dir and
kill the http server when done.

## Editing an existing diagram

Drag the committed `.excalidraw.png` (or open the `.excalidraw`) onto
excalidraw.com, edit, and re-export as PNG with **"Embed scene"** enabled — or
tweak the `make.html` generator and re-run the recipe. Either way, keep the two
files (`.png` + `.excalidraw`) in sync.
