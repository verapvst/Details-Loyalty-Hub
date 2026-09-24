# Loyalty taxonomy v3 (September 2026)

Criterion: when the database holds about 190 to 200 programmes, every variable must let us find meaningful patterns across industries, membership models, launch years and mechanism combinations.

* **Mechanism**: what the programme structurally does to create value or change behaviour.
* **Benefit**: what the customer receives (free nights, upgrades, lounges). Not coded as a mechanism.
* **Feeling / outcome**: exclusivity, belonging, recognition, "money can't buy". Never coded.

## The 11 mechanisms

| # | Mechanism | Dimension | Definition | Code when | Do not code when |
|---|---|---|---|---|---|
| 1 | Spend-based earning | Earning | Members earn a return (points, miles or cash) in proportion to spend | Return per euro spent, including cashback | Reward is per visit or action (use 2) |
| 2 | Behaviour-based rewards | Earning | Rewards for a behaviour that is neither spend nor acquisition | Visits, stays, rounds, workouts, challenges, reviews, app use trigger a reward | Nights or rounds only count toward a tier (use 7); referrals (use 10) |
| 3 | Member pricing | Value delivered | Lower prices, member rates or vouchers only for members | Price reduced at the moment of purchase | Discount only exists as a tier benefit (use 7) |
| 4 | Included member benefits | Value delivered | Value that comes with membership itself, used or not | Credits, free items or services included in membership | Anything that must be earned |
| 5 | Privileged access | Value delivered | Members get products, spaces, booking or inventory first or exclusively | Non-members get it later or never | Access only from a status tier (use 7); events (use 6) |
| 6 | Member experiences & events | Value delivered | Programme runs or unlocks members-only experiences or events | A specific event or experience is restricted to members (benefit or redemption) | Ongoing access to a space (use 5); feelings |
| 7 | Earned status | Progression | Tiers reached through qualifying activity over a period | Tiers are won through spend, nights, points, transactions | Tiers are bought (paid plans) |
| 8 | Ecosystem cross-use | Reach | Earn, redeem or use benefits across the group's own brands or assets | Own brands, assets or verticals | Third parties (use 9) |
| 9 | External partner network | Reach | Earn or redeem with third parties | Third-party companies | The group's own brands (use 8) |
| 10 | Referral | Acquisition | Reward for bringing new customers or members | Reward triggered by a new customer joining | Social sharing with no acquisition condition |
| 11 | Community | Belonging | Programme provides structures for members to connect with each other | Clubs, chapters, groups, member forums, member-to-member app features, group activities | A one-off event with no member interaction (use 6); marketing language about "community" |

Code only what the programme's official page documents.

## Old (18) to new (11) mapping applied on 2026-09-24

| Old | New |
|---|---|
| Points, Cashback | Spend-based earning |
| Gamification | Behaviour-based rewards |
| Discounts & Vouchers | Member pricing |
| Complimentary Benefits & Credits | Included member benefits |
| Exclusivity, Early Access | Privileged access |
| Priority Access | Earned status when the programme has earned status; otherwise Privileged access |
| Experiences | Member experiences & events |
| Community | Community |
| Status Recognition, Upgrades | Earned status |
| (derived) 2 or more tiers with a real qualification unit (not Automatic / Other) | Earned status |
| Cross-brand / Ecosystem Access | Ecosystem cross-use |
| Partner Network | External partner network |
| Referral | Referral |
| Personalisation, Transferability / Gifting, Other | Removed |

## Industry changes applied on 2026-09-24

| Old | New |
|---|---|
| Banking & Financial Services (incl. Credit Cards) | Banking & Financial Services |
| Airlines & Travel | Travel & Mobility |
| Entertainment & Media | Leisure & Entertainment |
| Restaurants & F&B | Food & Beverage |

Moves: Annual Passholder, Epic Pass, Ikon Pass (Hotels to Leisure & Entertainment); GrabRewards (F&B to Travel & Mobility); The club (Coca-Cola), TastyRewards, Fun Club, app Alimenta Sorrisos, Monster Energy (F&B to Retail, consumer brands); Amazon Prime (Entertainment to Retail); VodaBucks (Entertainment to Banking & Financial Services).

## Known limits after the mechanical recode

* Behaviour-based rewards only contains former Gamification; visit and activity rewards still need checking programme by programme.
* External partner network may still include some own-brand partners.
* Referral and Community were never checked systematically; both need a page-by-page check.
* B2B programmes (Member Hotel, CopaCoins) stay in the table but should be excluded from consumer comparisons.
