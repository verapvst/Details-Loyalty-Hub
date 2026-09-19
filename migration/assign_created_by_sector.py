#!/usr/bin/env python3
"""One-time correction: the 144 programmes were all bulk-imported under
created_by='Migration', but the actual research was split by sector across the team
(matching the "Research <sector>" tasks already in the app). This reassigns each
programme's created_by to whoever researched its sector, so everyone can filter the
Database down to their own work with the "Added by" filter.

Mapping (confirmed with the team):
  Retail, Restaurants & F&B                         -> Cá   (Retail & FMCG)
  Airlines & Travel, Hotels & Hospitality,
  Tourism & Leisure                                 -> Alice (Travel & Hospitality)
  Banking & Financial Services (incl. Credit Cards) -> André (Banking & Fintech)
  Fitness & Wellness, Education                     -> Maria (Education & Wellness)
  Automotive, Entertainment & Media, Luxury,
  Private Members' Clubs, Telecommunications        -> Chica (Alternative Markets)
  Golf, Other                                       -> Vera  (core focus / everything else)

Usage: python3 assign_created_by_sector.py [--dry-run]
"""

import sys
import requests

SUPABASE_URL = "https://dyuflyhkanmczwshmbyh.supabase.co"
SUPABASE_KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

INDUSTRY_TO_OWNER = {
    "Retail": "Cá",
    "Restaurants & F&B": "Cá",
    "Airlines & Travel": "Alice",
    "Hotels & Hospitality": "Alice",
    "Tourism & Leisure": "Alice",
    "Banking & Financial Services (incl. Credit Cards)": "André",
    "Fitness & Wellness": "Maria",
    "Education": "Maria",
    "Automotive": "Chica",
    "Entertainment & Media": "Chica",
    "Luxury": "Chica",
    "Private Members' Clubs": "Chica",
    "Telecommunications": "Chica",
    "Golf": "Vera",
    "Other": "Vera",
}


def rest(table):
    return f"{SUPABASE_URL}/rest/v1/{table}"


def main():
    dry_run = "--dry-run" in sys.argv

    resp = requests.get(rest("programmes"), headers=HEADERS,
                         params={"select": "id,programme_name,industry,created_by"})
    resp.raise_for_status()
    programmes = resp.json()

    unmapped = sorted({p["industry"] for p in programmes if p["industry"] not in INDUSTRY_TO_OWNER})
    if unmapped:
        print(f"ABORT - no owner mapped for industries: {unmapped}")
        sys.exit(1)

    from collections import Counter
    counts = Counter(INDUSTRY_TO_OWNER[p["industry"]] for p in programmes)
    print("Planned created_by counts:", dict(counts))

    if dry_run:
        print(f"\nDry run — no changes made. {len(programmes)} programmes would be updated.")
        return

    failed = []
    for p in programmes:
        owner = INDUSTRY_TO_OWNER[p["industry"]]
        r = requests.patch(rest("programmes"), headers=HEADERS,
                            params={"id": f"eq.{p['id']}"}, json={"created_by": owner})
        if r.status_code not in (200, 204):
            print(f"FAILED '{p['programme_name']}': {r.status_code} {r.text}")
            failed.append(p["programme_name"])
        else:
            print(f"OK  '{p['programme_name']}' ({p['industry']}) -> {owner}")

    print(f"\nDone. {len(programmes) - len(failed)}/{len(programmes)} programmes updated.")
    if failed:
        print("Failed:", failed)
        sys.exit(1)


if __name__ == "__main__":
    main()
