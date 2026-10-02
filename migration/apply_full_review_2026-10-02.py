#!/usr/bin/env python3
"""Writes the full coding review (migration/final_review_2026-10-02.csv) to the Hub.

For every programme in the CSV it sets mechanisms_14 (14 mechanisms), benefits_18 (the 17 final benefits;
column name unchanged), recode_status ('Recoded' = High confidence page evidence, 'Suggested' = Medium/Low,
'To recode' = nothing could be coded) and coding_notes (basis + evidence). Legacy columns are untouched.
Backup before this change: migration/backup_programmes_before_final_alignment_2026-10-02.json.
Dry run by default; --apply writes. Needs: pip install requests
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
    rows = list(csv.DictReader(open("final_review_2026-10-02.csv", encoding="utf-8")))
    failed = 0
    for r in rows:
        patch = {"mechanisms_14": split(r["mechanisms_14"]), "benefits_18": split(r["benefits_17"]), "recode_status": r["recode_status"],
                 "coding_notes": f"Review 2026-10-02 | Confidence: {r['confidence']} | Basis: {r['basis']} | {r['notes']}"[:2500]}
        if not apply:
            continue
        resp = requests.patch(f"{URL}/programmes", params={"id": f"eq.{r['programme_id']}"}, json=patch, headers=H, timeout=60)
        if not resp.ok:
            print("FAILED", r["programme"], resp.status_code, resp.text[:150]); failed += 1
    print(f"{len(rows)} programmes | failed {failed} | {'APPLIED' if apply else 'DRY RUN (nothing written)'}")


if __name__ == "__main__":
    main("--apply" in sys.argv)
