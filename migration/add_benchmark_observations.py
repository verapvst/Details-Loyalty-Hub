#!/usr/bin/env python3
"""One-time script: imports 23 benchmark observations into the Favourites/Likes system,
mapped to existing structured targets (Mechanism / Benefit / Feature / Target Customer /
Membership Type) wherever possible, per the team's explicit mapping brief — rather than
23 generic free-text favourites.

Notes on judgment calls made while executing this mapping (see conversation for full
reasoning):
- Attributed to liked_by="Analysis" (not a real team member), matching the precedent set
  by add_analysis_features.py — rule was not to fake another team member's personal like.
- 6 programmes needed a Mechanism/Benefit/Target Customer value added to their own record
  before a Like could attach to it (the value existed in the taxonomy but wasn't yet
  selected on that programme): Amazon Prime (+Cashback mechanism & benefit), Marriott
  Bonvoy (+Personalisation mechanism, +Personalised Benefits benefit), Spotify Premium
  (+Families target customer), Harley Owners Group (+Exclusivity), Bloomberg
  Subscriptions (+Personalisation, +Referral), ClassPass (+Cross-brand / Ecosystem
  Access).
- 9 of the requested Features already existed from the earlier add_analysis_features.py
  import (near-identical wording) — reused those instead of creating duplicates. Only 4
  genuinely new Features were created (HBR tier-needs progression, Bloomberg packages
  tailored, Bloomberg gift framing, ClassPass remaining-credits).
- Patagonia's second requested target (Access/Registration) was skipped: that field
  isn't a likeable target in this system by original design, so the detail was folded
  into the Exclusivity like's notes instead.
- Gym memberships (#23) attached to VivaGym Memberships' real membership_type value
  ("Subscription"), not the brief's generic "Paid", since that's what's actually on the
  record.
- RevPoints' (Revolut) membership_type was left as "Hybrid" (its accurate real value)
  rather than forced to "Paid"/"Subscription".

Usage: python3 add_benchmark_observations.py
"""

import requests

SUPABASE_URL = "https://dyuflyhkanmczwshmbyh.supabase.co"
SUPABASE_KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}
LIKED_BY = "Analysis"

P = {
    "revpoints": "85aa033f-be0d-4bd8-9a46-6be5b0e5b152",
    "ulta": "5ea3e3ef-85b8-48b7-a9b5-450afcb193b6",
    "amazon": "a232111b-c3e0-44f9-9ad2-de3eb274dcf3",
    "nike": "ad3bd911-812b-4d60-8799-b3cf378ceee7",
    "delta": "403a2498-8de9-4cb8-b506-8e909848de99",
    "marriott": "0651490c-baf2-4fa0-b890-1de7aeee416f",
    "spotify": "11167465-5002-416e-aab7-efb7150b1669",
    "patagonia": "44613444-f490-4efa-8997-62466d9dc952",
    "peloton": "3a0a3a78-ebcc-46fe-813c-a602a9a4e10b",
    "harley": "0630ca84-74b5-41fe-b91e-e4bb59bceea5",
    "northface": "b43590c4-30ac-456c-9e1e-9cbfd518cf52",
    "hbr": "7ae7d159-b9f4-4517-9562-877ddcc3004b",
    "bloomberg": "94dedd6b-45cf-4fa3-974d-e0122bdb280a",
    "classpass": "b5fe264b-cfe4-4a51-b1a9-65152323be5a",
    "oura": "45cb56e4-8e14-4bc3-86b1-2ab22a9ed6e1",
    "vivagym": "d561ed3c-a457-4dac-aa23-ec407b0b37ce",
}

