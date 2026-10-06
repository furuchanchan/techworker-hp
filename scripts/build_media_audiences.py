#!/usr/bin/env python3
"""Render audience labels and catalogs from the reviewed media/audiences.json.
Run after article and hub generation: python3 scripts/build_media_audiences.py
"""
from pathlib import Path
from urllib.parse import urlsplit
import collections
import html
import json
import re
import sys

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'media/audiences.json').read_text())
ROLES = DATA['roles']
ARTICLES = DATA['articles']
MEDIA = {'gyomuzu': '業務図ラボ', 'kenshu': 'AI研修・導入ラボ', 'shigyo': '士業AIジャーナル', 'interview': 'AIインタビュー・ラボ', 'security': 'AIセキュリティ・ラボ', 'shokei': '事業承継AIラボ'}
VERSION = '20261006-media-only'

def required(pattern, text, label):
    m = re.search(pattern, text, re.S)
    if not m:
        raise ValueError(f'{label}: expected markup missing')
    return m

def assets(text, catalog=False):
    text = re.sub(r'\n?<link rel="stylesheet" href="/media/audience-filter.css\?v=[^"]+">', '', text)
    text = re.sub(r'\n?<script src="/media/audience-filter.js\?v=[^"]+" defer></script>', '', text)
    tags = f'<link rel="stylesheet" href="/media/audience-filter.css?v={VERSION}">\n'
    if catalog:
        tags += f'<script src="/media/audience-filter.js?v={VERSION}" defer></script>\n'
    return text.replace('</head>', tags + '</head>', 1)

def controls(items):
    counts = collections.Counter(ARTICLES[p] for p in items)
    buttons = []
    for key, label in [('all', 'すべて'), *ROLES.items()]:
        count = len(items) if key == 'all' else counts[key]
        buttons.append(f'<button type="button" data-audience-filter="{key}" data-audience-label="{label}" aria-pressed="{str(key == "all").lower()}" aria-controls="audience-results">{label}<span class="audience-count">{count}</span></button>')
    return '<div class="audience-controls" role="group" aria-label="対象読者で絞り込む" hidden>' + ''.join(buttons) + '</div>\n' + f'<p class="audience-result" role="status" aria-live="polite" aria-atomic="true">すべて：{len(items)}件</p>\n'

def ending():
    return '<p class="audience-empty" hidden>このメディアには、選んだ読者向けの記事がまだありません。<br><a href="/media/#media">ほかのメディアを見る</a></p><button type="button" class="audience-more" aria-controls="audience-results" hidden>もっと見る</button>'

def tag(role):
    return f'<span class="audience-tag">{ROLES[role]}</span>'

def build():
    actual = {str(p.relative_to(ROOT)) for p in (ROOT / 'media').rglob('*.html') if re.search(r'<article\b[^>]*class="[^"]*art-body', p.read_text())}
    if set(ARTICLES) != actual:
        raise ValueError(f'Audience inventory mismatch: unclassified={sorted(actual-set(ARTICLES))}, stale={sorted(set(ARTICLES)-actual)}')
    if set(ARTICLES.values()) - set(ROLES):
        raise ValueError('Unknown audience role')
    changes = {}
    for path, role in ARTICLES.items():
        text = (ROOT / path).read_text()
        text = re.sub(r'\s*<p class="article-audience"[^>]*>.*?</p>\s*', '', text, flags=re.S)
        head = required(r'<header class="art-head">.*?</header>', text, path)
        group = path.split('/')[1]
        reader = f'<a href="/media/{group}/?audience={role}#articles">{ROLES[role]}</a>' if group in MEDIA else tag(role)
        label = f'\n<p class="article-audience"><span class="article-audience-label">主な対象読者</span>{reader}</p>\n'
        updated = head[0][:-len('</header>')].rstrip() + label + '</header>'
        changes[path] = assets(text[:head.start()] + updated + text[head.end():])

    listed = set()
    for media in MEDIA:
        path = f'media/{media}/index.html'
        text = (ROOT / path).read_text()
        container = required(r'<div\b[^>]*class="(?:jz-list|jz-cards|lb-cards)[^"]*"[^>]*>', text, path)
        start = text.rfind('<section', 0, container.start())
        end = text.index('</section>', container.end()) + len('</section>')
        section = text[start:end]
        # Remove only markup rendered by this script on a previous run.
        section = re.sub(r'<div class="audience-controls".*?</div>\s*<p class="audience-result".*?</p>\s*', '', section, flags=re.S)
        section = re.sub(r'<p class="audience-empty".*?</p><button[^>]*class="audience-more".*?</button>', '', section, flags=re.S)
        section = re.sub(r'<span class="audience-tag">.*?</span>', '', section, flags=re.S)
        section = re.sub(r' (?:data-audience-catalog|data-audience-item)(?:="[^"]*")?', '', section)
        section = re.sub(r' data-audience="[^"]*"', '', section)
        section = re.sub(r' id="(?:articles|audience-results)"', '', section)
        members = []
        def card(match):
            fragment = match[0]
            href = required(r'href="([^"]+)"', fragment, path)[1]
            part = urlsplit(html.unescape(href)).path
            article_path = f'media/{media}/{part}'
            if not article_path.endswith('.html'):
                article_path += '.html'
            if article_path not in ARTICLES:
                raise ValueError(f'{path}: unclassified card {href}')
            if article_path in members:
                raise ValueError(f'{path}: duplicate card {href}')
            members.append(article_path)
            role = ARTICLES[article_path]
            fragment = fragment.replace('<a ', f'<a data-audience-item data-audience="{role}" ', 1)
            # Put the label inside the card's existing text cell, preserving its grid.
            pattern = r'(<(?:div|span) class="(?:l-desc|c-meta|d)"[^>]*>.*?</(?:div|span)>)'
            fragment, count = re.subn(pattern, lambda m: m[0] + tag(role), fragment, count=1, flags=re.S)
            if count != 1:
                raise ValueError(f'{path}: card text cell not found: {href}')
            return fragment
        section = re.sub(r'<a\b[^>]*>.*?</a>', card, section, flags=re.S)
        listed.update(members)
        section = section.replace('<section ', '<section id="articles" data-audience-catalog ', 1)
        container2 = required(r'<div\b[^>]*class="(?:jz-list|jz-cards|lb-cards)[^"]*"[^>]*>', section, path)
        new_container = container2[0].replace('<div ', '<div id="audience-results" ', 1)
        section = section[:container2.start()] + controls(members) + new_container + section[container2.end():]
        section = section.replace('</section>', ending() + '</section>')
        changes[path] = assets(text[:start] + section + text[end:], catalog=True)

    # Archived media remain reachable at their existing article URLs but are not reintroduced into active navigation.
    expected = {p for p in ARTICLES if p.split('/')[1] in MEDIA}
    if listed != expected:
        raise ValueError(f'Hub coverage mismatch: missing={sorted(expected-listed)}, extra={sorted(listed-expected)}')
    # All inventory and markup checks pass before the first write.
    changed = 0
    for path, text in changes.items():
        target = ROOT / path
        if target.read_text() != text:
            target.write_text(text);changed += 1
    print(json.dumps({'articles': len(ARTICLES), 'listed': len(listed), 'hubs': len(MEDIA), 'changed_files': changed, 'listed_roles': dict(collections.Counter(ARTICLES[p] for p in listed))}, ensure_ascii=False))

if __name__ == '__main__':
    build()
