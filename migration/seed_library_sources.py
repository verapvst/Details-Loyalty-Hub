#!/usr/bin/env python3
"""One-time seed: adds "Internal Team Analysis" and "Details" as ordinary rows in the
`sources` table, so they show up in the Source picker like any other source instead of
being a hardcoded special case. Safe to re-run — skips any name that already exists.
"""

import requests

SUPABASE_URL = "https://dyuflyhkanmczwshmbyh.supabase.co"
SUPABASE_KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

SEED_SOURCES = [
    {
        "source_name": "Internal Team Analysis",
        "author_org": "Details Loyalty Hub Team",
        "year": None,
        "source_type": "Other",
        "link_or_path": None,
        "short_citation": "Internal Team Analysis",
        "full_citation": "Internal Team Analysis. Cross-source or cross-programme analysis produced by the Details Loyalty Hub team, not tied to one external source.",
        "scope": ["Details"],
        "created_by": "Migration",
    },
    {
        "source_name": "Details",
        "author_org": "Details",
        "year": None,
        "source_type": "Other",
        "link_or_path": None,
        "short_citation": "Details",
        "full_citation": "Details. Information provided directly by a Details stakeholder, e.g. in an interview or meeting — see the insight's Source Detail field for who, when and context.",
        "scope": ["Details"],
        "created_by": "Migration",
    },
]


def main():
    resp = requests.get(f"{SUPABASE_URL}/rest/v1/sources", headers=HEADERS, params={"select": "source_name"})
    resp.raise_for_status()
    existing = {s["source_name"] for s in resp.json()}

    for s in SEED_SOURCES:
        if s["source_name"] in existing:
            print(f"SKIP  '{s['source_name']}' already exists")
            continue
        r = requests.post(f"{SUPABASE_URL}/rest/v1/sources", headers=HEADERS, json=s)
        if r.status_code not in (200, 201):
            print(f"FAILED '{s['source_name']}': {r.status_code} {r.text}")
        else:
            print(f"OK    '{s['source_name']}' -> {r.json()[0]['id']}")


if __name__ == "__main__":
    main()