# Programme-level field additions needed before a Like could attach to that target.
PROGRAMME_UPDATES = [
    (P["amazon"], {
        "mechanisms": ["Discounts", "Exclusivity", "Early Access", "Partnerships", "Cross-brand / Ecosystem Access", "Cashback"],
        "benefits": ["Discounts", "Partner Benefits", "Priority Access", "Access / Exclusivity", "Complimentary Services", "Cashback"],
    }),
    (P["marriott"], {
        "mechanisms": ["Points", "Tiering", "Discounts", "Status Recognition", "Cross-brand / Ecosystem Access", "Personalisation"],
        "benefits": ["Points / Redeemable Rewards", "Discounts", "Upgrades", "Priority Access", "Complimentary Services", "Personalised Benefits"],
    }),
    (P["spotify"], {"target_customer": ["Mass Market", "Young Adults", "Students", "Families"]}),
    (P["harley"], {"mechanisms": ["Points", "Community", "Partnerships", "Status Recognition", "Exclusivity"]}),
    (P["bloomberg"], {"mechanisms": ["Tiering", "Discounts", "Personalisation", "Referral"]}),
    (P["classpass"], {"mechanisms": ["Tiering", "Partnerships", "Personalisation", "Cross-brand / Ecosystem Access"]}),
]

# New Features (the 9 requested that already existed from add_analysis_features.py were
# reused instead — see FEATURE_IDS below, filled in after creation for the likes step).
NEW_FEATURES = [
    (P["hbr"], "Tiers designed around progressively different customer needs (information → personalisation → discounts/events)"),
    (P["bloomberg"], "Packages tailored to different customer profiles / needs"),
    (P["bloomberg"], "Gift framed as “a year of insight” rather than a monetary value"),
    (P["classpass"], "Remaining credits can motivate additional credit purchases"),
]

# feature_name -> id, for features that already existed and were reused rather than duplicated.
EXISTING_FEATURE_NAMES = {
    "amazon_eco": (P["amazon"], "One membership spans shipping, video, music, books and more in a single subscription"),
    "amazon_cash": (P["amazon"], "5% cashback on Amazon.com purchases via the co-branded Prime Rewards card"),
    "spotify_duo": (P["spotify"], "Duo/Family plans give each member their own personalised account while splitting the cost"),
    "peloton_vote": (P["peloton"], "Members can vote on certain product and community decisions, not just consume content"),
    "nf_tiernames": (P["northface"], "Tier names echo outdoor/nature themes (mountain- and adventure-inspired naming) rather than generic status labels"),
    "nf_instore": (P["northface"], "Members earn points for checking in / browsing products in-store, not just for purchasing"),
    "bloomberg_gift": (P["bloomberg"], "Subscription can be gifted to another person, marketed as “give the gift of insight”"),
    "classpass_credits": (P["classpass"], "Members buy a pool of credits and spend them flexibly across thousands of independent partner studios"),
    "oura_hardware": (P["oura"], "Requires an upfront hardware purchase (the ring) plus an ongoing software/insights subscription"),
}


def rest(table):
    return f"{SUPABASE_URL}/rest/v1/{table}"


def update_programmes():
    for prog_id, fields in PROGRAMME_UPDATES:
        r = requests.patch(f"{rest('programmes')}?id=eq.{prog_id}", headers=HEADERS, json=fields)
        print(f"{'OK' if r.ok else 'FAILED'}  programme update {prog_id}: {r.status_code}")


def create_features():
    rows = [{"programme_id": pid, "feature_name": name, "created_by": LIKED_BY} for pid, name in NEW_FEATURES]
    r = requests.post(rest("programme_features"), headers={**HEADERS, "Prefer": "return=representation"}, json=rows)
    r.raise_for_status()
    created = {row["feature_name"]: row["id"] for row in r.json()}
    print(f"OK  created {len(created)} new features")
    return created


