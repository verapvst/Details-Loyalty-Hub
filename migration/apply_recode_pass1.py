#!/usr/bin/env python3
"""Applies the first coding pass (migration/recode_pass1_73.csv) to the Hub.

For rows marked 'Suggested': writes mechanisms_14, benefits_18, recode_status = 'Suggested'
and coding_notes. For rows marked 'note only': writes coding_notes only and leaves
recode_status untouched. Nothing is ever deleted, and existing v3 data is not touched.

Default is a DRY RUN that only prints what would change. Add --apply to write.
A backup of the table before this pass is in
migration/backup_programmes_before_recode_2026-10-01.json.

Usage:
  python3 apply_recode_pass1.py            # dry run
  python3 apply_recode_pass1.py --apply    # write to the live database
Needs: pip install requests
"""
import csv
import sys
import requests

URL = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}


def split(s):
    return [x for x in (s or "").split("; ") if x]


def main(apply):
    rows = list(csv.DictReader(open("recode_pass1_73.csv", encoding="utf-8")))
    done = failed = 0
    for r in rows:
        note = (f"[Auto-pass 2026-10-01, to verify | page: {r['page_status']} | confidence: {r['confidence']}] "
                f"Mechanisms: {r['mechanism_evidence']} | Benefits: {r['benefit_evidence']} | Not documented: {r['not_documented']}")
        if r["flags"]:
            note += f" | FLAGS: {r['flags']}"
        body = {"coding_notes": note[:2500]}
        if r["would_write"] == "Suggested":
            body.update(mechanisms_14=split(r["mechanisms_14"]), benefits_18=split(r["benefits_18"]), recode_status="Suggested")
        print(("APPLY " if apply else "DRY   ") + f"{r['would_write']:<10} {r['programme']}")
        if not apply:
            continue
        resp = requests.patch(f"{URL}/programmes?id=eq.{r['programme_id']}", headers=H, json=body, timeout=60)
        if resp.status_code in (200, 204):
            done += 1
        else:
            failed += 1
            print("  FAILED", resp.status_code, resp.text[:150])
    print(f"\n{len(rows)} rows; written: {done}; failed: {failed}" if apply else f"\n{len(rows)} rows (dry run, nothing written)")


if __name__ == "__main__":
    main("--apply" in sys.argv)
