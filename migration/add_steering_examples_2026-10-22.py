#!/usr/bin/env python3
"""Adds the two Steering 1 'Best of benefits' examples that were missing from the Hub (SL Benfica Mais Vantagens,
American Airlines AAdvantage) and their favourites. Skips anything that already exists. Dry run by default; --apply writes."""
import sys
import requests

B = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
K = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
H = {"apikey": K, "Authorization": f"Bearer {K}", "Content-Type": "application/json", "Prefer": "return=representation"}
NEW = [
    dict(programme_name="SL Benfica Mais Vantagens", company="Sport Lisboa e Benfica", country="Portugal", industry="Leisure & Entertainment",
         programme_positioning="Mass", membership_type="Paid", access_registration="Open registration",
         target_customer=["Local Customers", "Enthusiasts / Hobbyists", "Families"], geographic_scope=["Portugal"], ecosystem_type="Partner network",
         source_url="https://www.slbenfica.pt/en-us/termos-e-condicoes/mais-vantagens",
         mechanisms_14=["Paid Subscription", "Create Account", "Accumulated by Spending"], benefits_18=["Savings", "Partner Benefits"],
         recode_status="Suggested",
         coding_notes="Steering 1 Best-of-benefits example. Search summary of the official terms/FAQ: club members (paid membership) link a bank card to their membership number; direct discounts at partners and card discounts that build a balance in a virtual wallet, spendable on membership fees, tickets, merchandising and club facilities; 2,700-4,000 partner stores. Red Points (separate points scheme with partners) not coded. Read the official page to verify."),
    dict(programme_name="American Airlines AAdvantage", company="American Airlines", country="United States", industry="Travel & Mobility",
         programme_positioning="Mass", membership_type="Free", access_registration="Open registration",
         target_customer=["Frequent Customers", "International Customers"], geographic_scope=["Global"], ecosystem_type="Partner network",
         source_url="https://www.aa.com/web/i18n/aadvantage-program/discover/how-aadvantage-works.html",
         mechanisms_14=["Create Account", "Accumulated by Spending", "Temporary for Spending", "Lifetime for Spending"],
         benefits_18=["Points Inflation", "Upgrades & Complementary", "Convenience", "ESG Donation"],
         recode_status="Suggested",
         coding_notes="Steering 1 Best-of-benefits example (members can donate miles to NGOs). Search summary of aa.com: status (Gold to Executive Platinum) by Loyalty Points, bonus miles 40-120%, complimentary upgrades, free checked bag, lifetime Gold at 1,000,000 career miles, miles can be donated to charities (Miles for Social Good, minimum 1,000 miles). Official page blocked to bots: verify."),
]
FAV = [
    ("SL Benfica Mais Vantagens", "Partner Benefits", "Benfica runs a partner network where members earn and redeem value in wellness, travel and gastronomy. Details can apply: Local partner network: members earn and redeem points with local partners around each destination, such as restaurants, spas and mobility. (Steering 1, Best of benefits)"),
    ("American Airlines AAdvantage", "ESG Donation", "American Airlines lets members donate miles to NGOs. Details can apply: Give back with points: members donate points to local causes near each destination. (Steering 1, Best of benefits)"),
]


def main(apply):
    have = {p["programme_name"]: p["id"] for p in requests.get(f"{B}/programmes", params={"select": "id,programme_name", "limit": "5000"}, headers=H).json()}
    for n in NEW:
        if n["programme_name"] in have:
            print("EXISTS:", n["programme_name"]); continue
        print(("INSERT " if apply else "would insert ") + n["programme_name"])
        if apply:
            r = requests.post(f"{B}/programmes", json=dict(n, created_by="Migration"), headers=H)
            if not r.ok:
                print("  FAILED", r.status_code, r.text[:150]); continue
            have[n["programme_name"]] = r.json()[0]["id"]
    for name, ben, desc in FAV:
        if name not in have:
            continue
        print(("FAVOURITE " if apply else "would add favourite ") + f"{name} / {ben}")
        if apply:
            r = requests.post(f"{B}/likes", json={"programme_id": have[name], "liked_by": "Steering 1", "target_type": "benefit", "target_label": ben, "description": desc}, headers=dict(H, Prefer="return=minimal"))
            print("  ", "ok" if r.ok else f"FAILED {r.status_code} {r.text[:120]}")


if __name__ == "__main__":
    main("--apply" in sys.argv)
