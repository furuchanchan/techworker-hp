#!/usr/bin/env python3
"""Validate one know-how evidence card before article drafting/publication.
Private cards belong outside the public website tree. This validates traceability,
not the truth, publication permission, or product comparison implied by a claim.
Usage: python3 scripts/check_media_evidence.py /absolute/path/candidate.json
"""
import argparse
import hashlib
import json
from pathlib import Path


def check(card, base):
    issues = []
    for name in ('candidate_id', 'media', 'reader', 'problem', 'change', 'result',
                 'reproduce', 'limits', 'practice_area', 'tools_used', 'actor'):
        if not card.get(name):
            issues.append('missing: ' + name)
    if card.get('content_type') != 'knowhow':
        issues.append('this checker requires content_type=knowhow')
    if card.get('publication_permission') not in ('public', 'authorized', 'sanitized_authorized'):
        issues.append('publication permission not confirmed')
    sources = card.get('source_refs', [])
    if not isinstance(sources, list):
        return issues + ['source_refs must be an array']
    ids = [s.get('id') for s in sources if isinstance(s, dict)]
    if len(ids) != len(sources) or not all(ids) or len(ids) != len(set(ids)):
        issues.append('source IDs must be unique and nonempty')
    verified = {}
    for source in sources:
        if not isinstance(source, dict):
            continue
        sid = source.get('id')
        if not source.get('ref') or not source.get('verified_at'):
            issues.append('source missing ref/verified_at: ' + str(sid))
            continue
        if source.get('kind') in ('work_artifact', 'execution_result'):
            path = Path(source['ref'])
            if not path.is_absolute():
                path = base / path
            digest = source.get('sha256')
            if not path.is_file() or not digest:
                issues.append('source missing local evidence/hash: ' + str(sid))
                continue
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                issues.append('source changed since review: ' + str(sid))
                continue
        verified[sid] = source
    kinds = {s.get('kind') for s in verified.values()}
    for kind in ('adopted_decision', 'work_artifact', 'execution_result'):
        if kind not in kinds:
            issues.append('required verified source kind missing: ' + kind)
    claims = card.get('claims', [])
    if not claims:
        issues.append('claims missing')
    for claim in claims:
        refs = claim.get('source_ids', [])
        if not claim.get('text') or not refs or any(sid not in verified for sid in refs):
            issues.append('claim is not linked to verified sources')
        if claim.get('mode') not in ('observed', 'proposal', 'official_spec'):
            issues.append('claim mode must distinguish observation/proposal/spec')
        if claim.get('mode') == 'observed' and not any(verified.get(sid, {}).get('kind') == 'execution_result' for sid in refs):
            issues.append('observed claim needs an execution result')
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('card', type=Path)
    args = parser.parse_args()
    try:
        card = json.loads(args.card.read_text())
        if not isinstance(card, dict):
            raise ValueError('one object is required')
        issues = check(card, args.card.resolve().parent)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        issues = ['invalid card: ' + str(exc)]
    print(json.dumps({'eligible': not issues, 'issues': issues,
                     'editorial_review': 'fact, attribution, public scope and usefulness require separate review'}, ensure_ascii=False, indent=2))
    return int(bool(issues))


if __name__ == '__main__':
    raise SystemExit(main())
