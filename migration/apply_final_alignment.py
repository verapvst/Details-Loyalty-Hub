#!/usr/bin/env python3
"""Applies the reviewed mapping (migration/final_alignment_mapping.csv) to the Hub.

NOTHING IS WRITTEN unless you pass --apply. Default is a dry run that prints what would change.

Two independent switches per row in the CSV (edit them after review):
  apply_industry = Y  -> programmes.industry := final_industry
  apply_coding   = Y  -> programmes.mechanisms_14 / benefits_18 := final_*, recode_status := 'Recoded',
                         coding_notes := coding_basis (existing notes are kept and appended to)
Rows with N are left untouched. Legacy columns (mechanisms, benefits) are never modified or deleted.
Run the backup first: migration/backup_programmes_before_recode_2026-10-01.json predates this change; take a
fresh one (the dry run reminds you).

Before --apply: add the new industries to OPTIONS.industry in assets/options.js
('Hotels','Golf','Wellness','Beach','Marine','Nightlife','Food & Beverage', ... 'Education').

Usage:
  python3 apply_final_alignment.py            # dry run
  python3 apply_final_alignment.py --apply    # write
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
    rows = list(csv.DictReader(open("final_alignment_mapping.csv", encoding="utf-8")))
    live = {p["id"]: p for p in requests.get(f"{URL}/programmes", params={"select": "id,industry,coding_notes", "limit": "5000"}, headers=H, timeout=60).json()}
    n_ind = n_cod = failed = 0
    for r in rows:
        patch = {}
        cur = live.get(r["programme_id"])
        if cur is None:
            print("MISSING in Hub:", r["programme"]); failed += 1; continue
        if r["apply_industry"] == "Y" and cur["industry"] != r["final_industry"]:
            patch["industry"] = r["final_industry"]; n_ind += 1
        if r["apply_coding"] == "Y":
            patch["mechanisms_14"] = split(r["final_mechanisms"])
            patch["benefits_18"] = split(r["final_benefits"])
            patch["recode_status"] = "Recoded"
            note = "Final alignment 2026-10: " + r["coding_basis"]
            patch["coding_notes"] = ((cur.get("coding_notes") or "") + "\n" + note).strip()
            n_cod += 1
        if not patch:
            continue
        print(("WRITE " if apply else "would write ") + r["programme"], {k: v for k, v in patch.items() if k != "coding_notes"})
        if apply:
            resp = requests.patch(f"{URL}/programmes", params={"id": f"eq.{r['programme_id']}"}, json=patch, headers=H, timeout=60)
            if not resp.ok:
                print("  FAILED", resp.status_code, resp.text[:200]); failed += 1
    print(f"\nindustry updates: {n_ind} | coding updates: {n_cod} | failed: {failed} | {'APPLIED' if apply else 'DRY RUN (nothing written)'}")


if __name__ == "__main__":
    main("--apply" in sys.argv)
