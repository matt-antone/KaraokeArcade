#!/usr/bin/env python3
"""Build the docs pages from docs/content into site/docs.

The home page is hand-written HTML. The docs are the Hugo markdown, run through
`marked` after the Hugo shortcodes are swapped for plain HTML, then wrapped in
the site's shell. Run from the repo root: python3 site/build.py
"""
import html
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'docs/content'
OUT = ROOT / 'site/docs'
IMG = OUT / 'img'

PAGES = [
    ('index.html', 'Getting started', CONTENT / 'docs/getting-started/index.md'),
    ('app.html', 'The app', CONTENT / 'docs/karaokearcade-app/index.md'),
    ('server.html', 'The server', CONTENT / 'docs/karaokearcade-server/index.md'),
    ('faq.html', 'FAQ', None),
]

# Hugo ref targets to site pages
REFS = {
    'docs/getting-started': 'index.html',
    'docs/karaokearcade-app': 'app.html',
    'docs/karaokearcade-server': 'server.html',
    'faq': 'faq.html',
    'faq.md': 'faq.html',
}

ICON_EXTERNAL = ('<svg class="icon external" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14'
                 'c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>')
ICON_INFO = ('<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 '
             '10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>')
ICON_WARN = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16"/></svg>'


def front_matter(text):
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(':')
        if _ and not line.startswith((' ', '-')):
            meta[k.strip()] = v.strip().strip('"\'')
    return meta, text[m.end():]


def ref(target):
    page, _, anchor = target.partition('#')
    page = page.rstrip('/')
    return REFS[page] + ('#' + anchor if anchor else '')


def shortcodes(md):
    md = md.replace('{{% icon-external %}}', ICON_EXTERNAL)
    md = md.replace('{{% icon-info %}}', ICON_INFO)
    md = md.replace('{{% icon-warn %}}', ICON_WARN)
    md = md.replace('{{% baseurl %}}', '/')
    md = re.sub(r'\{\{<\s*ref\s+"([^"]+)"\s*>\}\}', lambda m: ref(m.group(1)), md)
    md = re.sub(r'\{\{<\s*highlight\s+(\w+)\s*>\}\}\n?', lambda m: f'```{m.group(1)}\n', md)
    md = re.sub(r'\n?\{\{<\s*/highlight\s*>\}\}', '\n```', md)

    def img(m):
        src = m.group(1) if m.group(1).startswith('new/') else Path(m.group(1)).name
        alt = html.escape(m.group(2))
        # a third argument marks a TV screen: drawn wide, not as a phone
        cls = ' class="wide"' if m.group(3) else ''
        return f'<figure{cls}><img src="img/{src}" alt="{alt}" loading="lazy"><figcaption>{alt}</figcaption></figure>'
    md = re.sub(r'\{\{[%<]\s*img\s+"([^"]+)"\s+"([^"]+)"(?:\s+"([^"]+)")?\s*/[%>]\}\}', img, md)
    return md


def marked(md):
    return subprocess.run(['npx', '-y', 'marked', '--gfm'], input=md, capture_output=True, text=True, check=True).stdout


def anchorize(text):
    # Hugo's anchorize: lower case, spaces to hyphens, drop what is not a word character or a hyphen
    text = re.sub(r'<[^>]+>', '', text).lower().replace(' ', '-')
    return re.sub(r'[^\w-]', '', text)


def heading_ids(body):
    heads = []

    def add(m):
        level, inner = m.group(1), m.group(2)
        hid = anchorize(inner)
        heads.append((int(level), hid, re.sub(r'<[^>]+>', '', inner)))
        return f'<h{level} id="{hid}">{inner}</h{level}>'
    return re.sub(r'<h([23])>(.*?)</h\1>', add, body), heads


def faq_body():
    entries = []
    for f in sorted((CONTENT / 'faq').glob('*.md')):
        if f.name == '_index.md':
            continue
        meta, md = front_matter(f.read_text())
        entries.append((meta['category'], int(meta['weight']), f.stem, meta['title'], md))
    order = ['General', 'Networking', 'Troubleshooting']
    entries.sort(key=lambda e: (order.index(e[0]), e[1]))
    out, heads, cat = [], [], None
    for c, _, slug, title, md in entries:
        if c != cat:
            cat = c
            hid = anchorize(c)
            out.append(f'<h2 id="{hid}">{c}</h2>')
            heads.append((2, hid, c))
        out.append(f'<h3 id="{slug}">{html.escape(title)}</h3>')
        out.append(marked(shortcodes(md)))
    return '\n'.join(out), heads


def shell(title, current, body, heads):
    nav = '\n'.join(
        f'<a href="{href}"{" aria-current=\"page\"" if href == current else ""}>{name}</a>'
        for href, name, _ in PAGES)
    toc = '\n'.join(f'<a href="#{hid}" class="l{level}">{html.escape(text)}</a>' for level, hid, text in heads if level == 2)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} · KaraokeArcade</title>
<link rel="icon" href="../favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Chakra+Petch:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="docs.css">
</head>
<body>
<header class="top">
<div class="wrap">
<a class="logo" href="../"><img src="../assets/logo.svg" alt="KaraokeArcade"></a>
<nav>
<a href="../#roster">SINGERS</a>
<a href="../#night">THE NIGHT</a>
<a href="./" aria-current="page">DOCS</a>
<a class="git" href="https://github.com/matt-antone/KaraokeArcade">GITHUB</a>
</nav>
</div>
</header>
<div class="wrap docs">
<nav class="side" aria-label="Docs">
<p class="kicker">MANUAL</p>
{nav}
</nav>
<article>
<h1>{html.escape(title)}</h1>
{body}
</article>
<nav class="toc" aria-label="On this page">
<p class="kicker">ON THIS PAGE</p>
{toc}
</nav>
</div>
<footer>
<div class="wrap">
<span>Self-hosted. No ads. No tracking. ISC license. A fork of Karaoke Eternal.</span>
<a href="https://github.com/matt-antone/KaraokeArcade">github.com/matt-antone/KaraokeArcade</a>
</div>
</footer>
</body>
</html>
'''


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(exist_ok=True)
    for p in (CONTENT / 'docs/karaokearcade-app').glob('app-*'):
        shutil.copy(p, IMG / p.name)
    for href, title, src in PAGES:
        if src is None:
            body, heads = faq_body()
        else:
            _, md = front_matter(src.read_text())
            body, heads = heading_ids(marked(shortcodes(md)))
        (OUT / href).write_text(shell(title, href, body, heads))
        print('wrote', OUT / href)


if __name__ == '__main__':
    main()
