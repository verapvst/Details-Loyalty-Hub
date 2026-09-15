#!/usr/bin/env python3
"""One-time script: adds the Features identified in the Favorites/Likes analysis to
their respective already-imported programmes."""

import requests

SUPABASE_URL = "https://dyuflyhkanmczwshmbyh.supabase.co"
SUPABASE_KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

FEATURES = [
    ("The North Face XPLR Pass", "Tier names echo outdoor/nature themes (mountain- and adventure-inspired naming) rather than generic status labels"),
    ("Peloton Membership / Club Peloton", "Members can vote on certain product and community decisions, not just consume content"),
    ("Bloomberg Subscriptions (Digital / All Access / Student / Corporate)", "Subscription can be gifted to another person, marketed as “give the gift of insight”"),
    ("Amazon Prime", "One membership spans shipping, video, music, books and more in a single subscription"),
    ("Amazon Prime", "5% cashback on Amazon.com purchases via the co-branded Prime Rewards card"),
    ("The North Face XPLR Pass", "Members earn points for checking in / browsing products in-store, not just for purchasing"),
    ("ClassPass", "Members buy a pool of credits and spend them flexibly across thousands of independent partner studios"),
    ("Oura Membership (Oura Subscription)", "Requires an upfront hardware purchase (the ring) plus an ongoing software/insights subscription"),
]


def main():
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/programmes?select=id,programme_name",
        headers=HEADERS,
    )
    resp.raise_for_status()
    by_name = {p["programme_name"]: p["id"] for p in resp.json()}

    for name, feature_name in FEATURES:
        prog_id = by_name.get(name)
        if not prog_id:
            print(f"SKIP (programme not found): {name!r}")
            continue
        payload = {"programme_id": prog_id, "feature_name": feature_name, "created_by": "Analysis"}
        r = requests.post(f"{SUPABASE_URL}/rest/v1/programme_features", headers=HEADERS, json=payload)
        if r.status_code in (200, 201):
            print(f"OK  {name}: {feature_name}")
        else:
            print(f"FAILED  {name}: {r.status_code} {r.text}")


if __name__ == "__main__":
    main()
