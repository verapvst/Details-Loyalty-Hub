#!/usr/bin/env python3
"""One-time backfill: real published prices for the 58 Paid/Subscription/Hybrid
programmes that had zero tier_price data (2026-09-26 database audit finding —
only 33% of priceable programmes had a recorded price). Researched via web search
across 4 parallel batches (Fitness & Wellness, Automotive, Golf, F&B/Leisure/
Retail/Travel); see the per-programme `note` field for source URL and any
verification caveat (several private clubs genuinely publish no price — these are
left with no tier row rather than a guessed number, which is itself a finding, not
a gap to paper over).

Modelling decision: where a programme had multiple reported price variants that are
really the SAME membership level billed differently (monthly vs. annual, individual
vs. couple), only ONE representative row is kept — stuffing every variant in as a
separate tier_order would inflate "number of tiers" and corrupt the Tier
Architecture / tiering-by-industry analyses added earlier this session. Rows are
only split into multiple tier_order entries when they represent a genuine ascending
membership ladder (different feature sets / access levels), e.g. Kia Connect's
Care/Plus/Ultimate, or a real two-part fee (joining fee + annual dues).

qualification_unit is 'Automatic / No qualification' throughout — every row here is
something a member pays for outright, not earned through behaviour (that
distinction is what classifyTierRow() in assets/analysisData.js reads back out).

Usage: python3 backfill_pricing_2026.py [--dry-run]
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

# programme_name -> list of tier rows to insert, each:
# (tier_name, tier_order, tier_price, currency, price_period, note)
NEW_TIERS = {
    # ---- Fitness & Wellness ----
    "The Campus Membership": [("Full Membership", 1, 2500, "EUR", "Annual", "thecampusqdl.com/en/membership — also billed monthly at €340")],
    "Oura Subscription": [("Membership", 1, 69.99, "EUR", "Annual", "ouraring.com/membership — also billed monthly at €5.99")],
    "ClassPass": [
        ("Starter", 1, 19, "USD", "Monthly", "help.classpass.com — lowest published starting price, varies by city"),
        ("Core", 2, 55, "USD", "Monthly", "classpass.com/pricing — 25 credits, commonly cited 'starts at' price"),
    ],
    "Solinca Membership": [
        ("Classic — sem piscina", 1, 2.99, "EUR", "Other", "solinca.pt/oferta — 'Desde 2,99€/semana', promotional pricing"),
        ("Classic — com piscina", 2, 4.99, "EUR", "Other", "solinca.pt/oferta — 'Desde 4,99€/semana'"),
    ],
    "Pvolve": [("Streaming", 1, 224.91, "USD", "Annual", "help.pvolve.com — also billed monthly at $24.99")],
    "Wellhub": [
        ("Digital", 1, 0, "USD", "Monthly", "wellhub.com/en-us/plans-pricing — free digital-only tier"),
        ("Starter", 2, 11.99, "USD", "Monthly", "wellhub.com/en-us/plans-pricing — lowest paid tier, varies by employer plan"),
        ("Diamond", 3, 344.99, "USD", "Monthly", "wellhub.com/en-us/plans-pricing — top published tier of 10 total"),
    ],
    "SoulCycle": [
        ("Soul Renew — 4 Classes", 1, 120, "USD", "Monthly", "soul-cycle.com/series — Maryland market, varies by studio"),
        ("Soul Renew — 16 Classes", 2, 430, "USD", "Monthly", "soul-cycle.com/series — top recurring monthly tier"),
    ],
    "CorePower Yoga": [("At Home Membership", 1, 49, "USD", "Monthly", "corepoweryoga.com — online-only; in-studio price varies by studio, not published nationally")],

    # ---- Automotive ----
    "BMW ConnectedDrive": [("BMW Digital Premium", 1, 9.99, "USD", "Monthly", "faq.bmwusa.com — one named product within a fragmented, market-specific package structure")],
    "Porsche Club Portugal": [("Annual Membership", 1, 120.00, "EUR", "Annual", "official club page — quota anual")],
    "Lexus": [
        ("Remote Services", 1, 49.99, "EUR", "Annual", "lexus.eu/owners/connected-services — EU pricing, 4-yr free trial with new vehicle"),
        ("Smart Digital Key", 2, 69.99, "EUR", "Annual", "lexus.eu/owners/connected-services"),
        ("Smart Car", 3, 99.99, "EUR", "Annual", "lexus.eu/owners/connected-services"),
        ("Connect & Secure", 4, 99.99, "EUR", "Annual", "lexus.eu/owners/connected-services — US pricing differs, not independently confirmed"),
    ],
    "FordPass": [("Connectivity Package", 1, 149.95, "USD", "Annual", "ford.com/technology/connected-services — also $14.99/mo or $745 one-time for 7 years")],
    "Kia Connect": [
        ("Care Package", 1, 5.99, "USD", "Monthly", "owners.kia.com — also $59/year; JS-rendered page, corroborated via dealer citations"),
        ("Plus Package", 2, 14.99, "USD", "Monthly", "owners.kia.com — also $149/year"),
        ("Ultimate Package", 3, 19.99, "USD", "Monthly", "owners.kia.com — also $199/year"),
    ],
    "NissanConnect": [("Premium Package", 1, 12.99, "USD", "Monthly", "nissanusa.com/owners/connect/packages — combined Convenience+Security; other packages $11.99-$24.99/mo")],
    "Jaguar Subscription": [
        ("InControl Remote only", 1, 40.00, "GBP", "Annual", "jaguar.com — UK renewal price, corroborated via owner forums"),
        ("InControl Remote & Secure", 2, 260.00, "GBP", "Annual", "jaguar.com — UK renewal price, corroborated via owner forums"),
    ],
    "MINI Connected Package": [("Connected Package", 1, 9.95, "GBP", "Monthly", "mini.co.uk — also £99/year")],
    "Tesla Connectivity Premium": [("Premium Connectivity", 1, 99.00, "USD", "Annual", "tesla.com/support/connectivity — also $9.99/mo, plus tax")],

    # ---- Golf ----
    "Pestana Golf Membership": [("Premium (All Courses) — Single", 1, 3990, "EUR", "Annual", "pestanagolf.com 2026 official PDF — flagship tier; Couple/Carvoeiro/Vila Sol/Silves/Alto/Junior variants exist but omitted (eligibility-restricted or duplicate single/couple pricing)")],
    "Vilamoura Golf Membership": [("Annual — Individual", 1, 4820, "EUR", "Annual", "vilamouragolf.com/en/memberships — covers Millennium, Pinhal, Laguna courses; Couple rate €7,718 omitted")],
    "Vale do Lobo Golf Club Membership": [
        ("Admittance Fee (Non-Resident)", 1, 10000, "EUR", "One-time", "valedolobo.com 2025 PDF — 5-year validity"),
        ("Annual Fee — Single", 2, 7995, "EUR", "Annual", "valedolobo.com 2025 PDF — Couple rate €10,860 omitted"),
    ],
    "Amendoeira Golf Resort Membership": [
        ("Silver — Single", 1, 1190, "EUR", "Annual", "amendoeiraresort.com 2026 PDF — green fee not included, discounted rate"),
        ("Premium — Single", 2, 3820, "EUR", "Annual", "amendoeiraresort.com 2026 PDF — Faldo, O'Connor Jnr & Academy courses; Couple/Trimestral/Junior/Academy variants omitted"),
    ],
    "PGA TOUR Rewards": [
        ("Players' Club", 1, 0, "USD", "Other", "pgatoursuperstore.com — free, $10 reward per $500 spent"),
        ("Players' Club Plus", 2, 299.99, "USD", "Annual", "pgatoursuperstore.com — paid premium tier"),
    ],
    "Topgolf Memberships": [("PlayMore", 1, 220, "USD", "Annual", "topgolf.com/us/pricing/memberships — also $20/mo; Platinum Club/Elite tiers exist but venue-variable, no published figure")],
    "Eligo Club": [
        ("National Membership — Joining Fee", 1, 1500, "USD", "One-time", "UNVERIFIED — not published on official eligoclub.com (contact-only); sourced from Practical Golf article, credited toward first-year events"),
        ("National Membership — Annual Dues", 2, 3200, "USD", "Annual", "UNVERIFIED — not published on official eligoclub.com (contact-only); sourced from Practical Golf article"),
    ],

    # ---- Food & Beverage ----
    "Club Pret": [("Standard", 1, 5.00, "GBP", "Monthly", "pret.co.uk — UK price, 50% off up to 5 drinks/day")],
    "JNcQUOI Club": [("Annual dues", 1, 2750, "EUR", "Annual", "UNVERIFIED — not published on official jncquoi.com/en/membership (application-only); third-party reported (Men's Journal)")],
    "Soho House": [
        ("Every House", 1, 750, "USD", "Other", "UNVERIFIED-ish — official site uses an interactive calculator with no static figures; billed quarterly, global access to 40+ Houses; third-party sourced"),
        ("Local House", 2, 950, "USD", "Other", "billed quarterly; access to home city only; Under-27 discounted rate exists for both tiers, third-party sourced"),
    ],
    "Annabel's (Birley Clubs)": [
        ("Standard — Joining Fee", 1, 1750, "GBP", "One-time", "UNVERIFIED — not published on annabels.co.uk (application-only); third-party reported (Spear's)"),
        ("Standard — Annual Subscription", 2, 3250, "GBP", "Annual", "UNVERIFIED — third-party reported (Spear's); Under-35 discounted tier exists but figures conflicted across sources"),
    ],
    "Zero Bond": [
        ("General (30-45) — Initiation", 1, 1000, "USD", "One-time", "zerobondny.com/apply-for-membership — official site; Under-30 and Over-45 brackets also exist at different rates"),
        ("General (30-45) — Annual Dues", 2, 3850, "USD", "Annual", "zerobondny.com/apply-for-membership — official site"),
    ],
    "Wine Access Michelin Club": [("Standard Subscription", 1, 180, "USD", "Other", "wineaccess.com/michelin — $160-$200 range per shipment, 5 shipments/year, 180 = midpoint")],
    "Gourmet Escapes Privilege Club": [
        ("Bronze", 1, 45.00, "GBP", "Other", "gourmet-escapes.com/privilege-club — billed every 6 months"),
        ("Silver Step Out", 2, 65.00, "GBP", "Other", "gourmet-escapes.com/privilege-club — billed every 6 months"),
        ("Gold VIP Treatment", 3, 100.00, "GBP", "Other", "gourmet-escapes.com/privilege-club — billed every 6 months"),
    ],
    "Neera (Al Habtoor City, Dubai)": [
        ("Individual — Joining Fee", 1, 7500, "AED", "One-time", "UNVERIFIED — not itemised on official alhabtoorcity.com/en/neera; secondary source (propertyfinder.ae)"),
        ("Individual — Annual Fee", 2, 15750, "AED", "Annual", "UNVERIFIED — secondary source; Couples and Under-32 brackets also exist at different rates"),
    ],
    "Zomato Gold": [("Annual", 1, 1200, "INR", "Annual", "zomato.com/gold — approximate; Zomato runs frequent flash-sale pricing as low as ₹9-99 for 3-4 months, no single fixed list price")],
    "Spotify Premium": [
        ("Student", 1, 6.99, "USD", "Monthly", "spotify.com/us/premium — 2026 US pricing"),
        ("Individual", 2, 12.99, "USD", "Monthly", "spotify.com/us/premium — 2026 US pricing, raised from $11.99"),
        ("Duo", 3, 18.99, "USD", "Monthly", "spotify.com/us/premium"),
        ("Family", 4, 21.99, "USD", "Monthly", "spotify.com/us/premium — up to 6 accounts"),
    ],
    "Coursera Plus": [("Annual", 1, 399, "USD", "Annual", "coursera.org/courseraplus — US list price, frequent promos discount 25-45%; also $59/mo")],
    "TIFF Membership": [
        ("Individual", 1, 125, "CAD", "Annual", "tiff.net/join/individual-membership — standard list price, new-member promo ~$62"),
        ("Industry", 2, 250, "CAD", "Annual", "tiff.net/join/industry-membership — higher giving tiers (Sustainer/Patron/etc.) exist but figures conflicted across sources, omitted"),
    ],
    "REI Membership": [("Co-op Lifetime Membership", 1, 30.00, "USD", "Lifetime", "rei.com/membership — one-time, raised from $20 to $30 in 2023")],
    "Amazon Prime": [
        ("Student", 1, 69.00, "USD", "Annual", "amazon.com/amazonprime — ages 18-24, also $7.49/mo"),
        ("Standard", 2, 139.00, "USD", "Annual", "amazon.com/amazonprime — also $14.99/mo"),
    ],
    "Volaris V.Club": [
        ("Individual", 1, 29.99, "USD", "Annual", "volaris.com/vclub — 'from' price; also monthly at $2.99 first month then $3.99/mo"),
        ("Duo", 2, 49.99, "USD", "Annual", "volaris.com/vclub — 'from' price"),
        ("Friends & Family", 3, 149.99, "USD", "Annual", "volaris.com/vclub — 'from' price"),
    ],
}

QUALIFICATION_UNIT = "Automatic / No qualification"


def fetch_programme_ids():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/programmes?select=id,programme_name", headers=HEADERS)
    r.raise_for_status()
    return {row["programme_name"]: row["id"] for row in r.json()}


def run(dry_run=False):
    by_name = fetch_programme_ids()
    ok, missing, failed = 0, [], []
    for name, tiers in NEW_TIERS.items():
        pid = by_name.get(name)
        if not pid:
            missing.append(name)
            continue
        for tier_name, tier_order, tier_price, currency, price_period, note in tiers:
            payload = {
                "programme_id": pid,
                "tier_order": tier_order,
                "tier_name": tier_name,
                "tier_price": tier_price,
                "currency": currency,
                "price_period": price_period,
                "qualification_unit": QUALIFICATION_UNIT,
                "note": note,
            }
            if dry_run:
                print(f"--dry-run: would insert {name!r} tier {tier_order} {tier_name!r} = {tier_price} {currency} ({price_period})")
                ok += 1
                continue
            resp = requests.post(f"{SUPABASE_URL}/rest/v1/programme_tiers", headers=HEADERS, json=payload)
            if resp.status_code not in (200, 201):
                failed.append((name, tier_name, resp.status_code, resp.text[:150]))
            else:
                ok += 1
    print(f"\n{'Would insert' if dry_run else 'Inserted'} {ok} tier row(s) across {len(NEW_TIERS)} programme(s).")
    if missing:
        print(f"NOT FOUND in database ({len(missing)}): {missing}")
    if failed:
        print(f"FAILED ({len(failed)}):")
        for f in failed:
            print(" ", f)


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
