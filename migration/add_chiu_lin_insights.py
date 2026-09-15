#!/usr/bin/env python3
"""One-time script: adds Chiu & Lin (2026) as a Source and extracts 5 deliberately
differently-structured Insights from it, as the first test case for the restructured
Data & Insights section. Read directly from the team's own PDF copy — no invented
statistics or conclusions; every number below is quoted from the article.

Usage: python3 add_chiu_lin_insights.py
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
CREATED_BY = "Vera"

SOURCE = {
    "citation_tag": "Chiu & Lin (2026)",
    "full_citation": (
        "Chiu, M.-L., & Lin, C.-N. (2026). Aligning tourists\u2019 needs with loyalty "
        "programs: A framework for enhancing brand loyalty. [Academic Article]."
    ),
    "link_or_path": (
        "https://novasbe365.sharepoint.com/:b:/r/sites/DETAILS-WorkProject/"
        "Documentos%20Partilhados/General/02_RESEARCH/Loyalty/Aligning%20tourists"
        "%E2%80%99%20needs%20with%20loyalty%20programs.pdf"
        "?d=we312d4646d9f4a9583afe3a9f98c56dd&csf=1&web=1&e=RzG7CS"
    ),
}

INSIGHTS = [
    {
        "insight_type": "Key Finding",
        "insight_text": (
            "Perceived enjoyment is the strongest driver of loyalty-program engagement "
            "among the five antecedents tested (\u03b2 = 0.31, p < 0.01), ahead of "
            "relational value (\u03b2 = 0.24), reward systems (\u03b2 = 0.16), social "
            "media effect (\u03b2 = 0.10) and altruism (\u03b2 = 0.08)."
        ),
        "supporting_detail": (
            "Based on PLS-SEM path analysis of 571 valid tourism/hospitality survey "
            "responses (Chiu & Lin, 2026, Fig. 2)."
        ),
    },
    {
        "insight_type": "Statistic",
        "insight_text": (
            "The five loyalty-program antecedents jointly explain 62% of the variance "
            "in loyalty-program engagement (R\u00b2 = 0.62), which in turn explains 52% "
            "of the variance in brand loyalty (R\u00b2 = 0.52)."
        ),
        "supporting_detail": (
            "Sample: 571 valid responses (583 collected), gathered via online survey "
            "across Facebook, Mobile01 and Dcard."
        ),
    },
    {
        "insight_type": "Relationship",
        "insight_text": (
            "Product involvement negatively moderates the loyalty-program \u2192 "
            "brand-loyalty relationship (\u03b2 = -0.20, p < 0.01) \u2014 the more "
            "personally important the product/experience is to the consumer, the "
            "weaker the loyalty program\u2019s effect on their brand loyalty."
        ),
        "supporting_detail": (
            "Counter to the common assumption that involvement always strengthens "
            "loyalty-program effectiveness. The authors argue highly-involved "
            "travellers already derive intrinsic satisfaction from the travel "
            "experience itself, making programme-based extrinsic incentives "
            "comparatively peripheral to their brand loyalty formation."
        ),
    },
    {
        "insight_type": "Framework",
        "insight_text": (
            "Loyalty-program design is framed around two benefit types \u2014 "
            "Effectiveness benefits (intrinsic: altruism, perceived enjoyment) and "
            "Efficiency benefits (extrinsic: reward systems, relational value) \u2014 "
            "plus a social media effect, all feeding into the loyalty program, which "
            "then drives brand loyalty (moderated by product involvement; controlled "
            "for gender/age)."
        ),
        "supporting_detail": (
            "Grounded in Self-Determination Theory: effectiveness benefits address "
            "intrinsic motivational needs, efficiency benefits address extrinsic ones "
            "(Chiu & Lin, 2026, Fig. 1, Research model)."
        ),
    },
    {
        "insight_type": "Strategic Implication",
        "insight_text": (
            "Loyalty programmes designed as vehicles for experiential/emotional value "
            "\u2014 not just transactional incentive systems \u2014 are better "
            "positioned to build durable brand commitment, especially in tourism, "
            "where consumption is inherently experiential and identity-expressive."
        ),
        "supporting_detail": (
            "For highly-involved travellers in particular, design should emphasise "
            "personalisation, destination-authenticity and experiential elements over "
            "pure discounts/points, since extrinsic incentives lose relative "
            "motivational power as involvement rises."
        ),
    },
]


def rest(table):
    return f"{SUPABASE_URL}/rest/v1/{table}"


def main():
    src_resp = requests.post(rest("sources"), headers=HEADERS, json={**SOURCE, "created_by": CREATED_BY})
    src_resp.raise_for_status()
    source_id = src_resp.json()[0]["id"]
    print(f"OK  source created: {source_id}")

    rows = [{**insight, "source_id": source_id, "created_by": CREATED_BY} for insight in INSIGHTS]
    resp = requests.post(rest("figures"), headers=HEADERS, json=rows)
    if resp.status_code in (200, 201):
        print(f"OK  inserted {len(resp.json())} insights")
    else:
        print(f"FAILED inserting insights: {resp.status_code} {resp.text}")


if __name__ == "__main__":
    main()
