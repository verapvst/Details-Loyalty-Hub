#!/usr/bin/env python3
"""Proposes a first-pass coding of every programme onto the 14 scorecard mechanisms and
18 scorecard benefits, from the data already in the Hub (v3 mechanisms, old benefits,
membership_type, access_registration, tier rows).

It is a SUGGESTION only. It never writes to the database; it writes a CSV for the team
to review. Rules are deliberately conservative: where a v3 value maps to several new
values, the CSV lists the candidates under "to_check" and leaves the decision to a person
reading the official page.

Usage: python3 suggest_recode_14_18.py [output.csv]
Needs: pip install requests
"""
import csv
import sys
import requests

URL = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

SPEND_ACC = "Accumulated by Spending (redeemable for spending)"
TEMP = "Spending at Brand/Partners - Temporary"
LIFE = "Spending at Brand/Partners - Lifetime & Cumulative"

# v3 mechanism / old benefit -> new benefit (only the unambiguous ones)
MECH_TO_BENEFIT = {
    "Member pricing": "Cashback / Direct Discounts / Coupons",
    "Member experiences & events": "Experiential Exclusivity",
    "Community": "Community & Networking",
    "External partner network": "Partner Benefits",
}
BEN_TO_BENEFIT = {
    "Discounts": "Cashback / Direct Discounts / Coupons",
    "Cashback": "Cashback / Direct Discounts / Coupons",
    "Partner Benefits": "Partner Benefits",
    "Priority Access": "Service Exclusivity & Priority Access",
    "Upgrades": "Upgrades & Complimentary Offers",
    "Experiences / Events": "Experiential Exclusivity",
    "Access / Exclusivity": "Experiential Exclusivity",
    "Personalised Benefits": "Personalisation",
}
# old values that split into several new ones: a person decides
BEN_CHECK = {"Complimentary Services", "Free Product / Service Credit", "Points / Redeemable Rewards", "Other"}


def get(table, select="*"):
    r = requests.get(f"{URL}/{table}", params={"select": select, "limit": "5000"}, headers=H, timeout=60)
    r.raise_for_status()
    return r.json()


def main(out):
    progs = get("programmes")
    tiers = get("programme_tiers")
    by_prog = {}
    for t in tiers:
        by_prog.setdefault(t["programme_id"], []).append(t)

    rows = []
    for p in progs:
        v3 = p.get("mechanisms") or []
        old_ben = [b for b in (p.get("benefits") or []) if b]
        t = by_prog.get(p["id"], [])
        mech, check_m = set(), []
        if p.get("membership_type") in ("Paid", "Subscription", "Hybrid"):
            mech.add("Paid Subscription")
        if "Spend-based earning" in v3:
            mech.add(SPEND_ACC)
        if "Referral" in v3:
            mech.add("Referral")
        if p.get("access_registration") == "Invitation only":
            check_m.append("Invite (access is invitation only)")
        units = {(x.get("qualification_unit") or "") for x in t}
        if any(u.startswith(("Spend", "Rentals or spend")) for u in units):
            check_m.append(f"{TEMP} OR {LIFE} (spend tiers: annual or lifetime?)")
        if any(u.startswith(("Nights", "Completed stays")) for u in units):
            check_m.append(f"Tenure / Legacy Recognition OR {TEMP} (night-based tiers)")
        if "Behaviour-based rewards" in v3:
            check_m.append("Accumulated by Actions / Missions / Do X, Get Y (split)")
        if "Earned status" in v3 and not t:
            check_m.append("Earned status in v3 but no tier rows: which tier mechanism?")

        ben, check_b = set(), []
        for m in v3:
            if m in MECH_TO_BENEFIT:
                ben.add(MECH_TO_BENEFIT[m])
        for b in old_ben:
            if b in BEN_TO_BENEFIT:
                ben.add(BEN_TO_BENEFIT[b])
            elif b in BEN_CHECK:
                check_b.append(b)
        if "Included member benefits" in v3 or "Privileged access" in v3:
            check_b.append("v3 Included member benefits / Privileged access: pick the new benefit(s)")

        rows.append({
            "programme_id": p["id"], "programme_name": p["programme_name"], "industry": p["industry"],
            "positioning": p.get("programme_positioning"), "membership_type": p.get("membership_type"),
            "v3_mechanisms": "; ".join(v3), "old_benefits": "; ".join(old_ben),
            "suggested_mechanisms_14": "; ".join(sorted(mech)),
            "mechanisms_to_check": " | ".join(check_m),
            "suggested_benefits_18": "; ".join(sorted(ben)),
            "benefits_to_check": " | ".join(check_b),
            "always_manual": "enrolment route, Do X Get Y, Missions, Ambassador, Access by Ownership, Tenure, benefits with no old equivalent",
        })

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} programmes written to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "recode_suggestions_14_18.csv")