def find_existing_feature_ids():
    ids = {}
    for key, (prog_id, name) in EXISTING_FEATURE_NAMES.items():
        r = requests.get(
            f"{rest('programme_features')}?programme_id=eq.{prog_id}&feature_name=eq.{requests.utils.quote(name)}&select=id",
            headers=HEADERS,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            print(f"WARNING: existing feature not found for {key!r} ({name!r})")
            continue
        ids[key] = rows[0]["id"]
    return ids


def build_likes(new_feature_ids, existing_feature_ids):
    def like(programme_id, target_type, target_label, target_id, description, psych, notes):
        return {
            "programme_id": programme_id, "liked_by": LIKED_BY, "target_type": target_type,
            "target_label": target_label, "target_id": target_id, "description": description,
            "psychological_effect": psych, "psychological_effect_notes": notes,
        }

    F = existing_feature_ids
    NF = {
        "hbr_tiers_needs": new_feature_ids["Tiers designed around progressively different customer needs (information → personalisation → discounts/events)"],
        "bloomberg_packages": new_feature_ids["Packages tailored to different customer profiles / needs"],
        "bloomberg_gift_framing": new_feature_ids["Gift framed as “a year of insight” rather than a monetary value"],
        "classpass_remaining": new_feature_ids["Remaining credits can motivate additional credit purchases"],
    }

    return [
        like(P["revpoints"], "mechanism", "Tiering", None,
             "Paid tiers/packages — customers choose between predefined levels with increasing benefits and fees.",
             ["Anchoring", "Status / Signalling"],
             "Higher tiers can make lower/mid tiers feel more attractive by comparison; tier architecture can also influence choice through anchoring/decoy effects."),

        like(P["ulta"], "mechanism", "Tiering", None,
             "Spend-based tiers — status is unlocked according to how much the customer spends.",
             ["Goal-Gradient", "Status / Signalling"], None),

        like(P["amazon"], "mechanism", "Cross-brand / Ecosystem Access", None,
             "Cross-asset ecosystem — one membership combines multiple services such as shipping, video, books, etc.",
             ["Convenience", "Loss Aversion"],
             "Once customers have access to multiple benefits, they may feel motivated to use them and perceive additional benefits as incremental value from an existing membership."),
        like(P["amazon"], "feature", "One membership spans shipping, video, music, books and more in a single subscription", F["amazon_eco"],
             "Cross-asset ecosystem — one membership combines multiple services such as shipping, video, books, etc.",
             ["Convenience", "Loss Aversion"],
             "Once customers have access to multiple benefits, they may feel motivated to use them and perceive additional benefits as incremental value from an existing membership."),

        like(P["amazon"], "mechanism", "Cashback", None,
             "5% cashback / member-specific financial benefit.", ["Loss Aversion"],
             "A concrete financial benefit can encourage additional consumption because members may feel they are missing out on a benefit associated with their membership."),
        like(P["amazon"], "benefit", "Cashback", None,
             "5% cashback / member-specific financial benefit.", ["Loss Aversion"],
             "A concrete financial benefit can encourage additional consumption because members may feel they are missing out on a benefit associated with their membership."),
        like(P["amazon"], "feature", "5% cashback on Amazon.com purchases via the co-branded Prime Rewards card", F["amazon_cash"],
             "5% cashback / member-specific financial benefit.", ["Loss Aversion"],
             "A concrete financial benefit can encourage additional consumption because members may feel they are missing out on a benefit associated with their membership."),

        like(P["nike"], "mechanism", "Exclusivity", None,
             "Exclusivity + community — membership provides access to an exclusive community and member experiences.",
             ["Social Proof", "Scarcity", "Status / Signalling"], None),
        like(P["nike"], "mechanism", "Community", None,
             "Exclusivity + community — membership provides access to an exclusive community and member experiences.",
             ["Social Proof", "Scarcity", "Status / Signalling"], None),

        like(P["delta"], "mechanism", "Partnerships", None,
             "Extensive partnerships — loyalty ecosystem extends across many external brands and services.",
             ["Convenience"],
             "The wider the ecosystem in which membership can be used, the more useful and valuable the membership can become."),

        like(P["delta"], "mechanism", "Tiering", None,
             "Higher tiers earn more — status progression increases the rate at which members accumulate rewards.",
             ["Goal-Gradient", "Status / Signalling"], None),

        like(P["marriott"], "mechanism", "Tiering", None,
             "Nights-based tiers — progression depends on number of nights stayed rather than direct spending.",
             ["Goal-Gradient", "Status / Signalling"], None),

        like(P["marriott"], "mechanism", "Personalisation", None,
             "Flexibility / personalisation of benefits.", ["Convenience"],
             "Greater choice and control can make the programme feel more adapted to the individual customer."),
        like(P["marriott"], "benefit", "Personalised Benefits", None,
             "Flexibility / personalisation of benefits.", ["Convenience"],
             "Greater choice and control can make the programme feel more adapted to the individual customer."),

        like(P["spotify"], "target_customer", "Families", None,
             "Consumer-specific packages — Individual, Duo, Student, Family rather than simply Silver/Gold tiers.",
             ["Convenience"],
             "Segmentation by life situation (not tier rank), so classified as target-customer rather than Tiering; the 'Personalisation' angle from the brief is captured here as a note rather than a taxonomy value."),
        like(P["spotify"], "feature", "Duo/Family plans give each member their own personalised account while splitting the cost", F["spotify_duo"],
             "Consumer-specific packages — Individual, Duo, Student, Family rather than simply Silver/Gold tiers.",
             ["Convenience"], None),

        like(P["patagonia"], "mechanism", "Exclusivity", None,
             "Exclusive / difficult-to-access membership experience (Patagonia Pro Program requires an application).",
             ["Scarcity", "Status / Signalling", "Loss Aversion"],
             "Access is application-based (restricted to qualified professionals/partners), reinforcing the exclusivity signal — noted here since Access/Registration is not itself a likeable field in this system."),

        like(P["peloton"], "feature", "Members can vote on certain product and community decisions, not just consume content", F["peloton_vote"],
             "Members have voting power / governance participation.", [],
             "Having a voice in the company can create a sense of psychological ownership and make members feel they have a stake in the ecosystem."),

        like(P["harley"], "mechanism", "Exclusivity", None,
             "Exclusive member events.", ["Social Proof", "Status / Signalling"],
             "Events can transform a transactional programme into a social community and strengthen attachment to the brand."),
        like(P["harley"], "benefit", "Experiences / Events", None,
             "Exclusive member events.", ["Social Proof", "Status / Signalling"],
             "Events can transform a transactional programme into a social community and strengthen attachment to the brand."),

        like(P["northface"], "feature", "Tier names echo outdoor/nature themes (mountain- and adventure-inspired naming) rather than generic status labels", F["nf_tiernames"],
             "Nature-oriented tier names / positioning rather than generic Silver/Gold naming.", [],
             "Reinforces identity congruence / self-congruity between the brand's outdoor positioning and the member's self-image, rather than fitting a psychological-effect taxonomy category."),

        like(P["northface"], "mechanism", "Points", None,
             "Points for visiting / checking products in-store.", ["Variable Reward"],
             "Rewards can reinforce behaviours beyond direct purchases and increase physical engagement with the brand; the gamified check-in mechanic is the distinctive detail (see linked Feature)."),
        like(P["northface"], "feature", "Members earn points for checking in / browsing products in-store, not just for purchasing", F["nf_instore"],
             "Points for visiting / checking products in-store.", ["Variable Reward"], None),

        like(P["hbr"], "mechanism", "Tiering", None,
             "Each tier unlocks a different customer need — e.g. information → personalisation → discounts/events.", [],
             "The progression is organised around escalating customer needs rather than a single psychological-effect category — see linked Feature."),
        like(P["hbr"], "feature", "Tiers designed around progressively different customer needs (information → personalisation → discounts/events)", NF["hbr_tiers_needs"],
             "Each tier unlocks a different customer need — e.g. information → personalisation → discounts/events.", [], None),

        like(P["bloomberg"], "mechanism", "Personalisation", None,
             "Client-specific packages / needs — products and benefits tailored to different customer profiles.", ["Convenience"],
             "Higher relevance can increase perceived value and reduce the psychological cost of paying for unused benefits."),
        like(P["bloomberg"], "feature", "Packages tailored to different customer profiles / needs", NF["bloomberg_packages"],
             "Client-specific packages / needs — products and benefits tailored to different customer profiles.", ["Convenience"], None),

        like(P["bloomberg"], "feature", "Gift framed as “a year of insight” rather than a monetary value", NF["bloomberg_gift_framing"],
             "Gift \"one year of insights\" rather than simply gifting monetary value.", [],
             "The same economic value can feel more meaningful when framed as a concrete experience or value proposition rather than money (a framing effect) — not currently a taxonomy category, so noted here."),

        like(P["bloomberg"], "mechanism", "Referral", None,
             "Gifting the subscription to another person.", ["Social Proof", "Reciprocity"],
             "Existing customers can become a mechanism for introducing the brand to new customers through a trusted social relationship."),
        like(P["bloomberg"], "feature", "Subscription can be gifted to another person, marketed as “give the gift of insight”", F["bloomberg_gift"],
             "Gifting the subscription to another person.", ["Social Proof", "Reciprocity"], None),

        like(P["classpass"], "mechanism", "Cross-brand / Ecosystem Access", None,
             "Credit-based flexibility — customers buy a pool of credits and choose how to allocate them across different experiences.", ["Convenience"],
             "The model gives customers autonomy to construct their own experience rather than being locked into one service — autonomy isn't a current taxonomy category, so noted here."),
        like(P["classpass"], "feature", "Members buy a pool of credits and spend them flexibly across thousands of independent partner studios", F["classpass_credits"],
             "Credit-based flexibility — customers buy a pool of credits and choose how to allocate them across different experiences.", ["Convenience"], None),

        like(P["classpass"], "feature", "Remaining credits can motivate additional credit purchases", NF["classpass_remaining"],
             "Unused credits can encourage additional purchases — e.g. 1 credit remaining → purchase 5 more to access a 6-credit class.", ["Loss Aversion"],
             "The underlying concept is sunk-cost / waste-aversion — the closest existing category (Loss Aversion) is used rather than adding a new one."),

        like(P["oura"], "membership_type", "Subscription", None,
             "Hardware + recurring subscription — after buying the ring, consumers may feel they need to maintain the subscription long enough to justify the initial investment.",
             ["Loss Aversion", "Switching Costs / Lock-in"],
             "The initial hardware investment can make discontinuing the subscription feel like wasting part of the original purchase (sunk-cost / post-purchase rationalisation)."),
        like(P["oura"], "feature", "Requires an upfront hardware purchase (the ring) plus an ongoing software/insights subscription", F["oura_hardware"],
             "Hardware + recurring subscription — after buying the ring, consumers may feel they need to maintain the subscription long enough to justify the initial investment.",
             ["Loss Aversion", "Switching Costs / Lock-in"], None),

        like(P["vivagym"], "membership_type", "Subscription", None,
             "Upfront membership fee / commitment — after paying to become a member, consumers may feel they need to attend enough to get their money's worth.",
             ["Loss Aversion"],
             "Underlying concept is sunk-cost + commitment/consistency. Attached to VivaGym's actual membership_type ('Subscription') rather than the generic 'Paid' mentioned in the brief, since that's the real value on this record."),
    ]


def main():
    update_programmes()
    new_feature_ids = create_features()
    existing_feature_ids = find_existing_feature_ids()
    rows = build_likes(new_feature_ids, existing_feature_ids)
    r = requests.post(rest("likes"), headers={**HEADERS, "Prefer": "return=representation"}, json=rows)
    if r.status_code in (200, 201):
        print(f"OK  inserted {len(r.json())} likes")
    else:
        print(f"FAILED inserting likes: {r.status_code} {r.text}")


if __name__ == "__main__":
    main()
