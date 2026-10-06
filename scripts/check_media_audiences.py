#!/usr/bin/env python3
"""Check audience coverage, rendered labels, filter counts and live navigation."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,parse_qs,unquote
import collections,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
class Markup(HTMLParser):
 def __init__(self):super().__init__();self.tags=[]
 def handle_starttag(self,tag,attrs):self.tags.append((tag,dict(attrs)))
def check():
 data=json.loads((ROOT/'media/audiences.json').read_text());roles=data['roles'];articles=data['articles'];errors=[]
 actual={str(p.relative_to(ROOT)) for p in (ROOT/'media').rglob('*.html') if re.search(r'<article\b[^>]*class="[^"]*art-body',p.read_text())}
 if actual!=set(articles):errors.append('Article inventory does not match audience assignments')
 if set(roles)!={'it','hr','operations','executive'}:errors.append('Expected four approved audiences')
 for path,role in articles.items():
  if role not in roles:errors.append(path+': unknown role');continue
  text=(ROOT/path).read_text();head=re.search(r'<header class="art-head">.*?</header>',text,re.S)
  if not head:errors.append(path+': missing article header');continue
  tags=re.findall(r'<p class="article-audience"[^>]*>.*?</p>',text,re.S)
  if len(tags)!=1 or tags[0] not in head[0]:errors.append(path+': expected one audience label in header');continue
  if f'?audience={role}#articles' not in tags[0] or roles[role] not in tags[0]:errors.append(path+': label differs from assignment')
  if '/media/audience-filter.css?' not in text:errors.append(path+': audience stylesheet missing')
 groups=['gyomuzu','kenshu','shigyo','interview','security','shokei']
 hubs=['media/index.html']+[f'media/{g}/index.html' for g in groups]
 for hub in hubs:
  text=(ROOT/hub).read_text();parser=Markup();parser.feed(text)
  ids=[a['id'] for t,a in parser.tags if 'id' in a]
  if len(ids)!=len(set(ids)):errors.append(hub+': duplicate IDs')
  if sum('data-audience-catalog' in a for t,a in parser.tags)!=1:errors.append(hub+': expected one catalog')
  cards=[a for t,a in parser.tags if 'data-audience-item' in a]
  paths=[]
  for card in cards:
   rel=unquote(urlsplit(card['href']).path)
   path=ROOT/rel.lstrip('/') if rel.startswith('/') else (ROOT/hub).parent/rel
   if not path.suffix:path=path.with_suffix('.html')
   key=str(path.relative_to(ROOT));paths.append(key)
   if key not in articles or card.get('data-audience')!=articles.get(key):errors.append(hub+': mislabeled card '+key)
  expected={p for p in articles if (p=='media/token-management.html' or p.split('/')[1] in groups)} if hub=='media/index.html' else {p for p in articles if p.startswith(str(Path(hub).parent)+'/')}
  if set(paths)!=expected or len(paths)!=len(set(paths)):errors.append(hub+': missing, duplicated or extra article cards')
  counts=collections.Counter(articles[p] for p in paths if p in articles)
  filters=re.findall(r'<button\b[^>]*data-audience-filter="([^"]+)"[^>]*>.*?<span class="audience-count">(\d+)</span></button>',text,re.S)
  if dict(filters)!={k:str(len(paths) if k=='all' else counts[k]) for k in ['all',*roles]}:errors.append(hub+': incorrect filter counts')
  if len(filters)!=5:errors.append(hub+': duplicate/missing filters')
  if '/media/audience-filter.js?' not in text or '/media/audience-filter.css?' not in text:errors.append(hub+': assets missing')
  if 'aria-live="polite"' not in text or 'class="audience-empty"' not in text:errors.append(hub+': result or empty state missing')
 print(json.dumps({'articles':len(articles),'hubs':len(hubs),'errors':errors},ensure_ascii=False,indent=2))
 return bool(errors)
if __name__=='__main__':sys.exit(check())
