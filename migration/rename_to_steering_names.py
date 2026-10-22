#!/usr/bin/env python3
"""Renames mechanism/benefit values in programmes.mechanisms_14 / benefits_18 to the exact names used in Steering 1
(14 mechanisms, 16 benefits). 'Proprietary Credit Card Benefits' is not a steering benefit and is dropped.
Dry run by default; --apply writes. Needs: pip install requests"""
import sys
import requests

URL = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}
MECH = {
    "Spending at Brand/Partners - Temporary": "Temporary for Spending",
    "Spending at Brand/Partners - Lifetime & Cumulative": "Lifetime for Spending",
    "Accumulated by Spending (redeemable for spending)": "Accumulated by Spending",
    "Accumulated by Actions (redeemable for spending)": "Accumulated by Actions",
    "Create Account (e.g. Card, App, automatic, etc)": "Create Account",
    "Missions/Gamification": "Missions / Gamification",
}
BEN = {
    "Cashback / Direct Discounts / Coupons": "Savings",
    "Sweepstakes, Contests & Prize Draws": "Contests & Prize Draws",
    "Upgrades & Complimentary Offers": "Upgrades & Complementary",
    "Convenience Benefits": "Convenience",
    "AI-Powered Benefits": "AI-powered",
    "Service Exclusivity & Priority Access": "Service Exclusivity",
    "Experiential Exclusivity": "Extra-service Exclusivity",
    "Social / Transferable Benefits": "Social / Transferable",
    "Family Benefits": "Family",
    "Sustainability & Charitable Giving": "ESG Donation",
    "Personalisation": "Personalization",
    "Personalised Gifts": "Personalized Gifts",
    "Proprietary Credit Card Benefits": None,
}


def conv(vals, m):
    out = []
    for v in vals or []:
        n = m.get(v, v)
        if n and n not in out:
            out.append(n)
    return out


def main(apply):
    rows = requests.get(f"{URL}/programmes", params={"select": "id,programme_name,mechanisms_14,benefits_18", "limit": "5000"}, headers=H, timeout=60).json()
    n = 0
    for p in rows:
        mm, bb = conv(p["mechanisms_14"], MECH), conv(p["benefits_18"], BEN)
        if mm == (p["mechanisms_14"] or []) and bb == (p["benefits_18"] or []):
            continue
        n += 1
        if apply:
            r = requests.patch(f"{URL}/programmes", params={"id": f"eq.{p['id']}"}, json={"mechanisms_14": mm, "benefits_18": bb}, headers=H, timeout=60)
            if not r.ok:
                print("FAILED", p["programme_name"], r.status_code)
    print(n, "programmes changed", "APPLIED" if apply else "DRY RUN")


if __name__ == "__main__":
    main("--apply" in sys.argv)
