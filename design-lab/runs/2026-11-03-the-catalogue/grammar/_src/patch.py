#!/usr/bin/env python3
"""Apply exact text replacements to one template: patch.py <file> <pairs.json>."""
import json, sys
p, pairs = sys.argv[1], json.load(open(sys.argv[2]))
s = open(p).read()
for a, b in pairs:
    if a not in s:
        sys.exit('missing: ' + a[:80])
    s = s.replace(a, b)
open(p, 'w').write(s)
print('patched', len(pairs))
