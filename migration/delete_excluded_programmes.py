#!/usr/bin/env python3
"""Deletes the programmes the team decided to exclude from the benchmark (2026-10-02):
Member Hotel, CopaCoins, QdL Employee Benefits (B2B / employee schemes) and Monte Rei Golf & Country Club.

Dry run by default. Deleting is permanent: with --apply the rows are first saved to
migration/deleted_programmes_2026-10-02.json, then deleted (tiers etc. cascade via ON DELETE CASCADE).
Usage:  python3 delete_excluded_programmes.py [--apply]      Needs: pip install requests
"""
import json
import sys
import requests

URL = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}
NAMES = ["Member Hotel", "CopaCoins", "QdL Employee Benefits", "Monte Rei Golf & Country Club"]


def main(apply):
    rows = requests.get(f"{URL}/programmes", params={"select": "*", "programme_name": "in.(" + ",".join('"%s"' % n for n in NAMES) + ")"}, headers=H, timeout=60).json()
    print("found:", [r["programme_name"] for r in rows])
    if len(rows) != len(NAMES):
        sys.exit("Expected %d rows, found %d: stopping." % (len(NAMES), len(rows)))
    if not apply:
        print("DRY RUN: nothing deleted. Re-run with --apply.")
        return
    json.dump(rows, open("deleted_programmes_2026-10-02.json", "w"), indent=1)
    for r in rows:
        resp = requests.delete(f"{URL}/programmes", params={"id": f"eq.{r['id']}"}, headers=H, timeout=60)
        print("deleted" if resp.ok else f"FAILED {resp.status_code}", r["programme_name"])


if __name__ == "__main__":
    main("--apply" in sys.argv)
