#!/usr/bin/env python3
"""One-time addition: 60 new loyalty programmes (hotels, fitness/wellness, F&B,
golf/leisure, automotive, banking/retail) requested 2026-09-25, to grow the
benchmark sample beyond hospitality/golf into adjacent industries already in the
taxonomy (Fitness & Wellness, Food & Beverage, Automotive, Banking & Financial
Services, Retail, Leisure & Entertainment).

Uses the CURRENT v3 taxonomy (see migration/remap_mechanisms_v3.md, applied to
Supabase 2026-09-24): 11 mechanisms, 9 industries + Other. Field values were
assigned from general knowledge of each brand's real programme, not page-by-page
primary research for all 60 — treat industry/mechanisms as a confident first pass,
not verified fact ("Code only what the programme's official page documents" per
remap_mechanisms_v3.md), and spot-check before citing any of these in the thesis.
Source URL and logo were both given directly by the user for every programme;
launch_year and tier/fee specifics are left blank throughout rather than guessed.

This script does two things, in order:
  1. Updates migration/Details_Loyalty_Staging_Workbook.xlsx:
     a. Syncs the Industry + Mechanisms columns on the existing ~144/145 rows
        directly from the live Supabase `programmes` table (matched by
        programme_name), so the workbook mirrors the v3 taxonomy that's already
        live in the app rather than re-deriving the old->new mapping locally
        (the mapping's tier-based "Earned status" derivation rule needs live
        programme_tiers data, which Supabase already resolved).
     b. Replaces the PICK LISTS Industry and Mechanisms columns with the current
        9(+Other) industries / 11 mechanisms from assets/options.js.
     c. Appends the 60 new programmes as new PROGRAMMES rows.
  2. Inserts the same 60 programmes into Supabase (`programmes` table).

Usage: python3 add_new_programmes_2026.py [--dry-run] [--excel-only] [--db-only]
"""

import sys
import openpyxl
import requests

SUPABASE_URL = "https://dyuflyhkanmczwshmbyh.supabase.co"
SUPABASE_KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
WORKBOOK_PATH = "/Users/verasousateixeira/Desktop/Details-Loyalty-Hub/migration/Details_Loyalty_Staging_Workbook.xlsx"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# Current picklists, exactly as assets/options.js OPTIONS.industry / OPTIONS.mechanisms.
CURRENT_INDUSTRIES = [
    "Hotels & Hospitality", "Golf", "Food & Beverage", "Fitness & Wellness",
    "Leisure & Entertainment", "Automotive", "Travel & Mobility", "Retail",
    "Banking & Financial Services", "Other"
]
CURRENT_MECHANISMS = [
    "Behaviour-based rewards", "Community", "Earned status", "Ecosystem cross-use",
    "External partner network", "Included member benefits", "Member experiences & events",
    "Member pricing", "Privileged access", "Referral", "Spend-based earning"
]

# ---------------- The 60 new programmes (v3 taxonomy) ----------------
# Columns match the PROGRAMMES sheet / programmes table exactly.
# mechanisms / target_customer / geographic_scope are lists -> joined with "; " for Excel.

