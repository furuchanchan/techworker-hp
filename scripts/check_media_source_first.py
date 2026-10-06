#!/usr/bin/env python3
"""Check source placement and local assets before publishing selected media articles.

Usage: python3 scripts/check_media_source_first.py media/gyomuzu/example.html [...]
This checks document structure; editors must separately verify facts and reuse rights.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import html
import json
import re
import sys
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]


class Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []
        self.links = []
        self.descriptions = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        key = attrs.get('name') or attrs.get('property')
        if tag == 'meta' and key in ('description', 'og:description', 'twitter:description'):
            self.descriptions[key] = attrs.get('content', '').strip()
        if tag == 'img':
            self.images.append(attrs)
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])


def text(markup):
    return html.unescape(re.sub(r'<[^>]*>', '', markup)).strip()


def schema_nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from schema_nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from schema_nodes(child)


def local_path(page, value):
    url = urlsplit(html.unescape(value))
    if url.netloc and url.netloc not in ('techworker.co.jp', 'www.techworker.co.jp'):
        return None
    if url.scheme and url.scheme not in ('http', 'https'):
        return None
    path = unquote(url.path)
    return (ROOT / path.lstrip('/') if path.startswith('/') else page.parent / path).resolve()


def check(page):
    issues = []
    markup = page.read_text()
    head = Tags()
    head.feed(markup.split('</head>', 1)[0])
    summary = head.descriptions.get('description', '')
    if not summary:
        issues.append('article summary is missing')
    for field, value in head.descriptions.items():
        if value != summary:
            issues.append('article summary differs in ' + field)
    if len(re.findall(r'<h1\b', markup)) != 1:
        issues.append('article must have exactly one main heading')
    header = re.search(r'<header\b[^>]*class=["\']art-head["\'][^>]*>(.*?)</header>', markup, re.S)
    if not header or not all(marker in header[1] for marker in ('<h1', 'class="dek"', 'class="a-meta"')):
        issues.append('article header is incomplete')
    for identifier, count in Counter(re.findall(r'\bid=["\']([^"\']+)', markup)).items():
        if count > 1:
            issues.append('duplicate element id: ' + identifier)
    found = re.search(r'<article\b[^>]*>(.*?)</article>', markup, re.S)
    if not found:
        return ['article body missing']
    body = found[1]
    source = re.search(r'class=["\'][^"\']*\bsource-(?:figure|lead|quote)\b[^"\']*["\']', body)
    if not source:
        issues.append('source material must appear in the opening explanation')
    else:
        if len(text(body[:source.start()])) > 700:
            issues.append('source material appears after a long introduction')
        cta = re.search(r'class=["\'][^"\']*\b(?:mid-cta|inline-dx-cta)\b', body)
        if cta and cta.start() < source.start():
            issues.append('first call to action appears before source material')
    if re.search(r'<(?:img|div|figure)\b[^>]*class=["\'][^"\']*\b(?:daily-cover|art-cover(?:-[\w-]+)?)\b', markup):
        issues.append('decorative cover duplicates the opening source visual')

    for quote in re.findall(r'<blockquote\b[^>]*class=["\'][^"\']*source-quote[^"\']*["\'][^>]*>.*?</blockquote>', body, re.S):
        first = re.search(r'<p\b[^>]*>(.*?)</p>', quote, re.S)
        first_text = text(first[1]) if first else ''
        english = re.search(r'lang=["\']en["\']', quote) or (
            re.search(r'[A-Za-z]{3,}', first_text) and not re.search(r'[ぁ-んァ-ン一-龯]', first_text))
        if english:
            translation = re.search(r'<p\b[^>]*class=["\'][^"\']*source-translation[^"\']*["\'][^>]*>(.*?)</p>', quote, re.S)
            translated_text = re.sub(r'<span\b[^>]*class="source-label"[^>]*>.*?</span>', '', translation[1], flags=re.S) if translation else ''
            if not translation or '日本語訳' not in text(translation[1]) or not re.search(r'[ぁ-んァ-ン一-龯]', text(translated_text)):
                issues.append('English source quote needs a labeled Japanese translation')

    tags = Tags()
    tags.feed(body)
    if not tags.images:
        issues.append('no explanatory image in article body')
    for image in tags.images:
        if not image.get('alt'):
            issues.append('image is missing meaningful alt text: ' + image.get('src', ''))
        if not image.get('width') or not image.get('height'):
            issues.append('image dimensions missing: ' + image.get('src', ''))
        asset = local_path(page, image.get('src', ''))
        if asset is not None and not asset.is_file():
            issues.append('image file missing: ' + image.get('src', ''))

    for figure in re.findall(r'<figure\b[^>]*class=["\'][^"\']*source-figure[^"\']*["\'][^>]*>.*?</figure>', body, re.S):
        parsed = Tags()
        parsed.feed(figure)
        if parsed.images:
            image = local_path(page, parsed.images[0].get('src', ''))
            if image is not None and not any(local_path(page, a) == image for a in parsed.links):
                issues.append('source image needs a full-size image link')
        caption = re.search(r'<figcaption\b[^>]*>(.*?)</figcaption>', figure, re.S)
        if not caption or not re.search(r'<a\b[^>]+href=', caption[1]):
            issues.append('source figure needs an attribution link in its caption')
        if caption and '確認' not in text(caption[1]):
            issues.append('source figure needs its verification date')

    ids = set(re.findall(r'\bid=["\']([^"\']+)', body))
    for toc in re.findall(r'<nav\b[^>]*class=["\']art-toc["\'][^>]*>(.*?)</nav>', markup, re.S):
        for anchor in re.findall(r'href=["\']#([^"\']+)', toc):
            if anchor not in ids:
                issues.append('table of contents target missing: ' + anchor)
    for match in re.finditer(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', markup, re.S):
        try:
            for node in schema_nodes(json.loads(match[1])):
                kinds = node.get('@type', [])
                if isinstance(kinds, str):
                    kinds = [kinds]
                if any(kind in ('Article', 'BlogPosting', 'NewsArticle') for kind in kinds):
                    if node.get('description', '').strip() != summary:
                        issues.append('article summary differs in JSON-LD')
        except json.JSONDecodeError:
            issues.append('invalid JSON-LD')
    return issues


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip())
        return 2
    results = []
    for value in sys.argv[1:]:
        page = Path(value)
        if not page.is_absolute():
            page = ROOT / page
        issues = check(page) if page.is_file() else ['article file missing']
        results.append({'article': value, 'issues': issues})
    print(json.dumps({'checks': results, 'fact_and_reuse_rights_review': 'separate editorial review required'}, ensure_ascii=False, indent=2))
    return int(any(r['issues'] for r in results))


if __name__ == '__main__':
    sys.exit(main())
