#!/usr/bin/env python3
"""One-time migration: remaps existing programmes' `mechanisms` values onto the
taxonomy from the Mechanisms Taxonomy Due Diligence (2026-09).

Changes applied per programme:
  - "Tiering" removed entirely (redundant with the structured programme_tiers table
    — see analysisData.js's hasTierRows).
  - "Coupons / Vouchers" and "Discounts" merged into "Discounts & Vouchers".
  - "Free Product / Service Credit" and "Complimentary Services" merged into
    "Complimentary Benefits & Credits".
  - "Partnerships" renamed to "Partner Network".
  - Everything else (Points, Cashback, Upgrades, Priority Access, Early Access,
    Exclusivity, Experiences, Cross-brand / Ecosystem Access, Personalisation,
    Gamification, Community, Referral, Status Recognition, Other) is unchanged.
  - "Transferability / Gifting" (new) is not backfilled onto any existing
    programme — no evidence basis to guess which ones have it.

See assets/options.js's `mechanisms` / `MECHANISM_ANALYTICAL_ORDER` for the new
taxonomy itself.

Usage: python3 remap_mechanisms_taxonomy.py [--dry-run]
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

REMAP = {
    "Tiering": None,  # dropped entirely
    "Coupons / Vouchers": "Discounts & Vouchers",
    "Discounts": "Discounts & Vouchers",
    "Free Product / Service Credit": "Complimentary Benefits & Credits",
    "Complimentary Services": "Complimentary Benefits & Credits",
    "Partnerships": "Partner Network",
}


def remap_mechanisms(old_list):
    if not old_list:
        return old_list, False
    new_list = []
    changed = False
    for m in old_list:
        if m in REMAP:
            changed = True
            target = REMAP[m]
            if target is not None and target not in new_list:
                new_list.append(target)
        elif m not in new_list:
            new_list.append(m)
        else:
            changed = True  # a duplicate produced by an earlier merge in this same row
    return new_list, changed


def main():
    dry_run = "--dry-run" in sys.argv

    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/programmes",
        headers=HEADERS,
        params={"select": "id,programme_name,mechanisms"},
    )
    resp.raise_for_status()
    programmes = resp.json()
    print(f"Loaded {len(programmes)} programmes.")

    to_update = []
    for p in programmes:
        new_mechanisms, changed = remap_mechanisms(p.get("mechanisms"))
        if changed:
            to_update.append((p["id"], p["programme_name"], p.get("mechanisms"), new_mechanisms))

    print(f"{len(to_update)} programme(s) need remapping.\n")
    for pid, name, old, new in to_update:
        print(f"  {name}")
        print(f"    old: {old}")
        print(f"    new: {new}")

    if dry_run:
        print("\n--dry-run: no changes written.")
        return

    for pid, name, old, new in to_update:
        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/programmes",
            headers=HEADERS,
            params={"id": f"eq.{pid}"},
            json={"mechanisms": new},
        )
        if r.status_code >= 300:
            print(f"FAILED to update {name}: {r.status_code} {r.text}")
        r.raise_for_status()

    print(f"\nDone — updated {len(to_update)} programme(s).")


if __name__ == "__main__":
    main()
