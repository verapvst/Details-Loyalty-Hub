#!/usr/bin/env python3
"""Adds the 4 programmes requested 2026-10-02 for the new Core Industries (Beach, Marine, Nightlife).
Industry, mechanisms_14 and benefits_18 are coded from the pages cited in coding_notes (final taxonomy: 14 mechanisms, 17 benefits).
Refuses to insert a name that already exists. Dry run by default; --apply writes.  Needs: pip install requests"""
import sys
import requests

URL = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}
CA = "Create Account (e.g. Card, App, automatic, etc)"
SPEND = "Accumulated by Spending (redeemable for spending)"
NEW = [
    dict(programme_name="Do the Beach Membership", company="Do The Beach", country="United States", industry="Beach",
         programme_positioning="Mid-market", membership_type="Subscription", access_registration="Open registration",
         target_customer=["Families"], geographic_scope=["North America"], ecosystem_type="Single brand",
         source_url="https://dothebeach.com/whats-included-in-do-the-beach-memberships/",
         mechanisms_14=["Paid Subscription"],
         benefits_18=["Cashback / Direct Discounts / Coupons", "Upgrades & Complimentary Offers", "Social / Transferable Benefits"],
         recode_status="Recoded",
         coding_notes="Official page: Beach Club and Beach Club VIP memberships (paid, no spend threshold) -> Paid Subscription. 10%/20% off parties, food, drinks, merchandise -> Cashback / Direct Discounts. Free socks and (VIP) two free buddy passes per month -> Upgrades & Complimentary Offers; buddy passes (50% off for Beach Club) -> Social / Transferable. INDUSTRY WARNING: Do The Beach describes itself as a 'beach-themed indoor park' for children (indoor play venue), not a beach club: confirm it belongs in Beach."),
    dict(programme_name="BoatPass Club", company="BoatPass", country="United States", industry="Marine",
         programme_positioning="Premium", membership_type="Subscription", access_registration="Open registration",
         target_customer=["Premium / Luxury Customers", "Enthusiasts / Hobbyists"], geographic_scope=["North America"], ecosystem_type="Single brand",
         source_url="https://boatpassclub.com/memberships",
         mechanisms_14=["Paid Subscription"],
         benefits_18=["Flexibility & Credit", "Convenience Benefits"],
         recode_status="Suggested",
         coding_notes="Official page blocked (403); coded from search snippets of boatpassclub.com and press (themiamiguide.com): monthly fee from $599 by boat category (Silver to Black), no initiation fee, cancel anytime -> Paid Subscription. Unlimited trip rollover -> Flexibility & Credit. Captain, fuel, docking fees included and 3-click online booking -> Convenience. Needs a read of the live page."),
    dict(programme_name="Clube IN", company="Casino Lisboa (Estoril-Sol)", country="Portugal", industry="Nightlife",
         programme_positioning="Premium", membership_type="Free", access_registration="Open registration",
         target_customer=["Local Customers", "International Customers"], geographic_scope=["Portugal"], ecosystem_type="Multi-brand (same group)",
         source_url="https://casino-lisboa.pt/pt/novo-sistema",
         mechanisms_14=[CA, SPEND],
         benefits_18=[],
         recode_status="Suggested",
         coding_notes="Official page (novo-sistema): register at the 2nd-floor desk, card issued -> Create Account; points convertible to promotional credits on the machine, single points account across Casino Lisboa and Casino Estoril -> Accumulated by Spending (points per euro wagered per secondary sources). Gold/Platinum tiers and benefits (restaurant credit, show discounts, parking, events) appear only on unofficial sites: NOT coded. The official page only says 'outras ofertas e vantagens'. Needs the Clube IN regulation PDFs."),
    dict(programme_name="Casa Cipriani", company="Cipriani", country="United States", industry="Nightlife",
         programme_positioning="Luxury", membership_type="Paid", access_registration="Referral required",
         target_customer=["Premium / Luxury Customers", "High-Value Customers"], geographic_scope=["North America", "Europe"], ecosystem_type="Multi-brand (same group)",
         source_url="https://www.casaciprianinewyork.com/membership",
         mechanisms_14=["Paid Subscription", "Invite"],
         benefits_18=["Service Exclusivity & Priority Access", "Experiential Exclusivity", "Cashback / Direct Discounts / Coupons", "Social / Transferable Benefits", "Community & Networking"],
         recode_status="Suggested",
         coding_notes="Official New York page: members' guest privileges (up to 3 guests; hotel-room guests) -> Social / Transferable; club floors, rooftop, spa -> Experiential Exclusivity. Fees (annual + initiation) and candidacy 'proposed and seconded by existing members and/or appointed by the proprietor', preferred room rates, preferential reservations at Cipriani venues, priority event notification and concierge come from the Casa Cipriani Milano members site and Luxe Digital: -> Paid Subscription, Invite, Cashback/Direct Discounts (member room rates), Service Exclusivity. Own-group access is not coded as Partner Benefits. Nightlife is arguable (private members club with hotel and restaurant)."),
]

def main(apply):
    names = [n["programme_name"] for n in NEW] + ["Boat Pass", "Casino Lisboa", "Do the Beach"]
    have = requests.get(f"{URL}/programmes", params={"select": "programme_name", "limit": "5000"}, headers=H, timeout=60).json()
    have = {p["programme_name"].lower() for p in have}
    for n in NEW:
        key = n["programme_name"].lower()
        if key in have or any(k in key or key in k for k in have if k in ("clube in", "casa cipriani", "boatpass club", "do the beach membership")):
            print("EXISTS, skipping:", n["programme_name"]); continue
        n = dict(n, created_by="Migration")
        print(("INSERT " if apply else "would insert ") + n["programme_name"], "|", n["industry"], "|", n["mechanisms_14"], n["benefits_18"])
        if apply:
            r = requests.post(f"{URL}/programmes", json=n, headers=H, timeout=60)
            print("  ", "ok" if r.ok else f"FAILED {r.status_code} {r.text[:200]}")

if __name__ == "__main__":
    main("--apply" in sys.argv)
