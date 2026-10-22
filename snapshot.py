#!/usr/bin/env python3
"""Writes data/programmes.json: a static copy of the programme list used to draw the Database and Analysis pages
instantly (the live database is then queried in the background and replaces it when it answers). Run it, then
bump-version.py, before deploying:

    python3 snapshot.py && python3 bump-version.py
"""
import json
import os
import requests

B = "https://dyuflyhkanmczwshmbyh.supabase.co/rest/v1"
K = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
COLS = ("id,programme_name,company,industry,country,geographic_scope,programme_positioning,membership_type,access_registration,"
        "target_customer,mechanisms_14,benefits_18,recode_status,created_by,created_at,cover_image_url,launch_year,source_url,"
        "points_expires,points_expiration_period,points_notes,partner_companies,discount_types,programme_tiers(id),programme_features(feature_name)")
r = requests.get(f"{B}/programmes", params={"select": COLS, "or": "(recode_status.is.null,recode_status.neq.Excluded)", "order": "programme_name.asc", "limit": "5000"},
                 headers={"apikey": K}, timeout=60)
r.raise_for_status()
rows = r.json()
os.makedirs("data", exist_ok=True)
json.dump(rows, open("data/programmes.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(rows), "programmes ->", os.path.getsize("data/programmes.json") // 1024, "KB")
