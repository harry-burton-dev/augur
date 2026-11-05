"""Migration check for this run (check.py can't do it): load FROM folder's schema+seed, apply TO folder's migrate.sql,
then run TO folder's questions.sql (same comparison as check.py). Usage: check-migration.py <from folder> <to folder>"""
import pathlib, re, sqlite3, sys
def norm(rows): return ", ".join(str(v) for r in rows for v in r)
src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
db = sqlite3.connect(":memory:")
for p in (src / "schema.sql", src / "seed.sql"): db.executescript(p.read_text())
try:
    db.executescript((dst / "migrate.sql").read_text())
    print("migrate: applied")
except sqlite3.Error as e:
    print(f"migrate: ERROR {e}"); sys.exit(2)
text = (dst / "questions.sql").read_text()
blocks = re.split(r"(?m)^-- (Q\d+):", text)[1:]
passed = 0
for qid, body in zip(blocks[0::2], blocks[1::2]):
    title, _, rest = body.partition("\n")
    m = re.search(r"(?m)^-- expect:\s*(.*)$", rest)
    expect = m.group(1).strip() if m else ""
    sql = "\n".join(l for l in rest.splitlines() if not l.strip().startswith("--")).strip()
    try: got = norm(db.execute(sql).fetchall())
    except sqlite3.Error as e: got = f"ERROR {e}"
    ok = got == expect; passed += ok
    print(f"{'PASS' if ok else 'FAIL'} {qid}\n     got:    {got}")
print(f"{passed}/{len(blocks)//2} passed after migration")
