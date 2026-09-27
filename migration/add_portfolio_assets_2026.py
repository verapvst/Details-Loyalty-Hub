#!/usr/bin/env python3
"""One-time seed: Details' own physical asset portfolio (2026-09-27), for the new
Map section — NOT the loyalty-programme database (`programmes`); this is a
separate table, `portfolio_assets`.

Source of truth: details.net/pt/portefolio/ (rendered with a headless browser,
since the page is partly JS-loaded — a plain fetch misses several assets). Every
website_url below is the asset's own official site, taken directly from that
page's embedded `data-xpro-element-link` attributes, not guessed. Two items from
an earlier, less reliable pass ("La Quinta", "Meia Praia", "Baía") were dropped —
they don't appear anywhere in the live page and couldn't be independently
confirmed, so they're left out rather than invented.

Coordinates are from OpenStreetMap Nominatim (free, no API key), cross-checked
against the asset's own published address where Nominatim's name search alone
didn't resolve it. coordinate_confidence is honest about precision:
  - 'exact'       matched the specific venue/address
  - 'street'      matched the street, not the exact building
  - 'approximate' town/village centroid only — flagged, not guessed at
                  building level (Vale d'Oliveiras, Aqua Pedra dos Bicos,
                  Velamar, Topázio Vibe Hotel, Buzios Beach Club)

Palmares is modelled as ONE row with categories=['Resort','Golf'] (it's both a
hotel/resort AND a 27-hole golf course) rather than duplicated — see the map's
own handling of multi-category assets in assets/map.js.

Usage: python3 add_portfolio_assets_2026.py [--dry-run]
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

ASSETS = [
    dict(asset_name="Palmares", categories=["Resort", "Golf"], location="Lagos, Algarve",
         latitude=37.12662, longitude=-8.63915, coordinate_confidence="exact",
         website_url="https://www.palmaresliving.com/",
         notes="Beach House Hotel, Signature Apartments and a 27-hole Robert Trent Jones Jr. golf course; JW Marriott's first Portuguese property is under development on-site."),
    dict(asset_name="Hilton Vilamoura As Cascatas Golf Resort & Spa", categories=["Hotel"], location="Vilamoura, Algarve",
         latitude=37.09360, longitude=-8.11052, coordinate_confidence="exact",
         website_url="https://www.hilton.com/pt/hotels/faohihi-hilton-vilamoura-as-cascatas-golf-resort-and-spa/"),
    dict(asset_name="Hyatt Vilamoura", categories=["Hotel"], location="Vilamoura, Algarve",
         latitude=37.07472, longitude=-8.11416, coordinate_confidence="exact",
         website_url="https://www.hyatt.com/hyatt-regency/en-US/"),
    dict(asset_name="Vilamoura Garden Hotel", categories=["Hotel"], location="Vilamoura, Algarve",
         latitude=37.09176, longitude=-8.11324, coordinate_confidence="exact",
         website_url="https://www.vilamouragardenhotel.com/"),
    dict(asset_name="Topázio Vibe Hotel", categories=["Hotel"], location="Vilamoura, Algarve",
         latitude=37.0759505, longitude=-8.1165401, coordinate_confidence="approximate",
         website_url="https://topaziovibehotel.com/"),
    dict(asset_name="Vale da Lapa Resort", categories=["Resort"], location="Carvoeiro, Algarve",
         latitude=37.10228, longitude=-8.48937, coordinate_confidence="exact",
         website_url="https://www.valedalapa.com/"),
    dict(asset_name="Vale d'Oliveiras Quinta Resort & Spa", categories=["Resort"], location="Carvoeiro / Ferragudo, Algarve",
         latitude=37.0970567, longitude=-8.4711093, coordinate_confidence="approximate",
         website_url="https://valeoliveirasresort.com/"),
    dict(asset_name="Vale d'El-Rei Hotel & Villas", categories=["Resort"], location="Lagoa / Carvoeiro, Algarve",
         latitude=37.1046163, longitude=-8.4266853, coordinate_confidence="street",
         website_url="https://valedelrei.com/"),
    dict(asset_name="Aqua Pedra dos Bicos Hotel", categories=["Hotel"], location="Carvoeiro, Algarve",
         latitude=37.0970567, longitude=-8.4711093, coordinate_confidence="approximate",
         website_url="https://www.aquapedradosbicoshotel.com/"),
    dict(asset_name="Velamar Boutique Hotel", categories=["Hotel"], location="Olhos d'Água, Albufeira, Algarve",
         latitude=37.0920248, longitude=-8.1912286, coordinate_confidence="approximate",
         website_url="https://velamarboutiquehotel.com/"),
    dict(asset_name="Dom Pedro Madeira", categories=["Hotel"], location="Funchal, Madeira",
         latitude=32.64936, longitude=-16.92408, coordinate_confidence="exact",
         website_url="https://madeira.dompedro.com/"),
    dict(asset_name="Dom Pedro Portobelo", categories=["Apartments / Residential", "Hotel"], location="Vilamoura, Algarve",
         latitude=37.07488, longitude=-8.11668, coordinate_confidence="exact",
         website_url="https://portobelo.dompedro.com/"),
    dict(asset_name="Dom Pedro Garajau", categories=["Hotel"], location="Garajau, Madeira",
         latitude=32.64314, longitude=-16.85181, coordinate_confidence="exact",
         website_url="https://garajau.dompedro.com/"),
    dict(asset_name="Dom Pedro Lagos", categories=["Hotel"], location="Lagos, Algarve",
         latitude=37.11334, longitude=-8.65976, coordinate_confidence="exact",
         website_url="https://lagos.dompedro.com/"),
    dict(asset_name="Dom Pedro Residences Vilamoura", categories=["Apartments / Residential"], location="Vilamoura, Algarve",
         latitude=37.07213, longitude=-8.11217, coordinate_confidence="exact",
         website_url="https://residences.dompedro.com/"),
    dict(asset_name="The Pearl Troia", categories=["Hotel"], location="Tróia, Grândola",
         latitude=38.49031, longitude=-8.90067, coordinate_confidence="exact",
         website_url="https://thepearltroia.com/"),
    dict(asset_name="The Anchor Troia", categories=["Hotel"], location="Tróia, Grândola",
         latitude=38.49101, longitude=-8.90439, coordinate_confidence="exact",
         website_url="https://theanchortroia.com/"),
    dict(asset_name="Els Club Vilamoura", categories=["Golf"], location="Vilamoura, Algarve",
         latitude=37.0925607, longitude=-8.1274949, coordinate_confidence="street",
         website_url="https://www.elsclubvilamoura.com/"),
    dict(asset_name="Laguna Golf Course", categories=["Golf"], location="Vilamoura, Algarve",
         latitude=37.09309, longitude=-8.13157, coordinate_confidence="exact",
         website_url="https://www.vilamouragolf.com/en/golf-courses/laguna/"),
    dict(asset_name="Millennium Golf Course", categories=["Golf"], location="Vilamoura, Algarve",
         latitude=37.09836, longitude=-8.13216, coordinate_confidence="exact",
         website_url="https://www.vilamouragolf.com/en/golf-courses/millennium/"),
    dict(asset_name="Old Course Vilamoura", categories=["Golf"], location="Vilamoura, Algarve",
         latitude=37.09951, longitude=-8.11603, coordinate_confidence="exact",
         website_url="https://www.oldcoursevilamoura.com/"),
    dict(asset_name="Pinhal Golf Course", categories=["Golf"], location="Vilamoura, Algarve",
         latitude=37.07864, longitude=-8.10519, coordinate_confidence="exact",
         website_url="https://www.vilamouragolf.com/en/golf-courses/pinhal/"),
    dict(asset_name="San Lorenzo Golf Club", categories=["Golf"], location="Almancil (Quinta do Lago), Algarve",
         latitude=37.0311804, longitude=-8.0189817, coordinate_confidence="exact",
         website_url="https://www.golfsanlorenzo.pt/"),
    dict(asset_name="Troia Golf", categories=["Golf"], location="Tróia, Grândola",
         latitude=38.47934, longitude=-8.89350, coordinate_confidence="exact",
         website_url="https://www.troiaresort.pt/troia-golf/"),
    dict(asset_name="PGA Aroeira No.1", categories=["Golf"], location="Charneca da Caparica, Almada",
         latitude=38.57027, longitude=-9.18611, coordinate_confidence="exact",
         website_url="https://pgaaroeira.com/pt-pt/pga-aroeira-no-1/"),
    dict(asset_name="PGA Aroeira No.2", categories=["Golf"], location="Charneca da Caparica, Almada",
         latitude=38.57435, longitude=-9.17198, coordinate_confidence="exact",
         website_url="https://pgaaroeira.com/pt-pt/pga-aroeira-no-2/"),
    dict(asset_name="Monte Rei Golf & Country Club", categories=["Golf"], location="Vila Nova de Cacela, Algarve",
         latitude=37.21307, longitude=-7.55032, coordinate_confidence="exact",
         website_url="https://www.monte-rei.com/",
         notes="Confirmed on the live details.net portfolio page and in trade press (Golfmanager, Sept 2026) as newly under Details management."),
    dict(asset_name="Vale Pisao", categories=["Golf", "Resort"], location="Água Longa, Santo Tirso (Porto area)",
         latitude=41.26972, longitude=-8.50041, coordinate_confidence="exact",
         website_url="https://valepisao.com/",
         notes="Outside the Algarve cluster — a nature resort with residences and a golf course near Porto, confirming the portfolio isn't exclusively Algarve."),
    dict(asset_name="Vilamoura Equestrian Centre", categories=["Sports & Leisure"], location="Quarteira, Vilamoura, Algarve",
         latitude=37.1085004, longitude=-8.1392659, coordinate_confidence="street",
         website_url="https://www.vilamouraworld.com/destination/equestrian-centre/"),
    dict(asset_name="Brown's Sports Resort", categories=["Sports & Leisure"], location="Vilamoura, Algarve",
         latitude=37.10607, longitude=-8.11501, coordinate_confidence="exact",
         website_url="https://www.brownssportsresort.com/"),
    dict(asset_name="My.Al Mar", categories=["Food & Beverage"], location="Vilamoura, Algarve",
         latitude=37.09360, longitude=-8.11052, coordinate_confidence="exact",
         website_url="https://www.hilton.com/en/hotels/faohihi-hilton-vilamoura-as-cascatas-golf-resort-and-spa/dining/my.al.mar---tapas-by-the-sea/",
         notes="Tapas by the Sea, inside Hilton Vilamoura As Cascatas."),
    dict(asset_name="Buzios Beach Club", categories=["Food & Beverage"], location="Vilamoura Marina, Algarve",
         latitude=37.07854, longitude=-8.11462, coordinate_confidence="approximate",
         website_url="https://www.dompedro.com/pt/restaurantes/buzios-beach-club/"),
]


def run(dry_run=False):
    ok, failed = 0, []
    for a in ASSETS:
        payload = {**a, "source_url": "https://details.net/pt/portefolio/"}
        if dry_run:
            print(f"--dry-run: would insert {a['asset_name']!r} ({', '.join(a['categories'])}) @ {a['latitude']},{a['longitude']} [{a['coordinate_confidence']}]")
            ok += 1
            continue
        resp = requests.post(f"{SUPABASE_URL}/rest/v1/portfolio_assets", headers=HEADERS, json=payload)
        if resp.status_code not in (200, 201):
            print(f"FAILED {a['asset_name']!r}: {resp.status_code} {resp.text[:150]}")
            failed.append(a["asset_name"])
        else:
            ok += 1
            print(f"OK  {a['asset_name']!r}")
    print(f"\n{'Would insert' if dry_run else 'Inserted'} {ok}/{len(ASSETS)} asset(s).")
    if failed:
        print("Failed:", failed)


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