NEW_PROGRAMMES = [
    # ---- Hotels & Hospitality ----
    dict(programme_name="Choice Privileges", company="Choice Hotels International", parent_company=None,
         cover_image_url="https://media.choicehotels.com/download/choice-logo-privileges.png",
         industry="Hotels & Hospitality", programme_positioning="Mid-market",
         target_customer=["Mass Market", "International Customers"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "External partner network", "Privileged access"],
         source_url="https://www.choicehotels.com/en-uk/choice-privileges/account/enroll"),
    dict(programme_name="Radisson Rewards", company="Radisson Hotel Group", parent_company=None,
         cover_image_url="https://upload.wikimedia.org/wikipedia/commons/7/74/Radisson_Hotels_logo.svg",
         industry="Hotels & Hospitality", programme_positioning="Mid-market",
         target_customer=["Business Customers", "International Customers"], country="Belgium",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "External partner network", "Privileged access"],
         source_url="https://www.radissonhotels.com/pt-br/rewards"),
    dict(programme_name="Best Western Rewards", company="Best Western Hotels & Resorts", parent_company=None,
         cover_image_url="https://www.bestwestern.de/cmsimages/portal_bwde/1009/1009260.jpg",
         industry="Hotels & Hospitality", programme_positioning="Mass",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "External partner network"],
         source_url="https://www.bestwestern.pt/best-western-rewards"),
    dict(programme_name="GHA DISCOVERY", company="Global Hotel Alliance", parent_company=None,
         cover_image_url="https://logos-world.net/wp-content/uploads/2022/02/GHA-Discovery-Logo.png",
         industry="Hotels & Hospitality", programme_positioning="Premium",
         target_customer=["High-Value Customers", "International Customers"], country="United Arab Emirates",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "Ecosystem cross-use", "Member experiences & events"],
         source_url="https://www.ghadiscovery.com/"),
    dict(programme_name="Minor DISCOVERY", company="Minor Hotels", parent_company="Minor International",
         cover_image_url="https://assets.minorhotels.com/image/upload/q_auto,f_auto/media/minor/mhg/images/rebrand/loyalty/md_log_-400x111.png",
         industry="Hotels & Hospitality", programme_positioning="Premium",
         target_customer=["High-Value Customers", "International Customers"], country="Thailand",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "Ecosystem cross-use"],
         source_url="https://www.minorhotels.com/pt/loyalty"),
    dict(programme_name="Shangri-La Circle", company="Shangri-La Group", parent_company=None,
         cover_image_url="https://sitecore-cd.shangri-la.com/-/media/Shangri-La/header_footer/Global_SLCHeaderLogo.png",
         industry="Hotels & Hospitality", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers", "International Customers"], country="Hong Kong",
         geographic_scope=["Asia", "Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "Member experiences & events", "Privileged access"],
         source_url="https://www.shangri-la.com/corporate/shangrilacircle/"),
    dict(programme_name="I Prefer Hotel Rewards", company="Preferred Hotels & Resorts", parent_company=None,
         cover_image_url="https://images.squarespace-cdn.com/content/v1/674a022266552d5bd9c181dc/1732903481671-KOCHGVU4RW35OJ3EUXE3/i+Prefer+Hotel+Rewards+logo.png",
         industry="Hotels & Hospitality", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "External partner network", "Member experiences & events"],
         source_url="https://iprefer.com/"),
    dict(programme_name="Sonesta Travel Pass", company="Sonesta International Hotels", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWT7U5h2fgg3lHP3mPQiwz1oBPAgyJsjvRRzizwWKAYw&s=10",
         industry="Hotels & Hospitality", programme_positioning="Mid-market",
         target_customer=["Business Customers"], country="United States",
         geographic_scope=["North America", "Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status"],
         source_url="https://newsroom.sonesta.com/loyalty/"),
    dict(programme_name="Omni Select Guest", company="Omni Hotels & Resorts", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQy7uODLolpNGN_mzJhBFELXMYiyvCLEFTRhrE4etJTsW70VjSAeIoiWzI2&s=10",
         industry="Hotels & Hospitality", programme_positioning="Premium",
         target_customer=["High-Value Customers"], country="United States",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "Privileged access"],
         source_url="https://www.omnihotels.com/loyalty"),
    dict(programme_name="Loews YouFirst", company="Loews Hotels & Co", parent_company=None,
         cover_image_url="https://axp-loews-cmsv4-prod-app-s3-bucket.s3.eu-west-1.amazonaws.com/29018_LH_and_Co_Stacked_Logo_Black_on_White_f258dfe11e.svg",
         industry="Hotels & Hospitality", programme_positioning="Premium",
         target_customer=["High-Value Customers"], country="United States",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status"],
         source_url="https://katiegoesthere.com/loews-hotels-loyalty-program-youfirst-rewards/"),
    dict(programme_name="MGM Rewards", company="MGM Resorts International", parent_company=None,
         cover_image_url="https://media.cntraveler.com/photos/639a028c60fef5d250ae2ae1/master/w_1600%2Cc_limit/MGM%2520Rewards%2520Logo%2520-%2520Horizontal%2520-%2520Gold%2520(2).png",
         industry="Hotels & Hospitality", programme_positioning="Premium",
         target_customer=["High-Value Customers"], country="United States",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status", "Ecosystem cross-use", "Included member benefits", "Member experiences & events"],
         source_url="https://www.mgmresorts.com/en/mgm-rewards.html"),

    # ---- Fitness & Wellness ----
    dict(programme_name="The Academy Barry's", company="Barry's", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdZzuGG65NynKI1Clvl_-5wi16VMjwOuHDTq0-hiYsfxYpkTFFfKZzTgCX&s=10",
         industry="Fitness & Wellness", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Paid", access_registration="Open registration",
         mechanisms=["Behaviour-based rewards", "Community"],
         source_url="https://loyalty.barrys.com/"),
    dict(programme_name="Orangetheory Rewards", company="Orangetheory Fitness", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQry7ivemcq6IGsMWnLErK3OWmKHNQ7tex0h4YjRsU5YukA-bKLJ27LFD4&s=10",
         industry="Fitness & Wellness", programme_positioning="Mid-market",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Behaviour-based rewards", "Community"],
         source_url="https://www.orangetheory.com/en-us/memberships"),
    dict(programme_name="F45 Play", company="F45 Training", parent_company=None,
         cover_image_url="https://play-lh.googleusercontent.com/pr2b8C-DVM7L5E4dtg4ZggLVuc2X0E4xNxKoaC0mDuHHuZx_7W5vUyFoLSV4b4ICD7k61-odGhOycQz5RrIz",
         industry="Fitness & Wellness", programme_positioning="Mid-market",
         target_customer=["Enthusiasts / Hobbyists"], country="Australia",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Behaviour-based rewards", "Community", "Referral"],
         source_url="https://f45training.com/f45-fit-rewards/"),
    dict(programme_name="Pvolve", company="Pvolve", parent_company=None,
         cover_image_url="https://static.wixstatic.com/media/2668b3_96dc186453c34c89a53ab14be63345ea~mv2.jpeg",
         industry="Fitness & Wellness", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.pvolve.com/pages/on-demand"),
    dict(programme_name="Wellhub", company="Wellhub", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRI15u6o-GsRd1_oqiTpznf32I_BR-8hGP6LaD2SqnMKA&s=10",
         industry="Fitness & Wellness", programme_positioning="Mid-market",
         target_customer=["Business Customers", "Mass Market"], country="Brazil",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["External partner network", "Included member benefits"],
         source_url="https://wellhub.com/pt-pt/plans-pricing/"),
    dict(programme_name="David Lloyd", company="David Lloyd Clubs", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-DvJVUMsT9JEvRGnoEnUNvcpNjxgfhogxTKiXP3vkMQ&s=10",
         industry="Fitness & Wellness", programme_positioning="Premium",
         target_customer=["Families", "High-Value Customers"], country="United Kingdom",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits", "Community"],
         source_url="https://www.davidlloyd.co.uk/memberships/"),
    dict(programme_name="Nuffield Health", company="Nuffield Health", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRUbXSQSrTJBmP8LcT3iW0_2vUV-X02fP39n8GjxUy7LZ-528y28sxToJg&s=10",
         industry="Fitness & Wellness", programme_positioning="Mid-market",
         target_customer=["Mass Market"], country="United Kingdom",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.nuffieldhealth.com/gyms/membership"),
    dict(programme_name="Bannatyne", company="Bannatyne Group", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0y7b98J5gp17JG259JRGqiy7myqPT-HbiKGwS0JZQCQ&s=10",
         industry="Fitness & Wellness", programme_positioning="Mid-market",
         target_customer=["Mass Market"], country="United Kingdom",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits", "Community"],
         source_url="https://www.bannatyne.co.uk/health-club/membership"),
    dict(programme_name="SoulCycle", company="SoulCycle (Equinox Group)", parent_company="Equinox Group",
         cover_image_url="https://upload.wikimedia.org/wikipedia/en/7/73/Soulcyclelogo.png",
         industry="Fitness & Wellness", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["North America"], membership_type="Paid", access_registration="Open registration",
         mechanisms=["Community"],
         source_url="https://www.soul-cycle.com/series/"),
    dict(programme_name="CorePower Yoga", company="CorePower Yoga", parent_company=None,
         cover_image_url="https://images.ctfassets.net/go5rjm58sryl/1Zl4YqgMuV2K8kYYmmX9mJ/32328399e228924fcac6ce99f9214a96/Author_avatar_2",
         industry="Fitness & Wellness", programme_positioning="Mid-market",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["North America"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits", "Community"],
         source_url="https://www.corepoweryoga.com/content/buy"),

    # ---- Food & Beverage ----
    dict(programme_name="MyMcDonald's", company="McDonald's", parent_company=None,
         cover_image_url="https://www.mcdonalds.pt/images/navigation/logoMyM.svg",
         industry="Food & Beverage", programme_positioning="Mass",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Behaviour-based rewards"],
         source_url="https://www.mcdonalds.pt/em-familia/mcblog/mym-tudo-o-que-precisa-de-saber-para-comecar-a-ganhar"),
    dict(programme_name="Nando's Rewards", company="Nando's", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ6rIvfwMIHiG2V5pne6zC__RNXO5y7s8D8WM3vSsCQaQ&s=10",
         industry="Food & Beverage", programme_positioning="Mid-market",
         target_customer=["Mass Market"], country="United Kingdom",
         geographic_scope=["Europe"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Member pricing"],
         source_url="https://www.nandos.co.uk/rewards"),
    dict(programme_name="Club Pret", company="Pret A Manger", parent_company=None,
         cover_image_url="https://images.ctfassets.net/4zu8gvmtwqss/4J3tq43hFKDHLTwPXX2YBb/ee4fbeaa8ea7b08f41ec974168af5927/pret-a-manger-logo.png",
         industry="Food & Beverage", programme_positioning="Mid-market",
         target_customer=["Mass Market"], country="United Kingdom",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.pret.com/en-US/club-pret"),
    dict(programme_name="Costa Club Coffee", company="Costa Coffee", parent_company=None,
         cover_image_url="https://thumb.wikimedia.org/wikipedia/en/thumb/f/fa/Costa_Coffee_logo.svg/1280px-Costa_Coffee_logo.svg.png",
         industry="Food & Beverage", programme_positioning="Mass",
         target_customer=["Mass Market"], country="United Kingdom",
         geographic_scope=["Europe"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Behaviour-based rewards"],
         source_url="https://www.costa.co.uk/costa-club"),
    dict(programme_name="Chipotle Rewards", company="Chipotle Mexican Grill", parent_company=None,
         cover_image_url="https://www.chipotle.com/content/experience-fragments/chipotle/us/en/xf-header/master/_jcr_content/root/container_712714414/image_411084835.coreimg.svg",
         industry="Food & Beverage", programme_positioning="Mid-market",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Behaviour-based rewards", "Referral"],
         source_url="https://www.chipotle.com/rewards"),
    dict(programme_name="Taco Bell Rewards", company="Taco Bell (Yum! Brands)", parent_company="Yum! Brands",
         cover_image_url="https://tacobell.nl/wp-content/uploads/2020/07/logo.png",
         industry="Food & Beverage", programme_positioning="Mass",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Behaviour-based rewards"],
         source_url="https://tacobell.nl/en/rewards/"),
    dict(programme_name="KFC Rewards", company="KFC (Yum! Brands)", parent_company="Yum! Brands",
         cover_image_url="https://thumb.wikimedia.org/wikipedia/sco/thumb/b/bf/KFC_logo.svg/330px-KFC_logo.svg.png",
         industry="Food & Beverage", programme_positioning="Mass",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Member pricing"],
         source_url="https://www.kfmenu.com/rewards-program/"),
    dict(programme_name="Dunkin' Rewards", company="Dunkin' (Inspire Brands)", parent_company="Inspire Brands",
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTagRoFKV3RGh--2mLa33GPdNp6Zw4TfQvd_33Yq5z-ZRDR-s5QSQlVfpnd&s=10",
         industry="Food & Beverage", programme_positioning="Mass",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Earned status"],
         source_url="https://www.rivo.io/blog/dunkin-rewards-program-complete-breakdown"),
    dict(programme_name="Panera (MyPanera)", company="Panera Bread", parent_company=None,
         cover_image_url="https://www.panerabread.com/content/dam/panerabread/menu-omni/integrated-web/branding/panera-bread-logo-no-mother-bread.svg",
         industry="Food & Beverage", programme_positioning="Mid-market",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning"],
         source_url="https://www.panerabread.com/en-us/press/press-room/panera-unveils-all-new-points-based-mypanera-rewards-program.html"),
    dict(programme_name="IHOP Rewards", company="IHOP (Dine Brands)", parent_company="Dine Brands Global",
         cover_image_url="https://img1.wsimg.com/isteam/ip/79d1d149-f13c-4da7-9ae1-fc9ae599f713/86D04E9E-EA9B-433B-A9E0-7B200F7C27E2.png",
         industry="Food & Beverage", programme_positioning="Mass",
         target_customer=["Mass Market", "Families"], country="United States",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Member pricing"],
         source_url="https://ihopprairies.ca/ihop-rewards-1"),

    # ---- Leisure & Entertainment / Golf ----
    dict(programme_name="XLife - Invited Clubs", company="Invited (formerly ClubCorp)", parent_company=None,
         cover_image_url="https://alsd.com/sites/default/files//logos/Invited%20Resized.png",
         industry="Leisure & Entertainment", programme_positioning="Premium",
         target_customer=["High-Value Customers"], country="United States",
         geographic_scope=["North America"], membership_type="Paid", access_registration="Application required",
         mechanisms=["Included member benefits", "Community", "Member experiences & events", "Privileged access"],
         source_url="https://www.invitedclubs.com/coles-test-home-page/coles-test-empty-page"),
    dict(programme_name="KemperCollection", company="KemperSports", parent_company=None,
         cover_image_url="https://www.kempersports.com/wp-content/uploads/2020/03/News-Post-Featured-Image-KS-Website-COVID-19.jpg",
         industry="Golf", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["North America"], membership_type="Paid", access_registration="Open registration",
         mechanisms=["Ecosystem cross-use", "Member pricing"],
         source_url="https://www.kempersports.com/kempercollection/"),
    dict(programme_name="PGA TOUR Rewards", company="PGA Tour", parent_company=None,
         cover_image_url="https://static-assets.pgatour.com/svg-assets/logos/pga-tour-logo.svg",
         industry="Golf", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Privileged access", "Included member benefits", "Member experiences & events"],
         source_url="https://www.pgatour.com/pass"),
    dict(programme_name="Topgolf Memberships", company="Topgolf", parent_company="Topgolf Callaway Brands",
         cover_image_url="https://logos-world.net/wp-content/uploads/2023/03/Topgolf-Logo.png",
         industry="Golf", programme_positioning="Mid-market",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Member pricing", "Privileged access"],
         source_url="https://topgolf.com/us/pricing/memberships/"),
    dict(programme_name="Callaway Rewards", company="Callaway Golf", parent_company="Topgolf Callaway Brands",
         cover_image_url="https://www.callawaygolf.com/images/callaway-logo-black.svg",
         industry="Golf", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Privileged access"],
         source_url="https://www.callawaygolf.com/rewards"),
    dict(programme_name="TaylorMade Rewards", company="TaylorMade Golf", parent_company=None,
         cover_image_url="https://www.taylormadegolf.com/on/demandware.static/-/Sites-TMaG-Library/en_US/v1790309371725/logos/header-logo-taylormade.svg",
         industry="Golf", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Privileged access"],
         source_url="https://www.taylormadegolf.com/loyalty"),
    dict(programme_name="Team Titleist", company="Acushnet (Titleist)", parent_company="Acushnet Company",
         cover_image_url="https://www.titleist.com/build/assets/images/header/titleist-logo-black.svg",
         industry="Golf", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Application required",
         mechanisms=["Community", "Privileged access", "Member experiences & events"],
         source_url="https://www.titleist.com/member-benefits"),
    dict(programme_name="FootJoy Insider", company="Acushnet (FootJoy)", parent_company="Acushnet Company",
         cover_image_url="https://www.footjoy.com/on/demandware.static/-/Library-Sites-FootJoySharedLibrary/default/dw31f13b80/images/thumbnail-min.png",
         industry="Golf", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Privileged access", "Spend-based earning"],
         source_url="https://www.footjoy.com/fj-insider.html"),

    # ---- Automotive ----
    dict(programme_name="BMW Excellence Club", company="BMW", parent_company="BMW Group",
         cover_image_url="https://www.bmw.in/content/dam/bmw/common/images/logo-icons/BMW/BMW_White_Logo.svg.asset.1670245093434.svg",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="Germany",
         geographic_scope=["Asia", "Global"], membership_type="Free", access_registration="Application required",
         mechanisms=["Community", "Member experiences & events", "Privileged access"],
         source_url="https://www.bmw.in/en/topics/Fascination-BMW/bmw-excellence-club.html"),
    dict(programme_name="BMW ConnectedDrive", company="BMW", parent_company="BMW Group",
         cover_image_url="https://www.bmw.pt/content/dam/bmw/common/images/logo-icons/BMW/BMW_Grey-Colour_RGB.svg.asset.1756199978277.svg",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="Germany",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.bmw.pt/pt/shop/ls/cp/connected-drive"),
    dict(programme_name="Mercedes Benz Club Membership", company="Mercedes-Benz", parent_company="Mercedes-Benz Group",
         cover_image_url="https://www.mercedes-benz.com/static/frontend/mbcom-frontend/3.1.18/assets/140-years-38px-black.apng",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers", "Enthusiasts / Hobbyists"], country="Germany",
         geographic_scope=["Global"], membership_type="Paid", access_registration="Application required",
         mechanisms=["Community", "Member experiences & events"],
         source_url="https://www.mercedes-benz.com/en/exclusive/mercedes-benz-classic-club/club-membership/"),
    dict(programme_name="MyAudi", company="Audi", parent_company="Volkswagen Group",
         cover_image_url="https://makerworld.bblmw.com/makerworld/model/US8ec7b571d2726d/design/2025-03-23_23aae48e33ffe.png",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="Germany",
         geographic_scope=["Europe"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.audi.pt/servico-e-acessorios/servicos-digitais-audi/myaudi"),
    dict(programme_name="Porsche Club Portugal", company="Porsche", parent_company="Porsche AG",
         cover_image_url="https://images.seeklogo.com/logo-png/16/1/porsche-logo-png_seeklogo-168544.png",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers", "Enthusiasts / Hobbyists"], country="Portugal",
         geographic_scope=["Portugal"], membership_type="Paid", access_registration="Application required",
         mechanisms=["Community", "Member experiences & events"],
         source_url="https://www.porscheclub.pt/PorscheClubs/pc_portugal/pc_main.nsf/web/AFC24D032E810FC9C12573A6005AA38B"),
    dict(programme_name="Lexus", company="Lexus", parent_company="Toyota Motor Corporation",
         cover_image_url="https://www.lexus.com/content/dam/lexus/content-fragments/navigation/global-nav-v2/assets/lexus-logo.svg",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="Japan",
         geographic_scope=["Global"], membership_type="Hybrid", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://support.lexus.com/s/article/Subscription-Plans-L"),
    dict(programme_name="Toyota Go", company="Toyota", parent_company="Toyota Motor Corporation",
         cover_image_url="https://mag.toyota.co.uk/wp-content/uploads/sites/2/2020/07/toyota-logo-2020.png",
         industry="Automotive", programme_positioning="Mass",
         target_customer=["Mass Market"], country="Australia",
         geographic_scope=["Oceania"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Behaviour-based rewards", "External partner network"],
         source_url="https://www.toyota.com.au/membership"),
    dict(programme_name="FordPass", company="Ford", parent_company="Ford Motor Company",
         cover_image_url="https://www.ford.pt/content/dam/guxeu/global-shared/header/ford-logo_DSe_global_nav_Dark.svg",
         industry="Automotive", programme_positioning="Mass",
         target_customer=["Mass Market"], country="United States",
         geographic_scope=["Global"], membership_type="Hybrid", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Included member benefits"],
         source_url="https://www.ford.pt/proprietario/subscricao-fordpass"),
    dict(programme_name="Hyundai Rewards", company="Hyundai", parent_company="Hyundai Motor Group",
         cover_image_url="https://logos-world.net/wp-content/uploads/2021/03/Hyundai-Logo.png",
         industry="Automotive", programme_positioning="Mass",
         target_customer=["Mass Market"], country="South Korea",
         geographic_scope=["North America"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning"],
         source_url="https://myrewards.hyundaiusa.com/"),
    dict(programme_name="Kia Connect", company="Kia", parent_company="Hyundai Motor Group",
         cover_image_url="https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/KIA_logo2.svg/3840px-KIA_logo2.svg.png",
         industry="Automotive", programme_positioning="Mass",
         target_customer=["Mass Market"], country="South Korea",
         geographic_scope=["North America"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://owners.kia.com/us/en/uvo-compare-packages.html"),
    dict(programme_name="NissanConnect", company="Nissan", parent_company="Nissan Motor Corporation",
         cover_image_url="https://libs-europe.nissan-cdn.net/etc/designs/pace-omni-nav/ui-build/assets/images/nissan-next-logo-text.svg",
         industry="Automotive", programme_positioning="Mass",
         target_customer=["Mass Market"], country="Japan",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.nissan.pt/clientes/connectivity.html"),
    dict(programme_name="Care by Volvo", company="Volvo", parent_company="Volvo Cars",
         cover_image_url="https://1000logos.net/wp-content/uploads/2020/03/Volvo-Logo-1930.png",
         industry="Automotive", programme_positioning="Premium",
         target_customer=["Premium / Luxury Customers"], country="Sweden",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://dev-cbv.volvoprograms.com/"),
    dict(programme_name="Range Rover Owner", company="Land Rover", parent_company="Jaguar Land Rover",
         cover_image_url="https://images.seeklogo.com/logo-png/42/2/range-rover-logo-png_seeklogo-428443.png",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="United Kingdom",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Community", "Member experiences & events"],
         source_url="https://www.rangeroverowner.com/"),
    dict(programme_name="Club Land Rover", company="Land Rover", parent_company="Jaguar Land Rover",
         cover_image_url="https://clubelandrover.pt/wp-content/uploads/2018/05/Ativo-1.png",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="Portugal",
         geographic_scope=["Portugal"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Community", "Member experiences & events"],
         source_url="https://clubelandrover.pt/"),
    dict(programme_name="Jaguar Subscription", company="Jaguar", parent_company="Jaguar Land Rover",
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQlmwxLmEgPPpDve-_4ZslSVTvrlwQx-Iy9jks9WnsUiVz14yVXHombJkRPccm8cr1HYO6BAbkYsCyu9cVLrHtjYiNUijoExSSreaLSeLk&s=10",
         industry="Automotive", programme_positioning="Luxury",
         target_customer=["Premium / Luxury Customers"], country="United Kingdom",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.jaguar.com.cy/offers-and-finance/jaguar-subscription"),
    dict(programme_name="MINI Connected Package", company="MINI", parent_company="BMW Group",
         cover_image_url="https://www.mini.pt/etc.clientlibs/settings/wcm/designs/minidigital-white/images/logo/resources/mini-logo.svg",
         industry="Automotive", programme_positioning="Premium",
         target_customer=["Mass Market"], country="Germany",
         geographic_scope=["Europe"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.mini.pt/pt_PT/home/mini-digital-experience/mini-connected-upgrades.html"),
    dict(programme_name="Tesla Connectivity Premium", company="Tesla", parent_company=None,
         cover_image_url="https://static.vecteezy.com/system/resources/previews/020/336/484/non_2x/tesla-logo-tesla-icon-transparent-png-free-vector.jpg",
         industry="Automotive", programme_positioning="Premium",
         target_customer=["Premium / Luxury Customers"], country="United States",
         geographic_scope=["Global"], membership_type="Subscription", access_registration="Open registration",
         mechanisms=["Included member benefits"],
         source_url="https://www.tesla.com/en_qa/support/connectivity"),

    # ---- Banking / Retail / Entertainment ----
    dict(programme_name="Mastercard Priceless", company="Mastercard", parent_company=None,
         cover_image_url="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg",
         industry="Banking & Financial Services", programme_positioning="Premium",
         target_customer=["Premium / Luxury Customers", "International Customers"], country="United States",
         geographic_scope=["Global"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Member experiences & events", "Privileged access", "External partner network"],
         source_url="https://www.mastercard.com/pt/pt/pessoal/experience-mastercard/priceless.html"),
    dict(programme_name="Aura", company="Alshaya Group", parent_company="M.H. Alshaya Co.",
         cover_image_url="https://upload.wikimedia.org/wikipedia/en/b/bf/M.H._Alshaya_Co._Logo.png",
         industry="Retail", programme_positioning="Mid-market",
         target_customer=["Mass Market", "International Customers"], country="Kuwait",
         geographic_scope=["Middle East"], membership_type="Free", access_registration="Open registration",
         mechanisms=["Spend-based earning", "Ecosystem cross-use", "External partner network"],
         source_url="https://www.alshaya.com/ae/en/media-centre/alshaya-news/aura-wins-best-strategic-"),
    # Copacoins (Copaco) intentionally omitted: it duplicates the pre-existing
    # "CopaCoins" record (id 1e75a58e-..., added 2026-09-24 by André) for the same
    # company/URL — that record already has a fuller points_notes description, so
    # the near-duplicate inserted here on first run was deleted rather than kept.
    dict(programme_name="TIFF Membership", company="Toronto International Film Festival", parent_company=None,
         cover_image_url="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIRV1KCJjrzz3b5dXybKZy8l0v_8fJe93Q8OqTW0OloQ&s",
         industry="Leisure & Entertainment", programme_positioning="Premium",
         target_customer=["Enthusiasts / Hobbyists", "Local Customers"], country="Canada",
         geographic_scope=["North America"], membership_type="Paid", access_registration="Open registration",
         mechanisms=["Privileged access", "Member experiences & events", "Included member benefits"],
         source_url="https://tiff.net/membership"),
]


def join_multi(vals):
    return "; ".join(vals) if vals else None


# Workbook still has the pre-rename names for these rows (Supabase's programme_name
# was shortened/consolidated in a later session) — map old workbook name -> live name.
NAME_ALIASES = {
    "golf studio vilamoura coaching packages": "gsv coaching packages",
    "quinta do lago employee benefits programme": "qdl employee benefits",
    "peloton membership / club peloton": "club peloton",
    "hbr subscriptions (digital / print & digital / premium / executive)": "hbr subscriptions",
    "bloomberg subscriptions (digital / all access / student / corporate)": "bloomberg subscriptions",
    "financial times subscriptions (standard digital / premium digital / print)": "financial times subscriptions",
    "oura membership (oura subscription)": "oura subscription",
}


def fetch_live_programmes():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/programmes?select=programme_name,company,industry,mechanisms", headers=HEADERS)
    r.raise_for_status()
    return r.json()


def update_excel(dry_run=False):
    wb = openpyxl.load_workbook(WORKBOOK_PATH, data_only=False)

    # --- 1a. Sync existing rows' Industry + Mechanisms straight from live Supabase ---
    live = fetch_live_programmes()
    live_by_name = {row["programme_name"].strip().lower(): row for row in live if row.get("programme_name")}

    ws = wb["PROGRAMMES"]
    headers = [c.value for c in ws[4]]
    industry_col = headers.index("Industry *") + 1
    mech_col = headers.index("Mechanisms") + 1
    matched, unmatched = 0, []
    for row in ws.iter_rows(min_row=5, max_row=148):
        name_cell = row[0]
        if not name_cell.value:
            continue
        lookup_key = str(name_cell.value).strip().lower()
        lookup_key = NAME_ALIASES.get(lookup_key, lookup_key)
        live_row = live_by_name.get(lookup_key)
        if not live_row:
            unmatched.append(name_cell.value)
            continue
        row[industry_col - 1].value = live_row.get("industry")
        row[mech_col - 1].value = join_multi(live_row.get("mechanisms"))
        matched += 1
    print(f"Synced Industry + Mechanisms on {matched} existing workbook row(s) from live Supabase.")
    if unmatched:
        print(f"  {len(unmatched)} row(s) had no live match (left as-is): {unmatched}")

    # --- 1b. Replace PICK LISTS Industry + Mechanisms columns with current picklists ---
    pl = wb["PICK LISTS"]
    pl_headers = [c.value for c in pl[3]]
    industry_pl_col = pl_headers.index("Industry") + 1
    mech_pl_col = pl_headers.index("Mechanisms") + 1
    for i in range(4, 30):
        pl.cell(row=i, column=industry_pl_col).value = None
        pl.cell(row=i, column=mech_pl_col).value = None
    for i, val in enumerate(CURRENT_INDUSTRIES):
        pl.cell(row=4 + i, column=industry_pl_col).value = val
    for i, val in enumerate(CURRENT_MECHANISMS):
        pl.cell(row=4 + i, column=mech_pl_col).value = val
    print(f"Replaced PICK LISTS Industry ({len(CURRENT_INDUSTRIES)} items) and Mechanisms ({len(CURRENT_MECHANISMS)} items) columns.")

    # --- 1c. Append the 60 new programmes ---
    next_row = ws.max_row + 1
    for p in NEW_PROGRAMMES:
        ws.cell(row=next_row, column=1).value = p["programme_name"]
        ws.cell(row=next_row, column=2).value = p["company"]
        ws.cell(row=next_row, column=3).value = p.get("parent_company")
        ws.cell(row=next_row, column=4).value = p.get("cover_image_url")
        ws.cell(row=next_row, column=5).value = p.get("launch_year")
        ws.cell(row=next_row, column=6).value = p["industry"]
        ws.cell(row=next_row, column=7).value = None  # Sub-Industry — deprecated
        ws.cell(row=next_row, column=8).value = p.get("programme_positioning")
        ws.cell(row=next_row, column=9).value = join_multi(p.get("target_customer"))
        ws.cell(row=next_row, column=10).value = p["country"]
        ws.cell(row=next_row, column=11).value = join_multi(p.get("geographic_scope"))
        ws.cell(row=next_row, column=12).value = p["membership_type"]
        ws.cell(row=next_row, column=13).value = p["access_registration"]
        ws.cell(row=next_row, column=14).value = join_multi(p.get("mechanisms"))
        ws.cell(row=next_row, column=15).value = None  # Benefits — deprecated
        ws.cell(row=next_row, column=21).value = p["source_url"]
        next_row += 1
    print(f"Appended {len(NEW_PROGRAMMES)} new programme row(s) (rows {ws.max_row - len(NEW_PROGRAMMES) + 1}-{ws.max_row}).")

    if dry_run:
        print("--dry-run: workbook not saved.")
    else:
        wb.save(WORKBOOK_PATH)
        print(f"Saved {WORKBOOK_PATH}")


def insert_into_supabase(dry_run=False):
    if dry_run:
        print(f"--dry-run: would insert {len(NEW_PROGRAMMES)} programme(s) into Supabase.")
        return
    ok, failed = 0, []
    for p in NEW_PROGRAMMES:
        payload = {
            "programme_name": p["programme_name"],
            "company": p["company"],
            "parent_company": p.get("parent_company"),
            "cover_image_url": p.get("cover_image_url"),
            "launch_year": p.get("launch_year"),
            "industry": p["industry"],
            "programme_positioning": p.get("programme_positioning"),
            "target_customer": p.get("target_customer") or [],
            "country": p["country"],
            "geographic_scope": p.get("geographic_scope") or [],
            "membership_type": p["membership_type"],
            "access_registration": p["access_registration"],
            "mechanisms": p.get("mechanisms") or [],
            "source_url": p["source_url"],
            "created_by": "Migration",
        }
        resp = requests.post(f"{SUPABASE_URL}/rest/v1/programmes", headers=HEADERS, json=payload)
        if resp.status_code not in (200, 201):
            print(f"FAILED '{p['programme_name']}': {resp.status_code} {resp.text}")
            failed.append(p["programme_name"])
            continue
        ok += 1
        print(f"OK  '{p['programme_name']}' -> {resp.json()[0]['id']}")
    print(f"\nInserted {ok}/{len(NEW_PROGRAMMES)} programme(s) into Supabase.")
    if failed:
        print("Failed:", failed)


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    do_excel = "--db-only" not in sys.argv
    do_db = "--excel-only" not in sys.argv
    if do_excel:
        update_excel(dry_run=dry_run)
    if do_db:
        insert_into_supabase(dry_run=dry_run)
