#!/usr/bin/env python3
"""Applies the second, page-by-page verification pass (migration/review_pass2_fixes.json) to the Hub.
Sets mechanisms_14, benefits_18 (the 17 final benefits), recode_status and appends the evidence to coding_notes.
Legacy columns untouched. Dry run by default; --apply writes. Needs: pip install requests"""
import json
import sys
import requests

URL = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}


def main(apply):
    fixes = json.load(open("review_pass2_fixes.json", encoding="utf-8"))
    live = requests.get(f"{URL}/programmes", params={"select": "id,programme_name,industry,mechanisms_14,benefits_18,coding_notes", "limit": "2000"}, headers=H, timeout=60).json()
    by = {}
    for p in live:
        by.setdefault(p["programme_name"], []).append(p)
    n = 0
    for name, f in fixes.items():
        rows = by.get(name, [])
        if len(rows) != 1:
            print("SKIP (not exactly one row):", name, len(rows)); continue
        p = rows[0]
        note = ("Review pass 2 (page by page) 2026-10-02 | " + f["note"] + (" || Earlier: " + (p.get("coding_notes") or "")[:600] if p.get("coding_notes") else ""))[:2500]
        patch = {"mechanisms_14": f["m"], "benefits_18": f["b"], "recode_status": f["status"], "coding_notes": note}
        changed = patch["mechanisms_14"] != (p["mechanisms_14"] or []) or patch["benefits_18"] != (p["benefits_18"] or [])
        print(("WRITE " if apply else "would write ") + name, "(coding changed)" if changed else "(status/notes only)")
        if apply:
            r = requests.patch(f"{URL}/programmes", params={"id": f"eq.{p['id']}"}, json=patch, headers=H, timeout=60)
            if not r.ok:
                print("  FAILED", r.status_code, r.text[:150])
        n += 1
    print(n, "programmes", "APPLIED" if apply else "DRY RUN")


if __name__ == "__main__":
    main("--apply" in sys.argv)
