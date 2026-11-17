// Renders .dc.html design artboards into standalone static HTML pages.
// Usage: node build-static.js <srcProjectDir> <outDir>
const fs = require('fs');
const path = require('path');

const [, , SRC, OUT] = process.argv;

const PAGES = {
  'D-Login.dc.html': { file: 'index.html', title: 'Вход' },
  'D-Feed.dc.html': { file: 'feed.html', title: 'Лента' },
  'D-Listing.dc.html': { file: 'listing.html', title: 'Объявление' },
  'D-Map.dc.html': { file: 'map.html', title: 'Карта' },
  'D-Quiz.dc.html': { file: 'quiz.html', title: 'Анкета быта' },
  'D-Swipe.dc.html': { file: 'swipe.html', title: 'Поиск соседа' },
  'D-Match.dc.html': { file: 'match.html', title: 'Коннект' },
  'D-Chats.dc.html': { file: 'chats.html', title: 'Коннекты' },
  'D-Profile.dc.html': { file: 'profile.html', title: 'Профиль' },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function lookup(scope, expr) {
  const p = expr.trim();
  if (p === 'true') return true;
  if (p === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
  let v = scope;
  for (const k of p.split('.')) {
    if (v == null) return undefined;
    v = v[k];
  }
  return v;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : null;
}

function holeExpr(s) {
  const m = s && s.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  return m ? m[1] : null;
}

// Find the matching close tag for a control element, honoring nesting.
function findClose(src, name, from) {
  const re = new RegExp('<' + name + '[\\s>]|</' + name + '>', 'g');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(src))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return m.index;
  }
  throw new Error('Unclosed <' + name + '>');
}

function expand(src, scope) {
  let out = '';
  let i = 0;
  const open = /<(sc-for|sc-if)\b[^>]*>/g;
  let m;
  while ((m = open.exec(src))) {
    out += src.slice(i, m.index);
    const name = m[1];
    const bodyStart = m.index + m[0].length;
    const closeAt = findClose(src, name, bodyStart);
    const body = src.slice(bodyStart, closeAt);
    if (name === 'sc-if') {
      const cond = lookup(scope, holeExpr(attr(m[0], 'value')));
      if (cond) out += expand(body, scope);
    } else {
      const list = lookup(scope, holeExpr(attr(m[0], 'list'))) || [];
      const as = attr(m[0], 'as');
      list.forEach((item, idx) => {
        out += expand(body, Object.assign({}, scope, { [as]: item, $index: idx }));
      });
    }
    i = closeAt + ('</' + name + '>').length;
    open.lastIndex = i;
  }
  out += src.slice(i);
  return out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, e) => {
    const v = lookup(scope, e);
    return v == null ? '' : esc(v);
  });
}

function renderVals(html) {
  const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  class DCLogic { constructor() { this.props = {}; this.state = {}; } setState() {} }
  const Component = new Function('DCLogic', m[1] + '\nreturn Component;')(DCLogic);
  return new Component().renderVals();
}

function build(srcName, meta) {
  const html = fs.readFileSync(path.join(SRC, srcName), 'utf8');
  const vals = renderVals(html);
  const xdc = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const helmet = (xdc.match(/<helmet>([\s\S]*?)<\/helmet>/) || ['', ''])[1];
  let body = expand(xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, ''), vals);
  body = body.replace(/href="([A-Za-z-]+\.dc\.html)"/g, (_, f) => 'href="' + (PAGES[f] ? PAGES[f].file : '#') + '"');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Квартирант — ${meta.title}</title>
${helmet.trim()}
<link rel="stylesheet" href="assets/app.css">
</head>
<body>
<div class="stage" id="stage">
${body.trim()}
</div>
<script src="assets/app.js"></script>
</body>
</html>
`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const [src, meta] of Object.entries(PAGES)) {
  fs.writeFileSync(path.join(OUT, meta.file), build(src, meta));
  console.log('built', meta.file);
}
