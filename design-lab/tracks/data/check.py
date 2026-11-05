"""Run a data-track variant: load schema.sql + seed.sql, run questions.sql,
compare each result with its `-- expect:` line. Usage: check.py <folder>"""
import pathlib, re, sqlite3, sys

def norm(rows):
    flat = [str(v) for r in rows for v in r]
    return ", ".join(flat)

def main(folder):
    d = pathlib.Path(folder)
    db = sqlite3.connect(":memory:")
    for name in ("schema.sql", "seed.sql", "migrate.sql"):
        p = d / name
        if p.exists() and (name != "migrate.sql" or "--apply-migrate" in sys.argv):
            db.executescript(p.read_text())
    text = (d / "questions.sql").read_text()
    blocks = re.split(r"(?m)^-- (Q\d+):", text)[1:]
    passed = 0
    for qid, body in zip(blocks[0::2], blocks[1::2]):
        title, _, rest = body.partition("\n")
        m = re.search(r"(?m)^-- expect:\s*(.*)$", rest)
        expect = m.group(1).strip() if m else ""
        sql = "\n".join(l for l in rest.splitlines() if not l.strip().startswith("--")).strip()
        try:
            got = norm(db.execute(sql).fetchall()) if sql else "(no query)"
        except sqlite3.Error as e:
            got = f"ERROR {e}"
        ok = got == expect
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'} {qid}:{title.strip()}\n     expect: {expect}\n     got:    {got}")
    print(f"{passed}/{len(blocks)//2} passed")
    return 0 if passed == len(blocks) // 2 else 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
