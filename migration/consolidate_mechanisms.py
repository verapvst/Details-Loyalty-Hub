#!/usr/bin/env python3
"""One-time migration: consolidates the Benefits field into Mechanisms.

Benefits and Mechanisms were two overlapping picklists (see assets/options.js history) —
this merges each programme's `benefits` values into its `mechanisms` array (deduplicated,
existing mechanisms kept first), migrates `likes` rows that pointed at a Benefit, and
backfills "Coupons / Vouchers" onto the small set of programmes with clear evidence of a
coupon/voucher mechanic (see COUPON_BACKFILL below for the evidence behind each one).

The `benefits` column itself is left untouched in the database (not cleared, not
dropped) — see supabase/023_consolidate_mechanisms_benefits.sql.

Usage: python3 consolidate_mechanisms.py [--dry-run]
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

# Old Benefits value -> new canonical Mechanisms value. Where a Benefit already named the
# same concept as an existing Mechanism (from two sides — "the tactic" vs "what the member
# gets"), it's merged into that Mechanism rather than kept as a separate entry.
BENEFIT_TO_MECHANISM = {
    "Discounts": "Discounts",
    "Cashback": "Cashback",
    "Partner Benefits": "Partnerships",
    "Points / Redeemable Rewards": "Points",
    "Access / Exclusivity": "Exclusivity",
    "Personalised Benefits": "Personalisation",
    "Experiences / Events": "Experiences",
    "Priority Access": "Priority Access",
    "Complimentary Services": "Complimentary Services",
    "Free Product / Service Credit": "Free Product / Service Credit",
    "Upgrades": "Upgrades",
    "Other": "Other",
}

# Coupons/Vouchers backfill — added only where the workbook's own notes/features describe
# a coupon or voucher functioning as its own delivery mechanic (personalised/gamified
# issuance, tier-triggered, or explicitly in place of points), not just "points redeemed
# for a voucher" (which is just the payout form of the Points mechanism and every points
# programme could claim it). Evidence quoted from migration/Details_Loyalty_Staging_Workbook.xlsx.
COUPON_BACKFILL = {
    "App Lidl Plus": "weekly personalised percentage-off coupons on specific ranges (Spin to Win, Mystery Boxes gamification)",
    "App O Meu Pingo Doce": "Poupa Shaker mini-game lets members shake their phone daily to reveal a different coupon",
    "AdiClub": "four levels unlock 15-30% off vouchers",
    "Lindt Chocolate Club": "UK: no points — instead a £5 voucher per £50 spent, up to 3 per year",
    "British Airways Executive Club": 'Reward flight "Companion Voucher" issued to Gold cardholders spending above an annual threshold',
    "Wizz Discount Club": "Free Light tier still gives access to onboard coupons with no purchase required",
}


def rest(table):
    return f"{SUPABASE_URL}/rest/v1/{table}"


def dedupe(values):
    seen = set()
    out = []
    for v in values:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def main():
    dry_run = "--dry-run" in sys.argv

    resp = requests.get(rest("programmes"), headers=HEADERS,
                         params={"select": "id,programme_name,mechanisms,benefits"})
    resp.raise_for_status()
    programmes = resp.json()

    updates = []
    unmapped_benefits = set()
    for p in programmes:
        mechanisms = list(p.get("mechanisms") or [])
        benefits = p.get("benefits") or []
        mapped = []
        for b in benefits:
            if b in BENEFIT_TO_MECHANISM:
                mapped.append(BENEFIT_TO_MECHANISM[b])
            else:
                unmapped_benefits.add(b)
        merged = dedupe(mechanisms + mapped)

        if p["programme_name"] in COUPON_BACKFILL and "Coupons / Vouchers" not in merged:
            merged.append("Coupons / Vouchers")

        if merged != mechanisms:
            updates.append((p["id"], p["programme_name"], mechanisms, merged))

    print(f"Programmes to update: {len(updates)} / {len(programmes)}")
    if unmapped_benefits:
        print(f"WARNING - unmapped benefit values (not migrated): {unmapped_benefits}")

    coupon_adds = [name for _, name, old, new in updates
                   if "Coupons / Vouchers" in new and "Coupons / Vouchers" not in old]
    print(f"Coupons / Vouchers backfilled onto: {coupon_adds}")

    # ---- likes: target_type='benefit' -> 'mechanism' ----
    lresp = requests.get(rest("likes"), headers=HEADERS,
                          params={"select": "id,target_type,target_label", "target_type": "eq.benefit"})
    lresp.raise_for_status()
    benefit_likes = lresp.json()
    print(f"\nLikes rows to migrate (target_type='benefit'): {len(benefit_likes)}")
    for l in benefit_likes:
        mapped = BENEFIT_TO_MECHANISM.get(l["target_label"])
        print(f"  {l['id']}: '{l['target_label']}' -> target_type='mechanism', target_label={mapped!r}")

    if dry_run:
        print("\nDry run — no changes made.")
        for pid, name, old, new in updates:
            added = [v for v in new if v not in old]
            print(f"  {name}: +{added}")
        return

    failed = []
    for pid, name, old, new in updates:
        r = requests.patch(rest("programmes"), headers=HEADERS,
                            params={"id": f"eq.{pid}"}, json={"mechanisms": new})
        if r.status_code not in (200, 204):
            print(f"FAILED programme '{name}': {r.status_code} {r.text}")
            failed.append(name)
        else:
            print(f"OK  '{name}' mechanisms -> {new}")

    for l in benefit_likes:
        mapped = BENEFIT_TO_MECHANISM.get(l["target_label"])
        if not mapped:
            print(f"SKIP like {l['id']}: no mapping for '{l['target_label']}'")
            continue
        r = requests.patch(rest("likes"), headers=HEADERS, params={"id": f"eq.{l['id']}"},
                            json={"target_type": "mechanism", "target_label": mapped})
        if r.status_code not in (200, 204):
            print(f"FAILED like {l['id']}: {r.status_code} {r.text}")
            failed.append(f"like:{l['id']}")
        else:
            print(f"OK  like {l['id']} -> mechanism/{mapped}")

    print(f"\nDone. {len(updates) - len([f for f in failed if not f.startswith('like:')])}/{len(updates)} programmes updated, "
          f"{len(benefit_likes) - len([f for f in failed if f.startswith('like:')])}/{len(benefit_likes)} likes migrated.")
    if failed:
        print("Failed:", failed)
        sys.exit(1)


if __name__ == "__main__":
    main()
