# ruff: noqa: E501
"""Committed source and dataset specifications (v1).

Generated from the P3 seed, SCOPE, fixture metadata and gridflow schedules.
No runtime file reads. Long literals preserve canonical dataset identifiers.
"""

FORMAT_VERSION = 1
SOURCES = [
    {
        "key": "elexon",
        "name": "Elexon BMRS",
        "domain": "Electricity",
        "host": "data.elexon.co.uk/bmrs/api/v1",
        "blurb": "GB balancing mechanism reporting: settlement prices, generation, demand and the "
        "balancing actions behind them.",
        "layer": "silver",
        "families": [
            {
                "slug": "generation-by-fuel-type-half-hourly",
                "label": "Generation by fuel type, half-hourly",
                "kind": "series",
                "page": "pinned",
                "route": "/datasets/generation-mix",
                "notes": [],
                "datasets": [
                    {
                        "id": "fuelhh",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_fuelhh",
                        "latest_relation": "silver_elexon_fuelhh_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_mw",
                                "unit": "MW",
                                "label": "half-hourly generation outturn by fuel type; "
                                "interconnector (INT*) codes are signed, "
                                "positive = import to GB",
                            }
                        ],
                        "dims": [{"column": "fuel_type", "role": "series", "cardinality": 21}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "local hole: 2026-09-06 holds 40 rows (2 periods), "
                            "2026-09-07..09 hold none, 2026-09-16 is partial (780 of "
                            "960)",
                            "21 fuel codes: INTELE has 9 rows only (legacy code), "
                            "INTVKL and INTGRNL join part-way through the history",
                            "negative values are normal for INT* codes and PS (vault). "
                            "Never abs() or zero-fill them",
                            "27 short days / 33 missing periods are vendor gaps (vault)",
                            "0 duplicate keys and 1 vintage per key (measured)",
                            "Already a pinned bespoke screen (Generation mix, P0-1). "
                            "Power stack: gridflow_models RULINGS #542 used the "
                            "FUELHH-vs-INDO demand identity. expected_rows = 9 days x "
                            "960 and includes margin days.",
                            "A covered day contains at least one row; coverage does "
                            "not guarantee a complete day.",
                        ],
                    }
                ],
            },
            {
                "slug": "system-prices-and-net-imbalance-volume",
                "label": "System prices and net imbalance volume",
                "kind": "series",
                "page": "pinned",
                "route": "/datasets/system-prices",
                "notes": [],
                "datasets": [
                    {
                        "id": "system_prices",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_system_prices",
                        "latest_relation": "silver_elexon_system_prices_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "system_sell_price",
                                "unit": "GBP/MWh",
                                "label": "system sell price",
                            },
                            {
                                "column": "system_buy_price",
                                "unit": "GBP/MWh",
                                "label": "system buy price",
                            },
                            {
                                "column": "net_imbalance_volume",
                                "unit": "MWh",
                                "label": "net imbalance volume",
                            },
                        ],
                        "dims": [
                            {"column": "price_derivation_code", "role": "filter", "cardinality": 3}
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "base relation is APPEND_ONLY: 96,313 rows vs 88,456 in "
                            "_latest. About 7,100 keys carry more than one vintage "
                            "(14,192 rows: N 7,193, P 6,999), from about 2026-09-10",
                            "run_type is 100% null: this endpoint does not expose the "
                            "settlement run (schema docstring)",
                            "in _latest, 2026-09-16 and 09-17 hold 39 of 48 periods, "
                            "09-18..20 are missing and 09-21 holds 20",
                            "price_derivation_code: N 45,492, P 42,954, K 10 in "
                            "_latest. The schema documents N (normal) and P "
                            "(provisional). K is undocumented",
                            "Read _latest: it is gridflow's own serving surface "
                            "(client.py:53) and what gold reads. Already a pinned "
                            "bespoke screen (P0-1). The vault says 'transformer keeps "
                            "the highest-rank run only'. That is superseded: the "
                            "dataset is APPEND_ONLY and the _latest view selects on "
                            "available_at then run_type. DATE_PATH fetch: 10 "
                            "settlement dates x 48, plus P/N re-vintages in base.",
                        ],
                    }
                ],
            },
            {
                "slug": "generation-by-fuel-type-instantaneous",
                "label": "Generation by fuel type, instantaneous",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/generation-by-fuel-type-instantaneous",
                "notes": [],
                "datasets": [
                    {
                        "id": "fuelinst",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_fuelinst",
                        "latest_relation": "silver_elexon_fuelinst_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "5min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_mw",
                                "unit": "MW",
                                "label": "instantaneous (5-minute) generation by fuel type",
                            }
                        ],
                        "dims": [{"column": "fuel_type", "role": "series", "cardinality": 20}],
                        "default_filter": None,
                        "dedup": {"keys": ["timestamp_utc", "fuel_type"], "order_by": []},
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "80 duplicate (timestamp_utc, fuel_type) rows (28,900 rows "
                            "vs 28,820 keys): the day-boundary instant appears in two "
                            "capture files. Dedupe on read",
                            "no settlement coordinates (by design, fuelinst.py:24)",
                            "288 instants/day x 20 fuels = 5,760/day. Medium "
                            "relevance: the same fuels as fuelhh at finer grain.",
                        ],
                    }
                ],
            },
            {
                "slug": "actual-generation-by-production-type",
                "label": "Actual generation by production type",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/actual-generation-by-production-type",
                "notes": [],
                "datasets": [
                    {
                        "id": "agpt",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_agpt",
                        "latest_relation": "silver_elexon_agpt_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_mw",
                                "unit": "MW",
                                "label": "actual aggregated generation per production type (B1620)",
                            }
                        ],
                        "dims": [
                            {"column": "psr_type", "role": "series", "cardinality": 11},
                            {"column": "business_type", "role": "filter", "cardinality": 3},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "psr_type holds human-readable labels ('Fossil Gas', 'Wind "
                            "Offshore'), not ENTSO-E B-codes (vault)",
                            "document_revision can re-issue a key. Locally 1 vintage per key",
                            "silver files are bucketed by publish day, not settlement "
                            "day (vault agws.md, same shape)",
                            "The ENTSO-E B1620 view of GB generation as published through Elexon.",
                        ],
                    },
                    {
                        "id": "agws",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_agws",
                        "latest_relation": "silver_elexon_agws_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_mw",
                                "unit": "MW",
                                "label": "actual or estimated wind and solar generation (B1630)",
                            }
                        ],
                        "dims": [
                            {"column": "psr_type", "role": "series", "cardinality": 3},
                            {"column": "business_type", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Solar is present and material (about 12.7 GW midday peak, "
                            "vault). Whether it is BM-only or national scope is "
                            "unconfirmed (vault TODO)",
                            "silver files are bucketed by publish day, not settlement day (vault)",
                        ],
                    },
                ],
            },
            {
                "slug": "market-index-price",
                "label": "Market index price",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/market-index-price",
                "notes": [],
                "datasets": [
                    {
                        "id": "mid",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_mid",
                        "latest_relation": "silver_elexon_mid_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "market_index_price",
                                "unit": "GBP/MWh",
                                "label": "market index price per data provider",
                            },
                            {
                                "column": "market_index_volume",
                                "unit": "MWh",
                                "label": "market index volume per data provider",
                            },
                        ],
                        "dims": [
                            {"column": "data_provider_id", "role": "series", "cardinality": 2}
                        ],
                        "default_filter": {"column": "data_provider_id", "equals": "APXMIDP"},
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "N2EXMIDP is almost always empty: 87,351 of 87,547 rows "
                            "have price 0 and volume 0, and 1,728 of 1,731 since "
                            "2026-08-01 have zero volume. Treat N2EX zeros as 'no "
                            "index', not a GBP 0 price",
                            "0 duplicate keys on (settlement_date, settlement_period, "
                            "data_provider_id) after the 2026-09-07 rebuild",
                            "15 APXMIDP periods over 11 days are vendor gaps (vault)",
                            "vintage_policy: 171,965 rows elexon-mid/vp-2026-09b, "
                            "3,458 rows ingest-clock (an ADR-031 availability stamp, "
                            "not a vendor time)",
                            "P4-0 pilot. The RUNBOOK section 6 example card is wrong "
                            "for this dataset: silver has no `price` column and its "
                            "`data_provider` is the constant 'elexon'. The real "
                            "columns are market_index_price, market_index_volume and "
                            "data_provider_id (APXMIDP, N2EXMIDP). Vault "
                            "disagreements: (a) its providers are 'APXMIDP, "
                            "NORDPOOLMIDP', but the data holds N2EXMIDP; (b) it says "
                            "'silver dedup does not include data_provider_id', but the "
                            "code has it as an optional key (mid.py:46) and duplicates "
                            "measure 0; (c) it says 'not rebuilt yet' and 'rebuilt "
                            "2026-09-07' in different sections, and the measured state "
                            "matches the rebuild. Feeds "
                            "gold_gb_day_ahead_benchmark.",
                        ],
                    }
                ],
            },
            {
                "slug": "market-depth",
                "label": "Market depth",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/market-depth",
                "notes": [],
                "datasets": [
                    {
                        "id": "market_depth",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_market_depth",
                        "latest_relation": "silver_elexon_market_depth_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "indicated_imbalance_mwh",
                                "unit": "MWh",
                                "label": "indicated imbalance",
                            },
                            {"column": "offer_volume_mwh", "unit": "MWh", "label": "offer volume"},
                            {"column": "bid_volume_mwh", "unit": "MWh", "label": "bid volume"},
                            {
                                "column": "total_accepted_offer_volume_mwh",
                                "unit": "MWh",
                                "label": "total accepted offer volume",
                            },
                            {
                                "column": "total_accepted_bid_volume_mwh",
                                "unit": "MWh",
                                "label": "total accepted bid volume",
                            },
                            {
                                "column": "priced_accepted_offers_volume_mwh",
                                "unit": "MWh",
                                "label": "priced accepted offer volume",
                            },
                            {
                                "column": "priced_accepted_bids_volume_mwh",
                                "unit": "MWh",
                                "label": "priced accepted bid volume",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "non-contiguous local days: 1-5 Aug, then 1, 17 and 21 Sep only",
                            "nulls: offer/bid volume 13.3%, accepted and priced "
                            "volumes 15.9%. All of them fall on the Sep days "
                            "(2026-09-01: 27 of 48 offer and 23 of 48 accepted "
                            "non-null; 09-21: 24 and 21). Cause unknown; probably "
                            "captured before the settlement run completed",
                            "aggregates BOALF/DISBSAD/IMBALNGC; don't double-count in "
                            "joins (vault)",
                            "DATE_PATH: 10 settlement dates x 48. Recent days may land "
                            "with null accepted volumes. Whether a re-fetch fills them "
                            "is unknown; re-running the same command a few days later "
                            "would settle it.",
                        ],
                    }
                ],
            },
            {
                "slug": "system-frequency",
                "label": "System frequency",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/system-frequency",
                "notes": [],
                "datasets": [
                    {
                        "id": "freq",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_freq",
                        "latest_relation": "silver_elexon_freq_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "15s", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {"column": "frequency_hz", "unit": "Hz", "label": "system frequency"}
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "4 duplicate instants (28,805 rows vs 28,801 keys), at "
                            "capture boundaries",
                            "measured spacing is 15 s (5,760 instants per day). The "
                            "vault says '~2-second sampling, exposed as 1-minute "
                            "aggregates', which disagrees",
                            "The endpoint uses measurementDateTimeFrom/To (V2-FIX-01). "
                            "The local sample was captured after that fix, so it is "
                            "correctly windowed.",
                            "Suggested view: downsample server-side (e.g. per-minute "
                            "min/mean/max) for windows over 1 day",
                        ],
                    }
                ],
            },
            {
                "slug": "demand-outturn",
                "label": "Demand outturn",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/demand-outturn",
                "notes": [],
                "datasets": [
                    {
                        "id": "indo",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_indo",
                        "latest_relation": "silver_elexon_indo_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "initial_demand_outturn_mw",
                                "unit": "MW",
                                "label": "initial national demand outturn",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "first-publish outturn, revised later (vault)",
                            "INDO runs about 2,375 MW BELOW ITSDO (vault, 24 Jul "
                            "2026); the gap is not embedded-generation driven",
                            "0 duplicate keys; 1 vintage per key",
                            "Wave 1 (demand outturn, deep history). NDF pairs with "
                            "INDO, not ITSDO (vault ndf.md).",
                        ],
                    },
                    {
                        "id": "itsdo",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_itsdo",
                        "latest_relation": "silver_elexon_itsdo_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "initial_transmission_system_demand_outturn_mw",
                                "unit": "MW",
                                "label": "initial transmission system demand outturn",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "ITSDO runs above INDO by about 2,375 MW (vault)",
                            "0 duplicate keys",
                            "Oddity: GridflowClient maps its `weather` serving alias "
                            "to silver_elexon_itsdo (client.py:56). The Explorer must "
                            "not treat itsdo as weather.",
                        ],
                    },
                    {
                        "id": "indod",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_indod",
                        "latest_relation": "silver_elexon_indod_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "1d",
                            "settlement_cols": ["settlement_date"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "settlement_date"},
                        "values": [
                            {
                                "column": "initial_demand_outturn_mw",
                                "unit": None,
                                "label": "initial national demand outturn, daily total",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "unit unsettled: the column is named _mw, but values run "
                            "455,172-578,626. That matches a daily energy total in MWh "
                            "(about 24 x mean INDO), not a MW level. The vendor INDOD "
                            "spec would settle it",
                            "timestamp_utc is the London-midnight SP1 start "
                            "(2026-08-01 00:00+01). The schema docstring says "
                            "'midnight UTC', which disagrees; the transformer comment "
                            "(indod.py:80) matches the data",
                            "Do not label the axis MW until the unit is settled.",
                            "Unit unconfirmed for initial_demand_outturn_mw; research "
                            "did not establish a reliable unit.",
                        ],
                    },
                    {
                        "id": "atl",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_atl",
                        "latest_relation": "silver_elexon_atl_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "total_load_mw",
                                "unit": "MW",
                                "label": "actual total load per bidding zone (B0610)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "thin: 26-33 of 48 periods per day (142 of about 240 "
                            "expected over 5 days), with gaps scattered through each "
                            "day. Cause unknown; comparing the ATL bronze publishTime "
                            "against the fetch windows would settle it",
                            "the schema declares business_type, but silver doesn't carry it",
                            "expected_rows assumes the same ~56% period coverage recurs.",
                        ],
                    },
                ],
            },
            {
                "slug": "demand-forecasts",
                "label": "Demand forecasts",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/demand-forecasts",
                "notes": [],
                "datasets": [
                    {
                        "id": "ndf",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_ndf",
                        "latest_relation": "silver_elexon_ndf_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "national_demand_mw",
                                "unit": "MW",
                                "label": "national demand forecast, day-ahead (pairs with INDO)",
                            }
                        ],
                        "dims": [{"column": "forecast_type", "role": "filter", "cardinality": 1}],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "settlement_period"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "every vintage is kept (published_at is in the key): "
                            "14,080 rows / 295 keys, up to 82 vintages per key. "
                            "Deduped to latest per key: 336 rows per 7 days",
                            "no _latest view exists, so P3 must dedupe per key on "
                            "max(published_at)",
                            "the schema declares transmission_demand_mw, but it is "
                            "absent from silver (the vault says it was always null)",
                            "timestamp_utc is the delivery period, which runs ahead of "
                            "publication. Never anchor on max(timestamp_utc). "
                            "expected_rows is base rows (9 publish days x about "
                            "2,816).",
                            "Suggested view: latest vintage per (settlement_date, "
                            "settlement_period): max(published_at)",
                        ],
                    },
                    {
                        "id": "tsdf",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_tsdf",
                        "latest_relation": "silver_elexon_tsdf_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "forecast_demand_mw",
                                "unit": "MW",
                                "label": "transmission system demand forecast per "
                                "boundary (N = national)",
                            }
                        ],
                        "dims": [{"column": "boundary", "role": "filter", "cardinality": 18}],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "settlement_period", "boundary"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "vintage inversion: the API returns newest-first, and "
                            "unique(keep='last') keeps the EARLIEST publish of each "
                            "capture day. Bronze check on 2026-08-03: 1,854 of 1,854 "
                            "keys kept the minimum publishTime (47 publications in the "
                            "file)",
                            "the base holds 1-3 vintages per key (9,270 rows / 5,310 "
                            "keys), one per capture day, each that day's first issue. "
                            "Deduped to latest per key: 6,048 rows per 7 days (18 "
                            "boundaries x 48 x 7)",
                            "the vault says 'silver does NOT retain forecast vintages' "
                            "(published_at not in the key). That is true within a "
                            "capture day, false across days",
                            "The page must say which vintage it shows. The latest "
                            "forecast is NOT what silver holds. Gridflow backlog: sort "
                            "by published_at before keep='last', or add published_at "
                            "to the key.",
                            "Suggested view: boundary = 'N'; per (settlement_date, "
                            "settlement_period, boundary) take max(published_at)",
                        ],
                    },
                    {
                        "id": "ndfd",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_ndfd",
                        "latest_relation": "silver_elexon_ndfd_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "1d",
                            "settlement_cols": ["settlement_date"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "national_demand_mw",
                                "unit": "MW",
                                "label": "national demand forecast, 2-14 days ahead, one "
                                "figure per delivery day (peak vs mean "
                                "unknown)",
                            }
                        ],
                        "dims": [{"column": "forecast_type", "role": "filter", "cardinality": 1}],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "settlement_period is a placeholder 1, so join on the date (vault)",
                            "timestamp_utc = London midnight (00:00+01); TSDFD's is "
                            "UTC midnight (01:00+01). The same delivery day is stamped "
                            "1 h apart in BST",
                            "all vintages kept: 39 rows / 17 delivery days, from only "
                            "3 publications (1-5 Aug capture)",
                            "values 23,830-29,760 MW: whether the daily figure is a "
                            "peak or a mean is unknown; Elexon's NDFD spec would "
                            "settle it",
                            "The local days span delivery dates 3-19 Aug, which is not "
                            "a week of history. Coverage should be stated per "
                            "publication date.",
                            "Suggested view: latest vintage per settlement_date: max(published_at)",
                        ],
                    },
                    {
                        "id": "tsdfd",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_tsdfd",
                        "latest_relation": "silver_elexon_tsdfd_latest",
                        "not_held_cause": None,
                        "clock": {"column": "forecast_date", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "forecast_demand_mw",
                                "unit": "MW",
                                "label": "transmission system demand forecast, 2-14 days "
                                "ahead, one figure per delivery day",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["forecast_date"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "the key is (forecast_date) only, but 39 rows / 17 dates "
                            "remain (up to 3 vintages from separate capture files)",
                            "timestamp_utc = UTC midnight of forecast_date, 1 h off "
                            "NDFD's London-midnight stamp in BST. Align on the date, "
                            "not the timestamp",
                            "The clock is a date column (forecast_date). Treat it as a "
                            "daily delivery-date axis.",
                            "Suggested view: latest vintage per forecast_date: max(published_at)",
                        ],
                    },
                ],
            },
            {
                "slug": "indicated-demand-and-generation",
                "label": "Indicated demand and generation",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/indicated-demand-and-generation",
                "notes": [],
                "datasets": [
                    {
                        "id": "inddem",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_inddem",
                        "latest_relation": "silver_elexon_inddem_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "indicated_demand_mw",
                                "unit": "MW",
                                "label": "day and day-ahead indicated demand per "
                                "boundary; negative sign convention (N ranges "
                                "-19,924 to -10,745)",
                            }
                        ],
                        "dims": [{"column": "boundary", "role": "filter", "cardinality": 18}],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "settlement_period", "boundary"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "same vintage inversion as tsdf: keep='last' keeps the "
                            "earliest publish per capture day (bronze 2026-08-03: "
                            "1,854 of 1,854 keys)",
                            "base 9,270 rows / 5,310 keys; deduped to latest per key: "
                            "6,048 rows per 7 days",
                            "demand is stored negative. Flip the sign for display only, and say so",
                            "The vault says 'latest wins after dedup'. The bytes show "
                            "the earliest wins within a capture.",
                            "Suggested view: boundary = 'N'; per key take max(published_at)",
                        ],
                    },
                    {
                        "id": "indgen",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_indgen",
                        "latest_relation": "silver_elexon_indgen_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "indicated_generation_mw",
                                "unit": "MW",
                                "label": "day and day-ahead indicated generation per boundary",
                            }
                        ],
                        "dims": [{"column": "boundary", "role": "filter", "cardinality": 18}],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "settlement_period", "boundary"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "same transformer shape as inddem (indgen.py:117), so the "
                            "same earliest-publish-per-capture vintage selection is "
                            "expected. Not bronze-checked separately",
                            "base 9,270 rows / 5,310 keys; deduped to latest per key: "
                            "6,048 rows per 7 days",
                            "Suggested view: boundary = 'N'; per key take max(published_at)",
                        ],
                    },
                ],
            },
            {
                "slug": "indicated-imbalance-and-export-limits",
                "label": "Indicated imbalance and export limits",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/indicated-imbalance-and-export-limits",
                "notes": [],
                "datasets": [
                    {
                        "id": "imbalngc",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_imbalngc",
                        "latest_relation": "silver_elexon_imbalngc_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "indicated_imbalance",
                                "unit": "MW",
                                "label": "national indicated imbalance (negative = "
                                "system short, positive = long)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "settlement_period"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "boundary dropped: bronze carries 18 boundaries (N, "
                            "B1-B17) x 47 publications, and silver has no boundary "
                            "column. It keeps N only because N is the last row per key "
                            "in the vendor's file order (bronze 2026-08-03: 103 of 103 "
                            "keys). That is not guaranteed",
                            "vintage inversion: keep='last' keeps the EARLIEST publish "
                            "per capture day. Example 2026-08-04 SP20: silver -2,004 "
                            "MW (published 10:48Z) vs the day's last issue 3,176 MW "
                            "(23:47Z)",
                            "base 515 rows / 295 keys, up to 3 vintages per key (one "
                            "per capture day); deduped to latest per key: 336 rows per "
                            "7 days",
                            "The vault says 'the transformer keeps the latest'. That "
                            "is wrong. The chart verdict stands only with the vintage "
                            "label; otherwise treat it as broken. Gridflow backlog: "
                            "keep boundary and sort by published_at before dedup.",
                            "Suggested view: per (settlement_date, settlement_period) "
                            "take max(published_at)",
                        ],
                    },
                    {
                        "id": "melngc",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_melngc",
                        "latest_relation": "silver_elexon_melngc_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "indicated_margin",
                                "unit": "MW",
                                "label": "national indicated margin (available "
                                "generation minus demand); 28,292-48,812 "
                                "locally",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "settlement_period"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "identical defect to imbalngc: 18 boundaries in bronze, "
                            "none kept; N survives by file order (103 of 103 keys); "
                            "earliest publish per capture day",
                            "base 515 rows / 295 keys; deduped to latest per key: 336 "
                            "rows per 7 days",
                            "MELNGC is 'Indicated Margin' in the endpoint, schema and "
                            "vault. The catalogue family label says 'export limits', "
                            "which is misleading.",
                            "Suggested view: per (settlement_date, settlement_period) "
                            "take max(published_at)",
                        ],
                    },
                ],
            },
            {
                "slug": "loss-of-load-probability-and-de-rated-margin",
                "label": "Loss of load probability and de-rated margin",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/loss-of-load-probability-and-de-rated-margin",
                "notes": [],
                "datasets": [
                    {
                        "id": "lolpdrm",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_lolpdrm",
                        "latest_relation": "silver_elexon_lolpdrm_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "loss_of_load_probability",
                                "unit": "dimensionless (0-1)",
                                "label": "loss of load probability",
                            },
                            {
                                "column": "derated_margin_mw",
                                "unit": "MW",
                                "label": "de-rated margin",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "settlement_period"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "loss_of_load_probability is 0.0 on all 510 rows "
                            "(plausible in summer, but degenerate to chart). "
                            "derated_margin_mw ranges 6,979-27,587",
                            "the kept vintage depends on file order: in bronze "
                            "2026-08-03, 77 of 102 keys kept neither the earliest nor "
                            "the latest publish. publishingPeriodCommencingTime (the "
                            "forecast horizon) is dropped",
                            "base 510 rows / 294 keys; deduped to latest per key: 336 "
                            "rows per 7 days",
                            "The 12h chunk cap is handled in code "
                            "(max_chunk_hours=12), so the fetch needs 18 chunks. It's "
                            "a cost, not a stop.",
                            "Suggested view: per (settlement_date, settlement_period) "
                            "take max(published_at)",
                        ],
                    }
                ],
            },
            {
                "slug": "wind-generation-forecast",
                "label": "Wind generation forecast",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/wind-generation-forecast",
                "notes": [],
                "datasets": [
                    {
                        "id": "windfor",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_windfor",
                        "latest_relation": "silver_elexon_windfor_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "latest_forecast_mw",
                                "unit": "MW",
                                "label": "wind generation forecast",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "every vintage kept (key timestamp_utc + published_at): "
                            "2,920 rows / 169 instants, up to 32 vintages. Deduped to "
                            "latest per hour: 168 rows per 7 days",
                            "the schema and vault declare initial_forecast_mw, "
                            "settlement_date and settlement_period, but none is in "
                            "silver (the vendor sends startTime and generation only)",
                            "each publication spans -27.5 h to +64.5 h around publish time",
                            "Hourly targets (minute 0 only).",
                            "Suggested view: latest vintage per timestamp_utc: max(published_at)",
                        ],
                    }
                ],
            },
            {
                "slug": "availability-2-to-14-days-ahead",
                "label": "Availability, 2 to 14 days ahead",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/availability-2-to-14-days-ahead",
                "notes": [],
                "datasets": [
                    {
                        "id": "fou2t14d",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_fou2t14d",
                        "latest_relation": "silver_elexon_fou2t14d_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "1d",
                            "settlement_cols": ["settlement_date"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "output_usable_mw",
                                "unit": "MW",
                                "label": "forecast usable output by fuel type per delivery date",
                            }
                        ],
                        "dims": [{"column": "fuel_type", "role": "series", "cardinality": 19}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "APPEND_ONLY: base 29,887 rows (about 41,800 per 7 publish "
                            "days) vs _latest 342 (19 fuels x 18 delivery dates)",
                            "daily grain; the schema/vault settlement_period is absent "
                            "from silver (the vault records this)",
                            "coverage decays across the horizon: the last 3 delivery "
                            "days have 950/494/38 base rows (vault)",
                            "published_at == available_at on every row (vendor time)",
                            "The vault TODO asks whether historical publications can "
                            "be fetched. Local evidence: the 1-6 Aug publications were "
                            "served on 2026-08-16, so 6-13-day-old windows are "
                            "feasible. Deeper history is still unverified. "
                            "timestamp_utc runs up to 14 days past now, so never "
                            "anchor on it. expected_rows is base.",
                        ],
                    },
                    {
                        "id": "uou2t14d",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_uou2t14d",
                        "latest_relation": "silver_elexon_uou2t14d_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "1d",
                            "settlement_cols": ["settlement_date"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "output_usable_mw",
                                "unit": "MW",
                                "label": "forecast usable output per BM unit per delivery date",
                            }
                        ],
                        "dims": [
                            {"column": "fuel_type", "role": "series", "cardinality": 19},
                            {"column": "bm_unit_id", "role": "filter", "cardinality": 464},
                            {
                                "column": "national_grid_bm_unit",
                                "role": "filter",
                                "cardinality": 465,
                            },
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["settlement_date", "bm_unit_id"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "no _latest view: base 32,382 rows / 8,358 keys, up to 5 "
                            "vintages per key (about 45,000 rows per 7 publish days). "
                            "Deduped to latest per key: about 3,250 rows per 7 "
                            "delivery days (464 units x 7)",
                            "the kept vintage depends on file order within a capture: "
                            "bronze 2026-08-03 kept neither the earliest nor the "
                            "latest publish on 6,006 of 6,468 keys",
                            "bm_unit_id null on 0.22% of rows",
                            "daily grain (vendor sends forecastDate only)",
                            "54 x 4h chunks plus pagination; the bronze partition for "
                            "one day was 211k rows. The dedup vintage choice needs a "
                            "gridflow fix before per-unit history is trustworthy. "
                            "rows_per_7d is base by delivery date (2,313 per full day "
                            "x 7).",
                            "Suggested view: latest vintage per (settlement_date, "
                            "bm_unit_id); chart aggregated by fuel_type, table "
                            "filterable by unit",
                        ],
                    },
                ],
            },
            {
                "slug": "temperature",
                "label": "Temperature",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/temperature",
                "notes": [],
                "datasets": [
                    {
                        "id": "temp",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_temp",
                        "latest_relation": "silver_elexon_temp_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "measurement_date",
                            "grain": "1d",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "measurement_date"},
                        "values": [
                            {
                                "column": "temperature",
                                "unit": "degC",
                                "label": "measured GB temperature (vault: Celsius)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "timestamp_utc is the publish instant (16:45 local each "
                            "day), not the measurement time. Use measurement_date",
                            "the schema and vault declare normal/low/high reference "
                            "temperatures, but none is in silver",
                            "The unit comes from the vault only; the schema states none.",
                        ],
                    }
                ],
            },
            {
                "slug": "non-bm-stor",
                "label": "Non-BM STOR",
                "kind": "series",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "nonbm",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "broken",
                        "base_relation": "silver_elexon_nonbm",
                        "latest_relation": "silver_elexon_nonbm_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_mw",
                                "unit": "MW",
                                "label": "non-BM STOR generation",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "5 identical rows: 2026-04-01 SP22, 0.0 MW, published "
                            "2026-04-01 10:04Z. They were ingested once per capture "
                            "day for the 1-5 Aug publish windows, so the API ignored "
                            "the requested window",
                            "cause: the connector sends publishDateTimeFrom/To "
                            "(default param style), but the vendor spec declares "
                            "from/to (vault 'Param style mismatch'). This is the same "
                            "failure class as the fixed FREQ bug (endpoints.py:100)",
                            "Gridflow backlog: set from_param='from', to_param='to' "
                            "for NONBM and re-verify live. Until then, the command "
                            "would re-land the same April row. Whether NONBM has "
                            "published at all since April is also unknown; a live GET "
                            "with from/to would settle both.",
                        ],
                    }
                ],
            },
            {
                "slug": "net-balancing-services-adjustment",
                "label": "Net balancing services adjustment",
                "kind": "series",
                "page": "table-only",
                "route": "/sources/elexon/net-balancing-services-adjustment",
                "notes": [],
                "datasets": [
                    {
                        "id": "netbsad",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_netbsad",
                        "latest_relation": "silver_elexon_netbsad_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "net_buy_price_cost_adjustment_energy",
                                "unit": None,
                                "label": "cost adjustment to net buy price, energy",
                            },
                            {
                                "column": "net_buy_price_volume_adjustment_energy",
                                "unit": None,
                                "label": "volume adjustment to net buy price, energy",
                            },
                            {
                                "column": "net_buy_price_volume_adjustment_system",
                                "unit": None,
                                "label": "volume adjustment to net buy price, system",
                            },
                            {
                                "column": "buy_price_price_adjustment",
                                "unit": None,
                                "label": "price adjustment to buy price",
                            },
                            {
                                "column": "net_sell_price_cost_adjustment_energy",
                                "unit": None,
                                "label": "cost adjustment to net sell price, energy",
                            },
                            {
                                "column": "net_sell_price_volume_adjustment_energy",
                                "unit": None,
                                "label": "volume adjustment to net sell price, energy",
                            },
                            {
                                "column": "net_sell_price_volume_adjustment_system",
                                "unit": None,
                                "label": "volume adjustment to net sell price, system",
                            },
                            {
                                "column": "sell_price_price_adjustment",
                                "unit": None,
                                "label": "price adjustment to sell price",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "4 duplicate keys (SP3 on 2-5 Aug; 245 rows / 241 keys) "
                            "from capture overlap. Dedupe on read",
                            "only the current 8 columns exist in silver. The legacy 4 "
                            "(which had units GBP/MWh and MWh) are absent from local "
                            "files",
                            "units of the current 8 are not stated in the schema or "
                            "vault; the Elexon NETBSAD spec would settle them",
                            "Pairs with DISBSAD (the aggregate of its components).",
                            "Unit unconfirmed for "
                            "net_buy_price_cost_adjustment_energy; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for "
                            "net_buy_price_volume_adjustment_energy; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for "
                            "net_buy_price_volume_adjustment_system; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for buy_price_price_adjustment; research "
                            "did not establish a reliable unit.",
                            "Unit unconfirmed for "
                            "net_sell_price_cost_adjustment_energy; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for "
                            "net_sell_price_volume_adjustment_energy; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for "
                            "net_sell_price_volume_adjustment_system; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for sell_price_price_adjustment; "
                            "research did not establish a reliable unit.",
                        ],
                    }
                ],
            },
            {
                "slug": "physical-notifications-per-bm-unit",
                "label": "Physical notifications per BM unit",
                "kind": "series",
                "page": "build",
                "route": "/sources/elexon/physical-notifications-per-bm-unit",
                "notes": [],
                "datasets": [
                    {
                        "id": "pn",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_elexon_pn",
                        "latest_relation": "silver_elexon_pn_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "level_from",
                                "unit": "MW",
                                "label": "notified level at period start",
                            },
                            {
                                "column": "level_to",
                                "unit": "MW",
                                "label": "notified level at period end",
                            },
                        ],
                        "dims": [{"column": "bm_unit_id", "role": "filter", "cardinality": 2490}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "large",
                        "notes": [
                            "non-contiguous: 1-5 Aug are full (48 SPs x 2,465 units = "
                            "118,368/day), 2026-09-01 has 27 SPs, 09-17 has 42 and "
                            "09-21 has 24",
                            "bm_unit_id null on 0.04% of rows",
                            "intra-period PN points (timeFrom/timeTo) are not kept; "
                            "only the from/to levels per settlement period",
                            "SETTLEMENT_DATE_PERIOD fetch: 10 dates x 48 periods, "
                            "about 480+ requests at 2 req/s. The P3 success criterion "
                            "requires the truncation flag on a pn window over the cap.",
                            "Suggested view: one BM unit (search) or top 20 units by "
                            "mean level_to in window; aggregate by fuel via "
                            "bmunits_reference join",
                        ],
                    }
                ],
            },
            {
                "slug": "bid-offer-acceptances",
                "label": "Bid-offer acceptances",
                "kind": "events",
                "page": "build",
                "route": "/sources/elexon/bid-offer-acceptances",
                "notes": [],
                "datasets": [
                    {
                        "id": "boal",
                        "schedule": "hourly",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_elexon_boal",
                        "latest_relation": "silver_elexon_boal_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "bid_offer_level_from",
                                "unit": "MW",
                                "label": "accepted level at start (stored BIGINT; schema "
                                "says float)",
                            },
                            {
                                "column": "bid_offer_level_to",
                                "unit": "MW",
                                "label": "accepted level at end",
                            },
                        ],
                        "dims": [
                            {"column": "bm_unit_id", "role": "filter", "cardinality": 386},
                            {"column": "so_flag", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "132 duplicate keys (58,981 rows vs 58,849 on date, SP, "
                            "unit, acceptance_number) from capture overlap",
                            "an acceptance spanning several periods is keyed on "
                            "settlementPeriodFrom only; the span is lost (vault)",
                            "deem_flag, stor_flag and rr_flag are all false on every row",
                            "timestamp_utc is the settlement-period start; "
                            "acceptance_time is the instruction time",
                            "Endpoint is BOALF (BOAL was retired). ROADMAP lists BOAL "
                            "as a bespoke-max page (cut line 2 drops that).",
                            "Suggested view: window table sorted by acceptance_time "
                            "desc; filter by unit",
                        ],
                    }
                ],
            },
            {
                "slug": "disaggregated-balancing-services-adjustments",
                "label": "Disaggregated balancing services adjustments",
                "kind": "events",
                "page": "build",
                "route": "/sources/elexon/disaggregated-balancing-services-adjustments",
                "notes": [],
                "datasets": [
                    {
                        "id": "disbsad",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_elexon_disbsad",
                        "latest_relation": "silver_elexon_disbsad_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {"column": "cost", "unit": "GBP", "label": "adjustment action cost"},
                            {
                                "column": "volume",
                                "unit": "MWh",
                                "label": "adjustment action volume",
                            },
                        ],
                        "dims": [
                            {"column": "component", "role": "filter", "cardinality": 5},
                            {"column": "so_flag", "role": "filter", "cardinality": 2},
                            {
                                "column": "adjustment_action_id",
                                "role": "filter",
                                "cardinality": 121,
                            },
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "component null on 2.4% of rows (values Energy, System, "
                            "Non-BM LCM, PSR, PQR)",
                            "19 duplicate keys (3,615 rows vs 3,596) from capture overlap",
                            "stor_flag false on every row",
                            "Don't sum with NETBSAD: NETBSAD is its aggregate.",
                        ],
                    }
                ],
            },
            {
                "slug": "remit-outage-messages",
                "label": "REMIT outage messages",
                "kind": "events",
                "page": "build",
                "route": "/sources/elexon/remit-outage-messages",
                "notes": [],
                "datasets": [
                    {
                        "id": "remit",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_elexon_remit",
                        "latest_relation": "silver_elexon_remit_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "event",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "normal_capacity_mw",
                                "unit": "MW",
                                "label": "normal capacity",
                            },
                            {
                                "column": "available_capacity_mw",
                                "unit": "MW",
                                "label": "available capacity during the event",
                            },
                            {
                                "column": "unavailable_capacity_mw",
                                "unit": "MW",
                                "label": "unavailable capacity",
                            },
                        ],
                        "dims": [
                            {"column": "fuel_type", "role": "filter", "cardinality": 7},
                            {"column": "unavailability_type", "role": "filter", "cardinality": 2},
                            {"column": "event_status", "role": "filter", "cardinality": 3},
                            {"column": "participant_id", "role": "filter", "cardinality": 41},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "APPEND_ONLY: base 890 rows vs _latest 370 (one per mrid)",
                            "event_start_time runs 2024-02-19 to 2029-11-05 and "
                            "event_end_time up to 2029-12-09. Never anchor on them; "
                            "timestamp_utc is the publish instant",
                            "nulls: related_information 48%, asset_type 26%, fuel_type "
                            "and affected_unit_eic 16%, capacity fields 4.7% (the "
                            "OtherMarketInformation messages)",
                            "available_at is stamped at ingest, not vendor time (vault "
                            "fou2t14d.md)",
                            "rows_per_7d is _latest over 5 local days scaled up (base "
                            "is about 1,225 per 7 days). _latest collapses revisions "
                            "only within what is held locally. expected_rows is "
                            "base.",
                        ],
                    }
                ],
            },
            {
                "slug": "system-operator-to-system-operator-trades",
                "label": "System operator to system operator trades",
                "kind": "events",
                "page": "build",
                "route": "/sources/elexon/system-operator-to-system-operator-trades",
                "notes": [],
                "datasets": [
                    {
                        "id": "soso",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_elexon_soso",
                        "latest_relation": "silver_elexon_soso_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "1h",
                            "settlement_cols": ["settlement_date"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "trade_quantity_mw",
                                "unit": "MW",
                                "label": "trade quantity",
                            },
                            {
                                "column": "trade_price",
                                "unit": "GBP/MWh",
                                "label": "trade price (vault)",
                            },
                        ],
                        "dims": [
                            {"column": "trader_unit", "role": "filter", "cardinality": 6},
                            {"column": "trade_direction", "role": "filter", "cardinality": 2},
                            {"column": "resource_provider", "role": "filter", "cardinality": 4},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "end_time is 100% null",
                            "hourly (timestamp_utc minute 0 only; start_time drives "
                            "it); contract_identification is unique per row",
                            "the soso schema declares an optional settlement_period, "
                            "but it is absent from silver",
                            "Trade price unit comes from the vault only; the schema states none.",
                        ],
                    }
                ],
            },
            {
                "slug": "bm-unit-register",
                "label": "BM unit register",
                "kind": "reference",
                "page": "table-only",
                "route": "/sources/elexon/bm-unit-register",
                "notes": [],
                "datasets": [
                    {
                        "id": "bmunits_reference",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_elexon_bmunits_reference",
                        "latest_relation": "silver_elexon_bmunits_reference_latest",
                        "not_held_cause": None,
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "registered_capacity_mw",
                                "unit": "MW",
                                "label": "registered capacity (sourced from generationCapacity)",
                            }
                        ],
                        "dims": [
                            {"column": "fuel_type", "role": "filter", "cardinality": 19},
                            {"column": "gsp_group_id", "role": "filter", "cardinality": 14},
                            {"column": "company_name", "role": "filter", "cardinality": 376},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "fuel_type null on 83.4% of rows; gsp_group_id null on 60.7%",
                            "interconnector registrations (bmUnitType I) are per-party "
                            "trading registrations and not additive; never sum "
                            "capacity by fuel (vault)",
                            "bmUnitType, fpnFlag and demandCapacity are in bronze but "
                            "not mapped into silver (vault)",
                            "NO_PARAMS endpoint: a fetch always returns today's "
                            "register. A past week can't be backfilled, and that "
                            "doesn't matter for a reference table. rows_per_7d is the "
                            "snapshot size. Joins pn/boal/uou2t14d units to "
                            "fuel.",
                        ],
                    }
                ],
            },
        ],
    },
    {
        "key": "entsoe",
        "name": "ENTSO-E Transparency",
        "domain": "Electricity",
        "host": "web-api.tp.entsoe.eu",
        "blurb": "The European electricity transparency platform: load, generation, cross-border "
        "capacity and balancing, by bidding zone.",
        "layer": "silver",
        "families": [
            {
                "slug": "load-actual-and-forecast",
                "label": "Load, actual and forecast",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/load-actual-and-forecast",
                "notes": [],
                "datasets": [
                    {
                        "id": "actual_load",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_actual_load",
                        "latest_relation": "silver_entsoe_actual_load_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "15min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "load_mw",
                                "unit": "MW",
                                "label": "actual total load per bidding zone (A65/A16)",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 4}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "no GB and no IE-SEM rows: areas are FR, BE, NL, DE-LU. GB "
                            "is fetched (DEFAULT_ZONES) but ENTSO-E no longer "
                            "publishes it post-Brexit (vault README)",
                            "segments 1-5 Aug + 2-20 Sep; 0 duplicate keys",
                            "14-20 Sep already held 7/7 days (2688 rows); P2 can skip. "
                            "Continental neighbours only: relevant to GB via "
                            "interconnector coupling, not GB demand.",
                        ],
                    },
                    {
                        "id": "load_forecast",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_load_forecast",
                        "latest_relation": "silver_entsoe_load_forecast_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "15min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "load_forecast_mw",
                                "unit": "MW",
                                "label": "day-ahead total load forecast (A65/A01)",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 4}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "no GB/IE rows (FR, BE, NL, DE-LU)",
                            "published_at = request time (A65 createdDateTime), not a "
                            "real forecast vintage; one row per key (no vintages kept)",
                            "14-20 Sep already held 7/7 days.",
                        ],
                    },
                    {
                        "id": "load_forecast_weekly",
                        "schedule": "weekly",
                        "kind": "series",
                        "verdict": "broken",
                        "base_relation": "silver_entsoe_load_forecast_weekly",
                        "latest_relation": "silver_entsoe_load_forecast_weekly_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "load_forecast_mw",
                                "unit": "MW",
                                "label": "week-ahead forecast; ONE of the daily min "
                                "(A60) / max (A61) values, which one is "
                                "unknown",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 4}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "SILVER BUG: bronze carries two series per zone "
                            "(businessType A60 min and A61 max, P1D). Silver dedups on "
                            "(timestamp_utc, area_code) with keep=last and drops "
                            "business_type, so min and max collapse into one row. The "
                            "survivor is probably A61 (parse order) but that is not "
                            "guaranteed",
                            "vault load_forecast_weekly.md:139-155 records the same collapse",
                            "rows_per_7d is projected (4 zones x 7 daily points). "
                            "gridflow backlog: keep business_type (min/max) in the "
                            "key.",
                        ],
                    },
                    {
                        "id": "load_forecast_monthly",
                        "schedule": "monthly",
                        "kind": "series",
                        "verdict": "broken",
                        "base_relation": "silver_entsoe_load_forecast_monthly",
                        "latest_relation": "silver_entsoe_load_forecast_monthly_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "7d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "load_forecast_mw",
                                "unit": "MW",
                                "label": "month-ahead forecast, weekly points; min/max "
                                "collapsed (see quality)",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 4}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "SILVER BUG: min/max collapse, as in load_forecast_weekly "
                            "(vault load_forecast_monthly.md:136)",
                            "48 rows, 16 distinct keys: x3 cross-partition duplicates "
                            "(identical values)",
                            "One weekly point per zone per week (resolution P7D). The "
                            "re-fetch mostly adds duplicate copies.",
                        ],
                    },
                    {
                        "id": "load_forecast_yearly",
                        "schedule": "yearly",
                        "kind": "series",
                        "verdict": "broken",
                        "base_relation": "silver_entsoe_load_forecast_yearly",
                        "latest_relation": "silver_entsoe_load_forecast_yearly_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "7d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "load_forecast_mw",
                                "unit": "MW",
                                "label": "year-ahead forecast, weekly points; min/max collapsed",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 4}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "SILVER BUG: bronze has A60 + A61 per zone at P7D; silver keeps one",
                            "48 rows, 16 distinct keys: x3 duplicates",
                            "only the weeks inside fetched windows land, so the "
                            "year-ahead curve is never whole",
                        ],
                    },
                ],
            },
            {
                "slug": "installed-capacity-yearly",
                "label": "Installed capacity, yearly",
                "kind": "reference",
                "page": "table-only",
                "route": "/sources/entsoe/installed-capacity-yearly",
                "notes": [],
                "datasets": [
                    {
                        "id": "forecast_margin",
                        "schedule": "yearly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_entsoe_forecast_margin",
                        "latest_relation": "silver_entsoe_forecast_margin_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1y", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "forecast_margin_mw",
                                "unit": "MW",
                                "label": "year-ahead forecast margin per zone (A70/A33)",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 4}],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc", "area_code"],
                            "order_by": [
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "48 rows = 4 distinct keys x12 identical copies (one per fetched day)",
                            "no GB (FR, BE, NL, DE-LU)",
                            "Kind: one P1Y point per zone. That is a yearly snapshot, "
                            "not a series. P2 should skip it: the fetch adds only "
                            "duplicate copies.",
                        ],
                    },
                    {
                        "id": "installed_capacity",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_entsoe_installed_capacity",
                        "latest_relation": "silver_entsoe_installed_capacity_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1y", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "capacity_mw",
                                "unit": "MW",
                                "label": "installed capacity per zone and production "
                                "type (A68/A33)",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 4},
                            {"column": "production_type", "role": "series", "cardinality": 21},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc", "area_code", "production_type"],
                            "order_by": [
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "804 rows = 67 distinct keys x12 identical copies (one per "
                            "fetched day)",
                            "no GB (NL, DE-LU, FR, BE)",
                            "P2 skip: the refetch adds only copies (~9 more).",
                        ],
                    },
                    {
                        "id": "installed_capacity_units",
                        "schedule": "yearly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_entsoe_installed_capacity_units",
                        "latest_relation": "silver_entsoe_installed_capacity_units_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1y", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "capacity_mw",
                                "unit": "MW",
                                "label": "installed capacity per production unit (A71/A33)",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 6},
                            {"column": "production_type", "role": "filter", "cardinality": 18},
                            {"column": "unit_mrid", "role": "filter", "cardinality": 639},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc", "area_code", "unit_mrid"],
                            "order_by": [
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "7,668 rows = 639 distinct keys x12 copies; 1 key has "
                            "conflicting values",
                            "includes GB (2,760 raw rows = 230 GB units)",
                            "GB unit capacities on an EIC key are a possible "
                            "cross-check for the stack's unit capacities.",
                            "Suggested view: GB first",
                        ],
                    },
                ],
            },
            {
                "slug": "generation-actual-and-forecast",
                "label": "Generation, actual and forecast",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/generation-actual-and-forecast",
                "notes": [],
                "datasets": [
                    {
                        "id": "actual_generation",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "broken",
                        "base_relation": "silver_entsoe_actual_generation",
                        "latest_relation": "silver_entsoe_actual_generation_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M FR/NL/DE-LU, PT60M BE, PT30M IE-SEM)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_mw",
                                "unit": "MW",
                                "label": "actual generation per production type "
                                "(A75/A16); corrupted for types that also have "
                                "a consumption series",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 5},
                            {"column": "production_type", "role": "series", "cardinality": 19},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "SILVER BUG: the parser maps both inBiddingZone "
                            "(generation) and outBiddingZone (consumption, e.g. pumped "
                            "storage) to in_domain "
                            "(connectors/entsoe/parsers.py:289-296). The dedup on "
                            "(timestamp_utc, area_code, production_type) keeps the "
                            "last one. Measured on 2026-09-14 12:00Z: 24 (zone, psr) "
                            "pairs have both series. Silver FR B10 = 791.9 = the "
                            "consumption value (the generation value is 98.56). Silver "
                            "FR B25 = 74.57 = consumption. Silver NL B05 = 0.0 while "
                            "generation is 3277",
                            "no GB rows (DE-LU, FR, NL, BE, IE-SEM)",
                            "production_type is an EIC psr code (B01..B25); needs a label map",
                            "Already held 7/7 days of 14-20 Sep. Silver can't tell "
                            "which rows are affected, so a partial chart isn't safe. "
                            "gridflow backlog: keep direction (in/out zone) in the "
                            "key.",
                            "Suggested view: one zone at a time",
                        ],
                    },
                    {
                        "id": "generation_forecast",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_generation_forecast",
                        "latest_relation": "silver_entsoe_generation_forecast_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M, PT60M BE)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "generation_forecast_mw",
                                "unit": "MW",
                                "label": "day-ahead aggregated generation forecast "
                                "(A71/A01), zone total",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 4}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "production_type is '' on every row. The vault says it's "
                            "per production type, but the measured data is zone "
                            "totals. Record as a disagreement; the zone-total reading "
                            "is what the data shows",
                            "BE only 142 rows (sparse); no GB",
                            "rows_per_7d projected (median 310/day). 14-20 Sep: only "
                            "14 Sep held (288 rows).",
                        ],
                    },
                    {
                        "id": "wind_solar_forecast",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_wind_solar_forecast",
                        "latest_relation": "silver_entsoe_wind_solar_forecast_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M, PT60M)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "generation_forecast_mw",
                                "unit": "MW",
                                "label": "day-ahead wind/solar forecast (A69/A01)",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 5},
                            {"column": "production_type", "role": "series", "cardinality": 3},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "production_type B16 solar, B18 wind offshore, B19 wind "
                            "onshore (schema comment)",
                            "IE-SEM only 217 rows; no GB",
                            "published_at is the request clock, not a forecast issue time",
                            "Held 7/7 days of 14-20 Sep. Unlike A75, A69 has no "
                            "consumption series, so the collapse doesn't apply.",
                        ],
                    },
                    {
                        "id": "actual_generation_units",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_actual_generation_units",
                        "latest_relation": "silver_entsoe_actual_generation_units_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M, PT60M)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_mw",
                                "unit": "MW",
                                "label": "actual generation per generation unit (A73/A16)",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 3},
                            {"column": "production_type", "role": "filter", "cardinality": 11},
                            {"column": "unit_mrid", "role": "series", "cardinality": 175},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "unit_name is '' on every row (1 distinct value). Names "
                            "must come from silver_entsoe_generation_units_master_data "
                            "on unit_mrid (join coverage unknown)",
                            "zones FR (126k rows), NL, BE only; no GB",
                            "rows_per_7d projected (median 12,072/day); near the large "
                            "threshold. 14-20 Sep: only 14 Sep held. max_query_days 1 "
                            "means 9 days x 6 zones = 54 requests.",
                            "Suggested view: one zone, top 20 units by energy in the window",
                        ],
                    },
                ],
            },
            {
                "slug": "day-ahead-prices",
                "label": "Day-ahead prices",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/day-ahead-prices",
                "notes": [],
                "datasets": [
                    {
                        "id": "day_ahead_prices",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_day_ahead_prices",
                        "latest_relation": "silver_entsoe_day_ahead_prices_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M continental, PT60M IE-SEM)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "price_eur_mwh",
                                "unit": "per `currency` column (all rows EUR)/MWh",
                                "label": "day-ahead clearing price per zone (A44)",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "series", "cardinality": 5},
                            {"column": "currency", "role": "filter", "cardinality": 1},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "no GB rows: DE-LU, FR, BE, NL, IE-SEM. GB day-ahead is on "
                            "the gold_gb_day_ahead_benchmark side",
                            "488 negative prices (normal)",
                            "currency is authoritative; the column name price_eur_mwh "
                            "is legacy (schema docstring)",
                            "Held 7/7 days of 14-20 Sep. Relevance: neighbour prices "
                            "set the direction of interconnector flow against GB.",
                        ],
                    }
                ],
            },
            {
                "slug": "hydro-reservoirs",
                "label": "Hydro reservoirs",
                "kind": "series",
                "page": "table-only",
                "route": "/sources/entsoe/hydro-reservoirs",
                "notes": [],
                "datasets": [
                    {
                        "id": "water_reservoirs",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_water_reservoirs",
                        "latest_relation": "silver_entsoe_water_reservoirs_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "7d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "reservoir_mwh",
                                "unit": "MWh",
                                "label": "aggregated reservoir filling (energy stored), weekly",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 1}],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc", "area_code"],
                            "order_by": [
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "FR only; 11 rows, 3 distinct weekly points (x3.7 "
                            "duplicates, identical values)",
                            "A chart needs a season of history to say anything; with "
                            "about 4 points a table is the honest view (see the "
                            "family).",
                        ],
                    }
                ],
            },
            {
                "slug": "cross-border-flows-and-schedules",
                "label": "Cross-border flows and schedules",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/cross-border-flows-and-schedules",
                "notes": [],
                "datasets": [
                    {
                        "id": "cross_border_flows",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_cross_border_flows",
                        "latest_relation": "silver_entsoe_cross_border_flows_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M, PT60M)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "flow_mw",
                                "unit": "MW",
                                "label": "physical flow from in area to out area per the "
                                "connector's pair (A11); non-negative",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 3},
                            {"column": "out_area_code", "role": "series", "cardinality": 5},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "8 pairs (client.py _FLOW_PAIRS). GB>FR has only 432 rows "
                            "and GB>IE-SEM 266, against ~1,728 for the other pairs. "
                            "The GB-FR gap cause is unknown",
                            "one direction per pair only. The reverse flow (e.g. "
                            "FR>GB) is never requested, so net flow can't be computed "
                            "(unknown whether A11 in>out is already net)",
                            "Held 7/7 days of 14-20 Sep (segments 1-5 Aug, 8-20 Sep).",
                        ],
                    },
                    {
                        "id": "commercial_schedules",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_commercial_schedules",
                        "latest_relation": "silver_entsoe_commercial_schedules_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M, PT60M GB pairs)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "aggregated final commercial schedule on a "
                                "directional border (A09)",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 3},
                            {"column": "out_area_code", "role": "series", "cardinality": 5},
                            {"column": "business_type", "role": "filter", "cardinality": 1},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "8 pairs, including GB>FR, GB>NL, GB>BE and GB>IE-SEM; 0 "
                            "duplicate keys",
                            "rows_per_7d projected (480/day). 14-20 Sep: only 14 Sep held.",
                        ],
                    },
                    {
                        "id": "net_positions",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_net_positions",
                        "latest_relation": "silver_entsoe_net_positions_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "15min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "implicit-auction net position per zone "
                                "(A25/B09); sign carried by which side is the "
                                "zone",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 5},
                            {"column": "out_area_code", "role": "series", "cardinality": 4},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "one side of every row is the literal placeholder "
                            "'REGION_CODE-----' (e.g. BE>REGION 480 rows, REGION>NL "
                            "476). The zone sits on either side and quantity is always "
                            "positive",
                            "sign convention unknown: which side means export? Settle "
                            "it with the ENTSO-E API guide for A25/B09 or by matching "
                            "the TP UI for one zone-day",
                            "no GB",
                            "rows_per_7d projected (384/day). The page must not ship a "
                            "signed chart until the convention is known. Unsigned "
                            "per-side lines are safe.",
                        ],
                    },
                ],
            },
            {
                "slug": "transfer-capacity",
                "label": "Transfer capacity",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/transfer-capacity",
                "notes": [],
                "datasets": [
                    {
                        "id": "net_transfer_capacity",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_net_transfer_capacity",
                        "latest_relation": "silver_entsoe_net_transfer_capacity_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "60min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "ntc_mw",
                                "unit": "MW",
                                "label": "day-ahead net transfer capacity on a "
                                "directional border (A61)",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 2},
                            {"column": "out_area_code", "role": "series", "cardinality": 5},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "6 pairs: GB>NL, GB>FR, GB>BE, GB>IE-SEM, NL>BE, NL>DE-LU; "
                            "0 duplicates",
                            "rows_per_7d projected (144/day). 14-20 Sep: only 14 Sep held.",
                        ],
                    },
                    {
                        "id": "dc_link_intraday_transfer_limits",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_dc_link_intraday_transfer_limits",
                        "latest_relation": "silver_entsoe_dc_link_intraday_transfer_limits_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "60min (sparse)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "DC link intraday transfer limit (A93)",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 1},
                            {"column": "out_area_code", "role": "series", "cardinality": 1},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "GB>NL only; 24 rows (22 on 1 Aug, 1 each on 5 and 6 Aug). "
                            "The data is published only when a limit is set",
                            "expected_rows unknown: publication is event-driven. "
                            "rows_per_7d = the measured 1-6 Aug count.",
                        ],
                    },
                    {
                        "id": "offered_transfer_capacity_continuous",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_offered_transfer_capacity_continuous",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:OFFERED_TRANSFER_CAPACITIES_IMPLICIT "
                        "[11.1]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "offered capacity, continuous allocation (A31), "
                                "per transformer",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "request sends Auction.Type=A01 like the implicit variant; "
                            "the vendor ack names OFFERED_TRANSFER_CAPACITIES_IMPLICIT "
                            "[11.1]",
                            "The vault README says param casing disambiguates the "
                            "three A31 variants. The acks contradict that: all three "
                            "hit the IMPLICIT data item. The correct Auction.Type code "
                            "for continuous is unknown here (settle from the ENTSO-E "
                            "API guide's code list).",
                        ],
                    },
                    {
                        "id": "offered_transfer_capacity_implicit",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_offered_transfer_capacity_implicit",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:OFFERED_TRANSFER_CAPACITIES_IMPLICIT "
                        "[11.1]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "offered capacity, implicit allocation (A31)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "GB borders have no implicit day-ahead allocation "
                            "post-Brexit, so empty is expected for GB pairs. "
                            "Continental pairs were empty too (flow-based region)."
                        ],
                    },
                    {
                        "id": "offered_transfer_capacity_explicit",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_offered_transfer_capacity_explicit",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:OFFERED_TRANSFER_CAPACITIES_IMPLICIT "
                        "[11.1]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "offered capacity, explicit allocation (A31)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "request sends auction.Type=A01 plus auction.Category=A01; "
                            "the vendor ack names the IMPLICIT data item",
                            "GB borders are explicit-auction borders post-Brexit, so "
                            "this is the variant that could hold GB data. The request "
                            "never asks for an explicit auction type (unknown code; "
                            "settle from the API guide). Worth a gridflow backlog "
                            "item.",
                        ],
                    },
                    {
                        "id": "transfer_capacity_use",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_transfer_capacity_use",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:USE_OF_TRANSFER_CAPACITY [12.1.A]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "use of transfer capacity (A25)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [],
                    },
                    {
                        "id": "total_nominated_capacity",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_total_nominated_capacity",
                        "latest_relation": "silver_entsoe_total_nominated_capacity_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "mixed (PT15M FR-DE, PT60M GB pairs)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "total nominated capacity per border (A26/B08)",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 2},
                            {"column": "out_area_code", "role": "series", "cardinality": 4},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "pairs GB>NL, GB>BE, GB>FR, FR>DE-LU; 0 duplicates",
                            "rows_per_7d projected (168/day).",
                        ],
                    },
                    {
                        "id": "total_capacity_allocated",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_total_capacity_allocated",
                        "latest_relation": "silver_entsoe_total_capacity_allocated_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "60min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "capacity already allocated in past auctions "
                                "per border (A26/A29)",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 3},
                            {"column": "out_area_code", "role": "series", "cardinality": 3},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "pairs GB>NL, GB>BE, FR>DE-LU, FR>BE, NL>DE-LU, NL>BE; 0 duplicates",
                            "rows_per_7d projected (144/day).",
                        ],
                    },
                ],
            },
            {
                "slug": "auction-revenue-and-congestion-income",
                "label": "Auction revenue and congestion income",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/auction-revenue-and-congestion-income",
                "notes": [],
                "datasets": [
                    {
                        "id": "auction_revenue",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_auction_revenue",
                        "latest_relation": "silver_entsoe_auction_revenue_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "60min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "amount_eur",
                                "unit": "EUR",
                                "label": "explicit-auction revenue per border per hour "
                                "(A25/B07); currency not carried, EUR per "
                                "column name and vault",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "series", "cardinality": 1},
                            {"column": "out_area_code", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": [
                                "timestamp_utc",
                                "in_area_code",
                                "out_area_code",
                                "business_type",
                            ],
                            "order_by": [
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "432 rows, 264 distinct keys: x1.64 duplicates (identical "
                            "values). No EVENT_WINDOW_FILTER on the amount class, so "
                            "the CET over-span lands in neighbouring partitions",
                            "GB>NL and GB>BE only",
                            "Read with DISTINCT on (timestamp_utc, in_area_code, "
                            "out_area_code, business_type). rows_per_7d = median day x "
                            "7 on raw rows.",
                        ],
                    },
                    {
                        "id": "congestion_income",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_congestion_income",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:IMPL_ALLOC_CONG_INCOME_FLOW_BASED "
                        "[12.1.E]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "amount_eur",
                                "unit": "EUR",
                                "label": "congestion income (A25)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "The request asks for the implicit/flow-based data item. "
                            "GB borders are explicit, so empty is expected for "
                            "them."
                        ],
                    },
                ],
            },
            {
                "slug": "imbalance-prices-and-volumes",
                "label": "Imbalance prices and volumes",
                "kind": "series",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "imbalance_prices",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_imbalance_prices",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:IMBALANCE_PRICES_R3 [17.1.G]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "price_eur_mwh",
                                "unit": "currency/MWh",
                                "label": "imbalance price long/short (A85)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "As configured it can never land: GB is the only control "
                            "area requested. GB imbalance is Elexon system_prices."
                        ],
                    },
                    {
                        "id": "imbalance_volume",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_imbalance_volume",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:TOTAL_IMBALANCE_VOLUMES_R3 [17.1.H]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "volume_mwh",
                                "unit": "MWh",
                                "label": "imbalance volume long/short (A86/A19)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": ["GB equivalent: Elexon system_prices NIV."],
                    },
                    {
                        "id": "current_balancing_state",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "broken",
                        "base_relation": "silver_entsoe_current_balancing_state",
                        "latest_relation": "silver_entsoe_current_balancing_state_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "irregular (PT1M A03 curve, change points)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "balancing state (A86/B33). Unsigned: "
                                "flowDirection is dropped",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 1}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "SILVER BUG: area_code is '' on all 9,414 rows. The XML "
                            "carries area_Domain.mRID at DOCUMENT level, and the "
                            "parser reads domains only from TimeSeries children "
                            "(parsers.py:283-303). Bronze holds BE, FR and NL "
                            "documents for the same day. The dedup on (timestamp_utc, "
                            "area_code='', business_type) merges and overwrites zones: "
                            "9,414 rows but 7,563 distinct keys",
                            "flowDirection (A01/A02) is in the XML but is not an "
                            "output column, so the sign is lost",
                            "not event-window filtered (TODO-unclassified, "
                            "_event_window.py:224). A fetch of 1-5 Aug produced rows "
                            "up to 25 Aug",
                            "The zones fetched are DEFAULT_ZONES (the A86/B33 variant "
                            "has no domain_style, so the default 'zone' applies; "
                            "endpoints.py:328-333). GB returns an ack.",
                        ],
                    },
                ],
            },
            {
                "slug": "balancing-energy-and-reserves",
                "label": "Balancing energy and reserves",
                "kind": "series",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "activated_balancing_prices",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_activated_balancing_prices",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:PRICES_OF_ACTIVATED_BALANCING_ENERGY_R3 "
                        "[TR 17.1.F]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "price_eur_mwh",
                                "unit": "currency/MWh",
                                "label": "activated balancing energy price (A84/A16, aFRR)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [],
                    },
                    {
                        "id": "aggregated_balancing_energy_bids",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_aggregated_balancing_energy_bids",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:AGGREGATED_BALANCING_ENERGY_BIDS_R3 "
                        "[12.3.E]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "aggregated balancing energy bids (A24/A51)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "Even if it landed, it shares the h8 root-level "
                            "area_Domain parser gap (area_columns=('area_domain',))."
                        ],
                    },
                    {
                        "id": "contracted_reserves",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_contracted_reserves",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:AMOUNT_AND_PRICES_PAID_OF_BALANCING_RESERVES_UNDER_CONTRACT",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "contracted reserves (A81/A52)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [],
                    },
                    {
                        "id": "procured_balancing_capacity",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "broken",
                        "base_relation": "silver_entsoe_procured_balancing_capacity",
                        "latest_relation": "silver_entsoe_procured_balancing_capacity_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "15min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "procured balancing capacity (A15/A51)",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "series", "cardinality": 1},
                            {"column": "market_agreement_type", "role": "filter", "cardinality": 1},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "SILVER BUG: area_code '' and market_agreement_type '' on "
                            "all 440 rows. Bronze has documents for DE-LU, BE, FR and "
                            "NL (root-level area_Domain.mRID, same parser gap as "
                            "current_balancing_state). The dedup on (timestamp_utc, "
                            "'', '') keeps 88 rows per day where 4 zones x 96 would be "
                            "expected",
                            "rows_per_7d projected on the collapsed rows.",
                        ],
                    },
                    {
                        "id": "cross_zonal_balancing_capacity",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_cross_zonal_balancing_capacity",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:ALLOCATION_AND_USE_CROSS_ZONAL_CAPACITY "
                        "[GL EB 12.3.H]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "allocation/use of cross-zonal balancing "
                                "capacity (A38/A51)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [],
                    },
                    {
                        "id": "balancing_financial_expenses_income",
                        "schedule": "monthly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_balancing_financial_expenses_income",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:FINANCIAL_EXPENSES_AND_INCOME_FOR_BALANCING_R3 "
                        "[17.1.I]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "amount_eur",
                                "unit": "EUR",
                                "label": "financial expenses and income for balancing "
                                "(A87), monthly",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "Monthly publication: a mid-month week window couldn't "
                            "hold a point even for a publishing zone."
                        ],
                    },
                ],
            },
            {
                "slug": "outages-unavailable-capacity-per-interval",
                "label": "Outages, unavailable capacity per interval",
                "kind": "events",
                "page": "build",
                "route": "/sources/entsoe/outages-unavailable-capacity-per-interval",
                "notes": [],
                "datasets": [
                    {
                        "id": "outages_generation",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_entsoe_outages_generation",
                        "latest_relation": "silver_entsoe_outages_generation_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "irregular: start of an availability block (A03 "
                            "curve, PT1M); the block END is not in silver",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "unavailable_mw",
                                "unit": "MW",
                                "label": "XML Available Period/Point/quantity. Named "
                                "'unavailable', but it measures as AVAILABLE "
                                "capacity (see quality). Meaning unknown until "
                                "settled",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 6},
                            {"column": "unit_mrid", "role": "series", "cardinality": 221},
                            {"column": "unit_name", "role": "filter", "cardinality": 219},
                            {"column": "outage_type", "role": "filter", "cardinality": 1},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc", "unit_mrid"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"},
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"},
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "11,011 rows but 1,574 distinct (timestamp_utc, "
                            "unit_mrid): about x7 cross-partition copies (every daily "
                            "request re-returns the active notices). 15 keys carry "
                            "conflicting values (revisions)",
                            "planned only: the request hardcodes BusinessType=A53 "
                            "(endpoints.py:54-60). outage_type has 1 value; unplanned "
                            "(A54) outages are never fetched",
                            "cancelled notices are mixed in: 2,168 of 5,423 bronze "
                            "docs carry docStatus A09 (Cancelled), and silver has no "
                            "document_status column, so they can't be filtered",
                            "VALUE SEMANTICS DISAGREEMENT: the vault says quantity is "
                            "unavailable MW (vault outages_generation.md, Known "
                            "issues). Bronze measured against nominalP gives "
                            "quantity=0 on 4,714 points, 0<q<nominalP on 11,504, and "
                            "q=nominalP on 3. Full outages show 0, which reads as "
                            "AVAILABLE capacity during the outage. Settle it on one GB "
                            "unit against the TP UI (it shows both available and "
                            "installed capacity)",
                            "the block end (Available_Period end / "
                            "unavailability_Time_Period end) is dropped, so durations "
                            "can't be drawn",
                            "dedup is revision-unaware (vault)",
                            "The population file's '2015-2069, 672 days' is the "
                            "availability-block clock; the relation actually holds 13 "
                            "fetch days (8-20 Sep). GB rows 3,757 (GB is published for "
                            "A80). The 14-20 Sep fetch days are held already. A re-run "
                            "mostly adds copies. rows_per_7d = raw rows with "
                            "published_at in the last 7 days (copies included).",
                            "Suggested view: GB (10YGB----------A) notices first; "
                            "active now or starting in the window",
                        ],
                    },
                    {
                        "id": "outages_production",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_entsoe_outages_production",
                        "latest_relation": "silver_entsoe_outages_production_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "irregular: availability-block start (A03, PT1M)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "unavailable_mw",
                                "unit": "MW",
                                "label": "same XML quantity as outages generation; same "
                                "semantics dispute",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 3},
                            {"column": "unit_mrid", "role": "series", "cardinality": 46},
                            {"column": "production_type", "role": "filter", "cardinality": 6},
                            {"column": "document_status", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc", "area_code", "unit_mrid", "timeseries_mrid"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"},
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"},
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "3,551 rows, 972 distinct (timestamp_utc, unit_mrid, "
                            "timeseries_mrid): about x3.7 copies",
                            "document_status A09 (cancelled) on 2,399 of 3,551 rows "
                            "(68%); filterable here",
                            "planned only (BusinessType=A53); no GB rows (DE-LU, NL, FR)",
                            "quantity vs nominalP in bronze: q=0 326, 0<q<nom 5,343, "
                            "q=nom 9. Same available-vs-unavailable dispute",
                            "Fetch days 1-5 Aug and 8-14 Sep. Vault: overlaps A80 for many TSOs.",
                            "Suggested view: document_status != 'A09' (cancelled)",
                        ],
                    },
                    {
                        "id": "outages_consumption",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_outages_consumption",
                        "latest_relation": "silver_entsoe_outages_consumption_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "15min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "unavailable_mw",
                                "unit": "MW",
                                "label": "aggregated unavailability of consumption units (A76)",
                            }
                        ],
                        "dims": [{"column": "area_code", "role": "series", "cardinality": 2}],
                        "default_filter": None,
                        "dedup": {
                            "keys": [
                                "timestamp_utc",
                                "area_code",
                                "business_type",
                                "timeseries_mrid",
                            ],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"},
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"},
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "almost all DE-LU (1,728 rows), NL 10; constant values "
                            "0-35 MW; planned only; document_status ''",
                            "0 duplicate keys (unlike the other outage relations)",
                            "the only outage relation on a regular 15-min clock, hence kind series",
                            "Held 7/7 days of 14-20 Sep. 94 of 114 bronze files are acks.",
                        ],
                    },
                    {
                        "id": "outages_transmission",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_entsoe_outages_transmission",
                        "latest_relation": "silver_entsoe_outages_transmission_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "irregular: availability-block start (A03, PT1M)",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "unavailable_mw",
                                "unit": "MW",
                                "label": "XML quantity on the affected border asset; "
                                "available-vs-unavailable meaning unknown (no "
                                "nominalP in A78 to test against)",
                            }
                        ],
                        "dims": [
                            {"column": "in_area_code", "role": "filter", "cardinality": 3},
                            {"column": "out_area_code", "role": "filter", "cardinality": 4},
                            {"column": "asset_mrid", "role": "series", "cardinality": 28},
                            {"column": "document_status", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": [
                                "timestamp_utc",
                                "in_area_code",
                                "out_area_code",
                                "asset_mrid",
                                "timeseries_mrid",
                            ],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"},
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"},
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "3,981 rows, 418 distinct keys: about x9.5 copies",
                            "GB>FR dominates (3,549 rows), which matches the "
                            "interconnector outage notices; planned only",
                            "A09 cancelled on 46 rows",
                            "rows_per_7d = raw rows with published_at in the last 7 days.",
                            "Suggested view: GB borders (in_area_code = "
                            "10YGB----------A), document_status != 'A09'",
                        ],
                    },
                    {
                        "id": "outages_offshore_grid",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_outages_offshore_grid",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:UNAVAILABILITY_OF_OFFSHORE_GRID [10.1.C]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "unavailable_mw",
                                "unit": "MW",
                                "label": "offshore grid unavailability (A79)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["timestamp_utc", "area_code", "asset_mrid", "timeseries_mrid"],
                            "order_by": [
                                {"column": "published_at", "direction": "desc", "nulls": "last"},
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"},
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [
                            "Kind follows the sibling outage relations (block-start events)."
                        ],
                    },
                ],
            },
            {
                "slug": "redispatch-and-countertrading",
                "label": "Redispatch and countertrading",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/redispatch-and-countertrading",
                "notes": [],
                "datasets": [
                    {
                        "id": "redispatching_cross_border",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_redispatching_cross_border",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:REDISPATCHING_CROSS_BORDER_R3 [13.1.A]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "cross-border redispatching (A63)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [],
                    },
                    {
                        "id": "redispatching_internal",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_redispatching_internal",
                        "latest_relation": "silver_entsoe_redispatching_internal_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "15min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "internal redispatching volume (A63/A85)",
                            }
                        ],
                        "dims": [{"column": "in_area_code", "role": "series", "cardinality": 2}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "in_area_code = out_area_code on every row (NL 1,056, BE 148); no GB",
                            "rows_per_7d projected (96/day); activity is event-driven, "
                            "so the week may be sparse.",
                        ],
                    },
                    {
                        "id": "countertrading",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_countertrading",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:COUNTERTRADING_R3 [13.1.B]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {"column": "quantity_mw", "unit": "MW", "label": "countertrading (A91)"}
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": [],
                    },
                    {
                        "id": "congestion_management_costs",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_entsoe_congestion_management_costs",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty:COSTS_OF_CONGESTION_MANAGEMENT_R3 "
                        "[13.1.C]",
                        "clock": None,
                        "latest_day_rule": {"mode": "unknown", "column": None},
                        "values": [
                            {
                                "column": "amount_eur",
                                "unit": "EUR",
                                "label": "costs of congestion management (A92)",
                            }
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": None,
                        "notes": ["P1M cadence: a week window rarely holds a point."],
                    },
                ],
            },
            {
                "slug": "balancing-energy-bids",
                "label": "Balancing energy bids",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsoe/balancing-energy-bids",
                "notes": [],
                "datasets": [
                    {
                        "id": "balancing_energy_bids",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsoe_balancing_energy_bids",
                        "latest_relation": "silver_entsoe_balancing_energy_bids_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "15min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "quantity_mw",
                                "unit": "MW",
                                "label": "offered MW per bid per interval (A37/A47, B74)",
                            }
                        ],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 3},
                            {"column": "direction", "role": "series", "cardinality": 2},
                            {
                                "column": "standard_market_product",
                                "role": "filter",
                                "cardinality": 3,
                            },
                            {"column": "bid_mrid", "role": "filter", "cardinality": 1082},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "BE 30,335 rows; FR and DE-LU 500 each. The "
                            "4800-TimeSeries page cap (client.py:57) may truncate "
                            "FR/DE-LU (unknown)",
                            "direction A01/A02 is kept raw (up/down per the schema "
                            "convention for A84)",
                            "rows_per_7d projected (median 6,257/day). Continental balancing only.",
                            "Suggested view: sum quantity_mw by area_code x direction "
                            "(aggregate the 1,082 bids)",
                        ],
                    }
                ],
            },
            {
                "slug": "generation-unit-register",
                "label": "Generation unit register",
                "kind": "reference",
                "page": "table-only",
                "route": "/sources/entsoe/generation-unit-register",
                "notes": [],
                "datasets": [
                    {
                        "id": "generation_units_master_data",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_entsoe_generation_units_master_data",
                        "latest_relation": "silver_entsoe_generation_units_master_data_latest",
                        "not_held_cause": None,
                        "clock": None,
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [
                            {"column": "area_code", "role": "filter", "cardinality": 6},
                            {"column": "production_type", "role": "filter", "cardinality": 18},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["area_code", "unit_mrid"],
                            "order_by": [
                                {"column": "ingested_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "1,317 rows = 660 distinct (area_code, unit_mrid) x2 "
                            "snapshots (Aug, Sep), identical",
                            "Not needed for the week; supplies unit names for "
                            "actual_generation_units (whose unit_name is blank).",
                        ],
                    }
                ],
            },
        ],
    },
    {
        "key": "neso",
        "name": "NESO Carbon Intensity",
        "domain": "Electricity",
        "host": "api.carbonintensity.org.uk",
        "blurb": "Carbon intensity of GB electricity, national and regional, forecast and actual, with "
        "the fuel mix in per cent.",
        "layer": "silver",
        "families": [
            {
                "slug": "national-carbon-intensity",
                "label": "National carbon intensity",
                "kind": "series",
                "page": "build",
                "route": "/sources/neso/national-carbon-intensity",
                "notes": [],
                "datasets": [
                    {
                        "id": "carbon_intensity",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_carbon_intensity",
                        "latest_relation": "silver_neso_carbon_intensity_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "NESO forecast national carbon intensity for "
                                "the half-hour",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "NESO estimated actual national carbon "
                                "intensity (ex-post)",
                            },
                            {
                                "column": "intensity_index",
                                "unit": "category",
                                "label": "very low | low | moderate | high | very high band",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "timestamp_utc is the API 'from' (period start); a range "
                            "request also returns the half-hour ending at 'from' (241 "
                            "rows for 5 days = 240 + 1 boundary)",
                            "no settlement_date/period columns in silver; P3 derives "
                            "nothing, charts on timestamp_utc",
                            "silver dedup key is timestamp_utc only "
                            "(GF/silver/neso/carbon_intensity.py:469-498): re-fetch "
                            "overwrites the forecast, no vintage history",
                            "Canonical page dataset for the family. It feeds "
                            "gold_uk_imbalance_context, so this backfill also fills "
                            "that view's CI columns for the week. DISAGREEMENT: "
                            "config/sources.yaml gives carbon_intensity endpoint "
                            '"/intensity" (the current-only route), but code builds '
                            "/intensity/{from_dt}/{to_dt}. Code is authoritative; the "
                            "yaml endpoint string is unused. Power-stack relevance "
                            "medium: carbon cost context for the stack, not an input "
                            "to it. P2 receipt: NESO batches the whole window into one "
                            "bronze body under data_date 2026-09-13 "
                            "(connectors/neso/carbon_intensity.py:79). Transform dates "
                            "14–22 Sep log 'covered-but-not-owned' and return 0 rows "
                            "(silver/base.py:1194-1199, a warning, not a failure); all "
                            "rows land in the 13 Sep silver file.",
                        ],
                    },
                    {
                        "id": "intensity_current",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_intensity_current",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/intensity_current "
                        "dir; a transformer IS registered "
                        "(GF/silver/neso/carbon_intensity.py:272-280 "
                        "registers every ENDPOINTS key), so nothing is "
                        "folded; the endpoint is current-only "
                        "(requires_window=False)",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current half-hour forecast",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current half-hour estimated actual",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "A --start 2026-09-13 run would write the fetch-time "
                            "half-hour (26 Sep) into a bronze partition labelled 13 "
                            "Sep. Its data is a strict subset of carbon_intensity. "
                            "Only a scheduled live poll would build history."
                        ],
                    },
                    {
                        "id": "intensity_period",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_intensity_period",
                        "latest_relation": "silver_neso_intensity_period_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "forecast intensity for one date+settlement period",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "estimated actual",
                            },
                            {
                                "column": "intensity_index",
                                "unit": "category",
                                "label": "index band",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "same series as carbon_intensity fetched one SP per "
                            "request (48 requests per day)",
                            "About 432 requests at 10 req/s. Skip in P2: "
                            "carbon_intensity gives the same rows in one request.",
                        ],
                    },
                    {
                        "id": "intensity_at",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "reference-table",
                        "base_relation": "silver_neso_intensity_at",
                        "latest_relation": "silver_neso_intensity_at_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "intensity for the half-hour at --start",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "estimated actual",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "one row per request; the request is anchored at --start, "
                            "so a multi-day window still yields 1 row",
                            "Filling the week would take 336 separate runs, one per "
                            "half-hour. Not worth it: the data duplicates "
                            "carbon_intensity.",
                        ],
                    },
                    {
                        "id": "intensity_fw24h",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_intensity_fw24h",
                        "latest_relation": "silver_neso_intensity_fw24h_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "forecast for 24h forward of --start",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "estimated actual where already published",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "one request per 14-day chunk, anchored at --start: 49 "
                            "rows covering 24h regardless of window length",
                            "for a past --start the API returns stored forecast+actual "
                            "(vault bronze sample for 2024-01-15 carries actual), not "
                            "an as-issued forecast vintage",
                            "Covering 14–20 Sep needs 7 day-anchored runs (--start "
                            "2026-09-14 --end 2026-09-15, and so on). Recommend "
                            "skipping: same values as carbon_intensity.",
                        ],
                    },
                    {
                        "id": "intensity_fw48h",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_intensity_fw48h",
                        "latest_relation": "silver_neso_intensity_fw48h_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "forecast for 48h forward of --start",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "estimated actual",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "anchored at --start: 97 rows over 48h per run",
                            "Same anchoring caveat as fw24h.",
                        ],
                    },
                    {
                        "id": "intensity_pt24h",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_intensity_pt24h",
                        "latest_relation": "silver_neso_intensity_pt24h_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "intensity for the 24h before --start",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "estimated actual",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "anchored at --start and looks BACK 24h: the runbook "
                            "command returns 12–13 Sep, outside the week",
                            "Would need 7 runs with --start 2026-09-15 … 2026-09-21 to "
                            "cover the week. Recommend skipping.",
                        ],
                    },
                    {
                        "id": "intensity_today",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_intensity_today",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/intensity_today "
                        "dir; own transformer registered; /intensity/date "
                        "serves the current date only "
                        "(requires_window=False)",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "today's half-hours",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "estimated actual",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["intensity_date covers any past date with the same shape."],
                    },
                    {
                        "id": "intensity_date",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_intensity_date",
                        "latest_relation": "silver_neso_intensity_date_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "all half-hours of one date",
                            },
                            {
                                "column": "actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "estimated actual",
                            },
                            {
                                "column": "intensity_index",
                                "unit": "category",
                                "label": "index band",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "rows align to UK-local days (first row "
                            "2026-07-31T23:00Z); same series as carbon_intensity",
                            "Measured: 240 rows vs carbon_intensity's 241 for the same "
                            "days. Skip in P2.",
                        ],
                    },
                ],
            },
            {
                "slug": "intensity-statistics",
                "label": "Intensity statistics",
                "kind": "series",
                "page": "table-only",
                "route": "/sources/neso/intensity-statistics",
                "notes": [],
                "datasets": [
                    {
                        "id": "intensity_stats",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "reference-table",
                        "base_relation": "silver_neso_intensity_stats",
                        "latest_relation": "silver_neso_intensity_stats_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "request-window",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "period_end_utc"},
                        "values": [
                            {
                                "column": "max_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "max over the request window",
                            },
                            {
                                "column": "average_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "mean over the window",
                            },
                            {
                                "column": "min_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "min over the window",
                            },
                            {
                                "column": "intensity_index",
                                "unit": "category",
                                "label": "index of the average",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "one summary row per ≤14-day request chunk; its span is "
                            "period_end_utc - timestamp_utc",
                            "DISAGREEMENT: the vault says max 30 days per request; "
                            "code chunks at 14 days (_MAX_DAYS_PER_REQUEST). Harmless "
                            "for a 9-day window.",
                        ],
                    },
                    {
                        "id": "intensity_stats_block",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_intensity_stats_block",
                        "latest_relation": "silver_neso_intensity_stats_block_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "24h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "max_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "max per 24h block",
                            },
                            {
                                "column": "average_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "mean per block",
                            },
                            {
                                "column": "min_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "min per block",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "blocks are 24h from --start in UTC (block=24 default), not UK days"
                        ],
                    },
                ],
            },
            {
                "slug": "generation-mix-per-cent",
                "label": "Generation mix, per cent",
                "kind": "series",
                "page": "build",
                "route": "/sources/neso/generation-mix-per-cent",
                "notes": [],
                "datasets": [
                    {
                        "id": "generation",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_generation",
                        "latest_relation": "silver_neso_generation_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_percentage",
                                "unit": "%",
                                "label": "fuel share of GB generation for the half-hour",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "series", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "measured P1-3: shares sum to 99.8–100.2 per half-hour "
                            "(vendor rounding)",
                            "long format: key (timestamp_utc, fuel)",
                            "Percentages only, no MW: use Elexon fuelhh for volumes. "
                            "Fuel labels follow NESO's naming (e.g. 'imports', "
                            "'other'), not Elexon's fuel types. P2 receipt: NESO "
                            "batches the whole window into one bronze body under "
                            "data_date 2026-09-13 "
                            "(connectors/neso/carbon_intensity.py:79). Transform dates "
                            "14–22 Sep log 'covered-but-not-owned' and return 0 rows "
                            "(silver/base.py:1194-1199, a warning, not a failure); all "
                            "rows land in the 13 Sep silver file.",
                        ],
                    },
                    {
                        "id": "generation_current",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_generation_current",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/generation_current "
                        "dir; own transformer registered; /generation is "
                        "current-only (requires_window=False)",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "generation_percentage",
                                "unit": "%",
                                "label": "current fuel share",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "series", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["A subset of generation."],
                    },
                    {
                        "id": "generation_pt24h",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_generation_pt24h",
                        "latest_relation": "silver_neso_generation_pt24h_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "generation_percentage",
                                "unit": "%",
                                "label": "fuel share, 24h before --start",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "series", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "anchored at --start, looks back 24h: the runbook command "
                            "returns 12–13 Sep",
                            "Recommend skipping in P2: generation covers the week.",
                        ],
                    },
                ],
            },
            {
                "slug": "regional-intensity",
                "label": "Regional intensity",
                "kind": "series",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "regional_current",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_regional_current",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/regional_current "
                        "dir; own transformer registered; /regional is "
                        "current-only",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current regional forecast",
                            },
                            {
                                "column": "generation_percentage",
                                "unit": "%",
                                "label": "regional fuel share",
                            },
                        ],
                        "dims": [
                            {"column": "regionid", "role": "series", "cardinality": 18},
                            {"column": "fuel", "role": "filter", "cardinality": 9},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["A subset of regional_intensity."],
                    },
                    {
                        "id": "regional_england",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_regional_england",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/regional_england "
                        "dir; own transformer registered; current-only",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current England forecast",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["England is regionid 15 inside regional_intensity (measured)."],
                    },
                    {
                        "id": "regional_scotland",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_regional_scotland",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/regional_scotland "
                        "dir; own transformer registered; current-only",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current Scotland forecast",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["Scotland is regionid 16 inside regional_intensity."],
                    },
                    {
                        "id": "regional_wales",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_regional_wales",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/regional_wales dir; "
                        "own transformer registered; current-only",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current Wales forecast",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["Wales is regionid 17 inside regional_intensity."],
                    },
                    {
                        "id": "regional_postcode",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_regional_postcode",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/regional_postcode "
                        "dir; own transformer registered; current-only "
                        "(default postcode RG10)",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current forecast for postcode RG10",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [],
                    },
                    {
                        "id": "regional_regionid",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": "silver_neso_regional_regionid",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: no bronze/neso/regional_regionid "
                        "dir; own transformer registered; current-only "
                        "(DEFAULT_REGION_ID=13)",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "current forecast for regionid 13 (London)",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [],
                    },
                ],
            },
            {
                "slug": "regional-intensity-windows",
                "label": "Regional intensity windows",
                "kind": "series",
                "page": "build",
                "route": "/sources/neso/regional-intensity-windows",
                "notes": [],
                "datasets": [
                    {
                        "id": "regional_intensity",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity",
                        "latest_relation": "silver_neso_regional_intensity_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "regional forecast intensity (repeated on each "
                                "of the 9 fuel rows)",
                            },
                            {
                                "column": "generation_percentage",
                                "unit": "%",
                                "label": "regional fuel share",
                            },
                            {
                                "column": "intensity_index",
                                "unit": "category",
                                "label": "regional index band",
                            },
                        ],
                        "dims": [
                            {"column": "regionid", "role": "series", "cardinality": 18},
                            {"column": "fuel", "role": "filter", "cardinality": 9},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "measured P1-3: actual_gco2_kwh is 100% null (vault says "
                            "'usually absent'; locally always absent)",
                            "long on fuel: 39042 = 241 x 18 x 9; intensity columns "
                            "repeat 9 times per (timestamp, region)",
                            "regions 1–14 are DNO areas; 15 England, 16 Scotland, 17 "
                            "Wales, 18 GB are aggregates. Never sum across all 18.",
                            "Canonical page dataset for the family. The postcode and "
                            "regionid variants are single-region slices of this "
                            "relation. P2 receipt: NESO batches the whole window into "
                            "one bronze body under data_date 2026-09-13 "
                            "(connectors/neso/carbon_intensity.py:79). Transform dates "
                            "14–22 Sep log 'covered-but-not-owned' and return 0 rows "
                            "(silver/base.py:1194-1199, a warning, not a failure); all "
                            "rows land in the 13 Sep silver file.",
                            "Suggested view: intensity chart: one row per "
                            "(timestamp_utc, regionid), deduplicated or filtered to "
                            "one fuel; fuel-mix view: one region at a time (default "
                            "regionid 18 = GB)",
                        ],
                    },
                    {
                        "id": "regional_intensity_postcode",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_postcode",
                        "latest_relation": "silver_neso_regional_intensity_postcode_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "forecast for postcode RG10 (resolves to "
                                "regionid 12 South England)",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "single region: RG10 -> regionid 12 (measured)",
                            "Skip in P2.",
                        ],
                    },
                    {
                        "id": "regional_intensity_regionid",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_regionid",
                        "latest_relation": "silver_neso_regional_intensity_regionid_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "forecast for regionid 13 London",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "single region 13 London",
                            "Skip in P2.",
                        ],
                    },
                    {
                        "id": "regional_intensity_fw24h",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_fw24h",
                        "latest_relation": "silver_neso_regional_intensity_fw24h_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "regional forecast, 24h from --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [
                            {"column": "regionid", "role": "series", "cardinality": 18},
                            {"column": "fuel", "role": "filter", "cardinality": 9},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "anchored at --start: 49 half-hours per run",
                            "Skip in P2.",
                            "Suggested view: one row per (timestamp_utc, regionid) for intensity",
                        ],
                    },
                    {
                        "id": "regional_intensity_fw24h_postcode",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_fw24h_postcode",
                        "latest_relation": "silver_neso_regional_intensity_fw24h_postcode_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "RG10 forecast, 24h from --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "anchored at --start",
                            "Skip in P2.",
                        ],
                    },
                    {
                        "id": "regional_intensity_fw24h_regionid",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_fw24h_regionid",
                        "latest_relation": "silver_neso_regional_intensity_fw24h_regionid_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "region 13 forecast, 24h from --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "anchored at --start",
                            "Skip in P2.",
                        ],
                    },
                    {
                        "id": "regional_intensity_fw48h",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_fw48h",
                        "latest_relation": "silver_neso_regional_intensity_fw48h_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "regional forecast, 48h from --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [
                            {"column": "regionid", "role": "series", "cardinality": 18},
                            {"column": "fuel", "role": "filter", "cardinality": 9},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "anchored at --start: 97 half-hours per run",
                            "Skip in P2.",
                            "Suggested view: one row per (timestamp_utc, regionid) for intensity",
                        ],
                    },
                    {
                        "id": "regional_intensity_fw48h_postcode",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_fw48h_postcode",
                        "latest_relation": "silver_neso_regional_intensity_fw48h_postcode_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "RG10 forecast, 48h from --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "anchored at --start",
                            "Skip in P2.",
                        ],
                    },
                    {
                        "id": "regional_intensity_fw48h_regionid",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_fw48h_regionid",
                        "latest_relation": "silver_neso_regional_intensity_fw48h_regionid_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "region 13 forecast, 48h from --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "anchored at --start",
                            "Skip in P2.",
                        ],
                    },
                    {
                        "id": "regional_intensity_pt24h",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_pt24h",
                        "latest_relation": "silver_neso_regional_intensity_pt24h_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "regional intensity, 24h before --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [
                            {"column": "regionid", "role": "series", "cardinality": 18},
                            {"column": "fuel", "role": "filter", "cardinality": 9},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "looks back 24h from --start: the runbook command returns 12–13 Sep",
                            "Skip in P2.",
                            "Suggested view: one row per (timestamp_utc, regionid) for intensity",
                        ],
                    },
                    {
                        "id": "regional_intensity_pt24h_postcode",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_pt24h_postcode",
                        "latest_relation": "silver_neso_regional_intensity_pt24h_postcode_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "RG10, 24h before --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "looks back 24h from --start",
                            "Skip in P2.",
                        ],
                    },
                    {
                        "id": "regional_intensity_pt24h_regionid",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_regional_intensity_pt24h_regionid",
                        "latest_relation": "silver_neso_regional_intensity_pt24h_regionid_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "region 13, 24h before --start",
                            },
                            {"column": "generation_percentage", "unit": "%", "label": "fuel share"},
                        ],
                        "dims": [{"column": "fuel", "role": "filter", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "actual_gco2_kwh 100% null",
                            "looks back 24h from --start",
                            "Skip in P2.",
                        ],
                    },
                ],
            },
            {
                "slug": "emission-factors-by-fuel",
                "label": "Emission factors by fuel",
                "kind": "reference",
                "page": "table-only",
                "route": "/sources/neso/emission-factors-by-fuel",
                "notes": [],
                "datasets": [
                    {
                        "id": "intensity_factors",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_neso_intensity_factors",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {"column": "ingested_at", "grain": "none", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "factor_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "static emission factor per fuel",
                            }
                        ],
                        "dims": [{"column": "fuel", "role": "series", "cardinality": "unknown"}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Not window-bound: any run fetches the current static "
                            "table. The fuel count is unknown until fetched. Medium "
                            "stack relevance: these per-fuel factors are the natural "
                            "carbon-cost input a stack's marginal cost could use. The "
                            "stack's cost_provenance currently says "
                            '"assumption:legacy_carbon_in…" (measured), so it does not '
                            "use them."
                        ],
                    }
                ],
            },
        ],
    },
    {
        "key": "neso_data_portal",
        "name": "NESO Data Portal",
        "domain": "Electricity",
        "host": "api.neso.energy",
        "blurb": "Files from the GB system operator: the historic generation mix, embedded wind and "
        "solar forecasts, and wind availability.",
        "layer": "silver",
        "families": [
            {
                "slug": "historic-generation-mix",
                "label": "Historic generation mix",
                "kind": "series",
                "page": "build",
                "route": "/sources/neso_data_portal/historic-generation-mix",
                "notes": [],
                "datasets": [
                    {
                        "id": "historic_generation_mix",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_data_portal_historic_generation_mix",
                        "latest_relation": "silver_neso_data_portal_historic_generation_mix_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "gas",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "coal",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "nuclear",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "wind",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "wind_emb",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "hydro",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "imports",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "biomass",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "other",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "solar",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {
                                "column": "storage",
                                "unit": "MW",
                                "label": "generation per fuel (wind emb = embedded wind)",
                            },
                            {"column": "generation", "unit": "MW", "label": "total generation"},
                            {"column": "low_carbon", "unit": "MW", "label": "vendor aggregates"},
                            {"column": "zero_carbon", "unit": "MW", "label": "vendor aggregates"},
                            {"column": "renewable", "unit": "MW", "label": "vendor aggregates"},
                            {"column": "fossil", "unit": "MW", "label": "vendor aggregates"},
                            {
                                "column": "carbon_intensity",
                                "unit": "gCO2/kWh",
                                "label": "NESO's carbon intensity for the half-hour",
                            },
                            {
                                "column": "gas_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "coal_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "nuclear_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "wind_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "wind_emb_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "hydro_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "imports_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "biomass_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "other_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "solar_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "storage_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "generation_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "low_carbon_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "zero_carbon_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "renewable_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                            {
                                "column": "fossil_pct",
                                "unit": "%",
                                "label": "vendor-published shares, carried not recomputed",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "APPEND_ONLY whole-history captures: base 619,092 rows = 2 "
                            "captures; _latest 309,931 (measured P1-3). Read _latest.",
                            "vendor DATETIME read as UTC per CKAN field metadata only; "
                            "the transformer refuses offset-carrying values",
                            "published_at (2 distinct, 20 Aug and 5 Sep) is the "
                            "vintage axis: NESO cleanses history, so captures can "
                            "disagree",
                            "The runbook command is refused: its 9-day span exceeds "
                            "_MAX_INGEST_WINDOW (7d), and its end is more than 48h "
                            "before now. A live capture with the default 24h lookback "
                            "re-downloads 2009→now, which covers 14–20 Sep: +336 "
                            "_latest rows for the week, about +310k base rows overall. "
                            "It is a stack lineage input "
                            "(lineage_neso_data_portal_historic_generation_mix_* in "
                            "gold_stack_*), hence high relevance. Deepest local "
                            "history in the catalogue: W1 bespoke candidate.",
                            "Suggested view: for windows over 90 days, aggregate to "
                            "daily means server-side",
                        ],
                    }
                ],
            },
            {
                "slug": "embedded-wind-and-solar-forecast",
                "label": "Embedded wind and solar forecast",
                "kind": "series",
                "page": "build",
                "route": "/sources/neso_data_portal/embedded-wind-and-solar-forecast",
                "notes": [],
                "datasets": [
                    {
                        "id": "embedded_wind_solar_forecast",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_data_portal_embedded_wind_solar_forecast",
                        "latest_relation": "silver_neso_data_portal_embedded_wind_solar_forecast_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "event_time",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "issue_time"},
                        "values": [
                            {
                                "column": "embedded_wind_forecast",
                                "unit": "MW",
                                "label": "forecast embedded (distribution-connected) wind output",
                            },
                            {
                                "column": "embedded_wind_capacity",
                                "unit": "MW",
                                "label": "embedded wind capacity assumed",
                            },
                            {
                                "column": "embedded_solar_forecast",
                                "unit": "MW",
                                "label": "forecast embedded solar output",
                            },
                            {
                                "column": "embedded_solar_capacity",
                                "unit": "MW",
                                "label": "embedded solar capacity assumed",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "one issue only locally: issue_time 2026-08-20 21:25Z "
                            "covers 20 Aug–2 Sep (measured P1-3)",
                            "no timestamp_utc by design (D-26); event_time comes from "
                            "settlement_date/period through the DST-safe converter",
                            "time_gmt_raw is unparsed; its start/end convention is undocumented",
                            "Not-held-week: the issues covering 14–20 Sep are gone. A "
                            "live capture now yields about 26 Sep → early Oct. High "
                            "relevance: embedded generation reduces transmission "
                            "demand (residual demand).",
                        ],
                    }
                ],
            },
            {
                "slug": "wind-availability-per-bm-unit",
                "label": "Wind availability per BM unit",
                "kind": "series",
                "page": "build",
                "route": "/sources/neso_data_portal/wind-availability-per-bm-unit",
                "notes": [],
                "datasets": [
                    {
                        "id": "daily_wind_availability",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_neso_data_portal_daily_wind_availability",
                        "latest_relation": "silver_neso_data_portal_daily_wind_availability_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "availability_date",
                            "grain": "1d",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "max", "column": "published_at"},
                        "values": [
                            {
                                "column": "availability_mw",
                                "unit": "MW",
                                "label": "forecast available capacity of the wind BM "
                                "unit for the day",
                            }
                        ],
                        "dims": [{"column": "bmu_id", "role": "series", "cardinality": 276}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "measured P1-3: 1 all-null row (bmu_id, date and MW all "
                            "null) from the 20 Aug capture; filter bmu_id IS NOT NULL",
                            "one capture locally, so base and _latest are identical today",
                            "Not-held-week: no historical archive exists. A live "
                            "capture gives the days 2–14 ahead of now. bmu_id joins to "
                            "Elexon BM units. High relevance: availability is a "
                            "supply-side input for the stack.",
                            "Suggested view: sum across BMUs as the headline line; top "
                            "20 BMUs by MW for the per-unit view",
                        ],
                    }
                ],
            },
        ],
    },
    {
        "key": "open_meteo",
        "name": "Open-Meteo",
        "domain": "Weather",
        "host": "api.open-meteo.com/v1",
        "blurb": "Hourly weather at fixed GB sites chosen to explain demand, wind and solar output.",
        "layer": "silver",
        "families": [
            {
                "slug": "weather-at-demand-centres",
                "label": "Weather at demand centres",
                "kind": "series",
                "page": "build",
                "route": "/sources/open_meteo/weather-at-demand-centres",
                "notes": [],
                "datasets": [
                    {
                        "id": "historical_demand",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_open_meteo_historical_demand",
                        "latest_relation": "silver_open_meteo_historical_demand_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "temperature_2m_c",
                                "unit": "°C",
                                "label": "2 m air temperature",
                            },
                            {
                                "column": "hdd_k",
                                "unit": "K",
                                "label": "heating degree hours, max(0, 15.5 - T)",
                            },
                            {
                                "column": "cdd_k",
                                "unit": "K",
                                "label": "cooling degree hours, max(0, T - 22)",
                            },
                            {
                                "column": "wind_speed_10m_mps",
                                "unit": "m/s",
                                "label": "10 m wind speed",
                            },
                            {"column": "shortwave_radiation_wm2", "unit": "W/m2", "label": "GHI"},
                            {
                                "column": "relative_humidity_2m_pct",
                                "unit": "% / mm / hPa / cm/h / m / kg/m3",
                                "label": "secondary drivers",
                            },
                            {
                                "column": "precipitation_mm",
                                "unit": "% / mm / hPa / cm/h / m / kg/m3",
                                "label": "secondary drivers",
                            },
                            {
                                "column": "surface_pressure_hpa",
                                "unit": "% / mm / hPa / cm/h / m / kg/m3",
                                "label": "secondary drivers",
                            },
                            {
                                "column": "snowfall_cm",
                                "unit": "% / mm / hPa / cm/h / m / kg/m3",
                                "label": "secondary drivers",
                            },
                            {
                                "column": "snow_depth_m",
                                "unit": "% / mm / hPa / cm/h / m / kg/m3",
                                "label": "secondary drivers",
                            },
                            {
                                "column": "air_density_kg_m3",
                                "unit": "% / mm / hPa / cm/h / m / kg/m3",
                                "label": "secondary drivers",
                            },
                        ],
                        "dims": [{"column": "location", "role": "series", "cardinality": 7}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "ERA5 archive lags ~5 days (vault; not vendor-guaranteed)",
                            "vintage_policy column carries 2 labels (ADR-031); not "
                            "APPEND_ONLY, so base is the read surface",
                            "end_date is sent as the calendar date 2026-09-22 "
                            "(inclusive), so 10 days x 24 x 7. Run on or after 26 Sep: "
                            "14–20 Sep should be past the ERA5 lag, while 21–22 Sep "
                            "may land null. Model input to gridflow_models demand "
                            "v1/v2 "
                            "(configs/models/day_ahead/lgbm_demand_v2.yaml:30).",
                        ],
                    },
                    {
                        "id": "forecast_demand",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_open_meteo_forecast_demand",
                        "latest_relation": "silver_open_meteo_forecast_demand_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "temperature_2m_c",
                                "unit": "°C",
                                "label": "forecast 2 m temperature",
                            },
                            {"column": "hdd_k", "unit": "K", "label": "derived degree hours"},
                            {"column": "cdd_k", "unit": "K", "label": "derived degree hours"},
                            {"column": "wind_speed_10m_mps", "unit": "m/s", "label": "10 m wind"},
                        ],
                        "dims": [{"column": "location", "role": "series", "cardinality": 7}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "vintages overwritten: dedup (timestamp_utc, location) "
                            "keep=last; no forecast_run_at",
                            "a past-dated fetch is the model's stitched hindcast, not "
                            "an as-issued forecast",
                            "DISAGREEMENT (soft): the vault says the canonical past "
                            "path is the archive and that the connector doesn't use "
                            "past_days. The code sends start_date/end_date to "
                            "/forecast, and a past-dated fetch has worked locally.",
                        ],
                    },
                ],
            },
            {
                "slug": "weather-at-wind-sites",
                "label": "Weather at wind sites",
                "kind": "series",
                "page": "build",
                "route": "/sources/open_meteo/weather-at-wind-sites",
                "notes": [],
                "datasets": [
                    {
                        "id": "historical_wind",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_open_meteo_historical_wind",
                        "latest_relation": "silver_open_meteo_historical_wind_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "wind_speed_100m_mps",
                                "unit": "m/s",
                                "label": "100 m (hub-height proxy) wind speed",
                            },
                            {
                                "column": "wind_speed_10m_mps",
                                "unit": "m/s",
                                "label": "10 m wind speed",
                            },
                            {"column": "wind_gusts_10m_mps", "unit": "m/s", "label": "10 m gusts"},
                            {
                                "column": "wind_direction_10m_deg",
                                "unit": "deg",
                                "label": "direction",
                            },
                            {
                                "column": "wind_direction_100m_deg",
                                "unit": "deg",
                                "label": "direction",
                            },
                            {"column": "air_density_kg_m3", "unit": "mixed", "label": "secondary"},
                            {"column": "temperature_2m_c", "unit": "mixed", "label": "secondary"},
                            {"column": "dew_point_2m_c", "unit": "mixed", "label": "secondary"},
                            {"column": "cloud_cover_pct", "unit": "mixed", "label": "secondary"},
                            {
                                "column": "cloud_cover_low_pct",
                                "unit": "mixed",
                                "label": "secondary",
                            },
                            {
                                "column": "cloud_cover_mid_pct",
                                "unit": "mixed",
                                "label": "secondary",
                            },
                            {
                                "column": "cloud_cover_high_pct",
                                "unit": "mixed",
                                "label": "secondary",
                            },
                            {"column": "precipitation_mm", "unit": "mixed", "label": "secondary"},
                            {
                                "column": "surface_pressure_hpa",
                                "unit": "mixed",
                                "label": "secondary",
                            },
                        ],
                        "dims": [{"column": "location", "role": "series", "cardinality": 12}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "80/120/180 m columns in the schema are absent from the "
                            "archive relation (all-null on ERA5, sources.yaml comment)",
                            "ERA5 lag ~5 days",
                        ],
                    },
                    {
                        "id": "forecast_wind",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_open_meteo_forecast_wind",
                        "latest_relation": "silver_open_meteo_forecast_wind_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "wind_speed_10m_mps",
                                "unit": "m/s",
                                "label": "forecast wind speed by height (forecast API "
                                "serves all heights)",
                            },
                            {
                                "column": "wind_speed_80m_mps",
                                "unit": "m/s",
                                "label": "forecast wind speed by height (forecast API "
                                "serves all heights)",
                            },
                            {
                                "column": "wind_speed_100m_mps",
                                "unit": "m/s",
                                "label": "forecast wind speed by height (forecast API "
                                "serves all heights)",
                            },
                            {
                                "column": "wind_speed_120m_mps",
                                "unit": "m/s",
                                "label": "forecast wind speed by height (forecast API "
                                "serves all heights)",
                            },
                            {
                                "column": "wind_speed_180m_mps",
                                "unit": "m/s",
                                "label": "forecast wind speed by height (forecast API "
                                "serves all heights)",
                            },
                            {"column": "wind_gusts_10m_mps", "unit": "m/s", "label": "gusts"},
                        ],
                        "dims": [{"column": "location", "role": "series", "cardinality": 12}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "vintages overwritten; a past-dated fetch is a hindcast",
                            "32 columns measured (includes the 80/120/180 m heights).",
                        ],
                    },
                ],
            },
            {
                "slug": "weather-at-solar-sites",
                "label": "Weather at solar sites",
                "kind": "series",
                "page": "build",
                "route": "/sources/open_meteo/weather-at-solar-sites",
                "notes": [],
                "datasets": [
                    {
                        "id": "historical_solar",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_open_meteo_historical_solar",
                        "latest_relation": "silver_open_meteo_historical_solar_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "global_tilted_irradiance_wm2",
                                "unit": "W/m2",
                                "label": "GTI on a 35 deg due-south UK fixed tilt",
                            },
                            {"column": "shortwave_radiation_wm2", "unit": "W/m2", "label": "GHI"},
                            {
                                "column": "direct_radiation_wm2",
                                "unit": "W/m2",
                                "label": "beam, DNI, DHI",
                            },
                            {
                                "column": "direct_normal_irradiance_wm2",
                                "unit": "W/m2",
                                "label": "beam, DNI, DHI",
                            },
                            {
                                "column": "diffuse_radiation_wm2",
                                "unit": "W/m2",
                                "label": "beam, DNI, DHI",
                            },
                            {"column": "cloud_cover_pct", "unit": "mixed", "label": "secondary"},
                            {
                                "column": "cloud_cover_low_pct",
                                "unit": "mixed",
                                "label": "secondary",
                            },
                            {
                                "column": "cloud_cover_mid_pct",
                                "unit": "mixed",
                                "label": "secondary",
                            },
                            {
                                "column": "cloud_cover_high_pct",
                                "unit": "mixed",
                                "label": "secondary",
                            },
                            {"column": "temperature_2m_c", "unit": "mixed", "label": "secondary"},
                            {"column": "snowfall_cm", "unit": "mixed", "label": "secondary"},
                            {"column": "snow_depth_m", "unit": "mixed", "label": "secondary"},
                        ],
                        "dims": [{"column": "location", "role": "series", "cardinality": 6}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["ERA5 lag ~5 days"],
                    },
                    {
                        "id": "forecast_solar",
                        "schedule": "hourly",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_open_meteo_forecast_solar",
                        "latest_relation": "silver_open_meteo_forecast_solar_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1h", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "available_at"},
                        "values": [
                            {
                                "column": "global_tilted_irradiance_wm2",
                                "unit": "W/m2",
                                "label": "forecast GTI",
                            },
                            {
                                "column": "shortwave_radiation_wm2",
                                "unit": "W/m2",
                                "label": "forecast GHI",
                            },
                        ],
                        "dims": [{"column": "location", "role": "series", "cardinality": 6}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["vintages overwritten; a past-dated fetch is a hindcast"],
                    },
                ],
            },
        ],
    },
    {
        "key": "gold",
        "name": "Gridflow gold",
        "domain": "Electricity",
        "host": "local",
        "blurb": "Derived datasets and model outputs held in the local Gridflow catalogue.",
        "layer": "gold",
        "families": [
            {
                "slug": "power-stack-clearing",
                "label": "Power stack clearing",
                "kind": "series",
                "page": "build",
                "route": "/sources/gold/power-stack-clearing",
                "notes": [],
                "datasets": [
                    {
                        "id": "gold_stack_clearing",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "gold_stack_clearing",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {
                            "column": "event_time",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "settlement_date"},
                        "values": [
                            {
                                "column": "clearing_price_gbp_per_mwh",
                                "unit": "GBP/MWh",
                                "label": "modelled SMP: the marginal cost where the "
                                "merit-order stack meets clearing demand",
                            },
                            {
                                "column": "clearing_demand_mw",
                                "unit": "MW",
                                "label": "demand the stack clears against (= residual "
                                "demand's clearing demand mw)",
                            },
                            {
                                "column": "total_available_capacity_mw",
                                "unit": "MW",
                                "label": "priced stack capacity available in the period",
                            },
                            {
                                "column": "price_floor_gbp_per_mwh",
                                "unit": "GBP/MWh",
                                "label": "configured price floor",
                            },
                            {
                                "column": "floor_binding",
                                "unit": "bool",
                                "label": "true when the floor set the price",
                            },
                        ],
                        "dims": [
                            {"column": "vintage_policy_id", "role": "filter", "cardinality": 4},
                            {"column": "marginal_fuel_type", "role": "series", "cardinality": 4},
                            {"column": "price_mechanism", "role": "filter", "cardinality": 2},
                            {"column": "marginal_bm_unit_id", "role": "filter", "cardinality": 91},
                            {"column": "run_id", "role": "filter", "cardinality": 28},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": {
                            "column": "vintage_policy_id",
                            "equals": "smp_headline_perfect_prog_v2",
                        },
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "measured P1-3: 36,672 rows = 18,336 (event_time, as_of) "
                            "keys x 2; v1 (schema_version 1) and v2 (schema_version 2) "
                            "coexist for the same periods",
                            "v1 rows have price_mechanism null (50% of the table)",
                            "marginal_bm_unit_id/marginal_fuel_type null when the "
                            "floor binds (1,355 per policy pair, 3.7%)",
                            "perfect-prognosis: built from realised "
                            "INDO/FUELHH/hist-gen-mix/BMUNITS (ADR-062), so it is a "
                            "diagnostic, not a forecast",
                            "every row has a unique stack_artifact_hash, plus "
                            "lineage_* version/policy columns naming the silver inputs",
                            "SMP backtest windows are INCLUSIVE settlement dates "
                            "(GM/cli.py:146), so the runbook's --end 2026-09-22 "
                            "convention does not apply: use 14 → 20. It needs silver "
                            "for the week first: elexon indo (local ends 4 Sep), "
                            "fuelhh (ends 16 Sep), bmunits_reference, and "
                            "neso_data_portal historic_generation_mix (ends 5 Sep). "
                            "Unknown: whether ADR-062's realised-read contract "
                            '("exact configured partition", latest_only) accepts the '
                            "newly landed silver, and which vintage_policy_id a new "
                            "run publishes under. Settle both with a run without "
                            "--publish. verify_published_stack (hard-codes 816) runs "
                            "only from ladder_receipts.py:520, not from --publish. "
                            "This is the Explorer's objective relation: bespoke, W1.",
                            "The v2 headline stack uses perfect prognosis; it is not a "
                            "live forecast.",
                            "Suggested view: vintage_policy_id = "
                            "'smp_headline_perfect_prog_v2' (816 periods, 18 Aug–3 Sep "
                            "2026); alternate smp_diagnostic_perfect_prog_v2 (13 "
                            "disjoint monthly runs, 5 May 2025–4 May 2026, 17,520 "
                            "periods); hide *_v1",
                        ],
                    },
                    {
                        "id": "gold_stack_residual_demand",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "gold_stack_residual_demand",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {
                            "column": "event_time",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "settlement_date"},
                        "values": [
                            {
                                "column": "indo_mw",
                                "unit": "MW",
                                "label": "Elexon initial national demand outturn used",
                            },
                            {
                                "column": "wind_mw",
                                "unit": "MW",
                                "label": "wind output netted off demand",
                            },
                            {
                                "column": "solar_mw",
                                "unit": "MW",
                                "label": "solar output netted off demand",
                            },
                            {
                                "column": "netted_INTELEC_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTEW_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTFR_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTGRNL_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTIFA2_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTIRL_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTNED_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTNEM_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTNSL_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_INTVKL_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_NPSHYD_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_OTHER_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "netted_PS_mw",
                                "unit": "MW",
                                "label": "signed FUELHH categories netted outside the "
                                "priced stack (interconnectors, non-PS hydro, "
                                "other, pumped storage)",
                            },
                            {
                                "column": "residual_demand_mw",
                                "unit": "MW",
                                "label": "demand left for the priced stack",
                            },
                            {
                                "column": "clearing_demand_mw",
                                "unit": "MW",
                                "label": "demand the stack clears against",
                            },
                        ],
                        "dims": [
                            {"column": "vintage_policy_id", "role": "filter", "cardinality": 4}
                        ],
                        "default_filter": {
                            "column": "vintage_policy_id",
                            "equals": "smp_headline_perfect_prog_v2",
                        },
                        "dedup": None,
                        "row_filter": {
                            "column": "vintage_policy_id",
                            "equals": "smp_headline_perfect_prog_v2",
                        },
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "same v1/v2 duplication as clearing",
                            "no nulls (measured P1-3)",
                            "the exact netting formula lives in gridflow_models core; "
                            "not re-derived here",
                            "Written by the same run as clearing; the key set equals "
                            "clearing's (publish_receipts.py:99).",
                            "The v2 headline stack uses perfect prognosis; it is not a "
                            "live forecast.",
                        ],
                    },
                    {
                        "id": "gold_stack_supply_curve_points",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "gold_stack_supply_curve_points",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {
                            "column": "event_time",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "settlement_date"},
                        "values": [
                            {
                                "column": "marginal_cost_gbp_per_mwh",
                                "unit": "GBP/MWh",
                                "label": "the unit's modelled marginal cost",
                            },
                            {
                                "column": "available_capacity_mw",
                                "unit": "MW",
                                "label": "the unit's available capacity in the period",
                            },
                            {
                                "column": "cumulative_capacity_mw",
                                "unit": "MW",
                                "label": "running capacity through the merit order",
                            },
                            {
                                "column": "merit_order_rank",
                                "unit": "rank",
                                "label": "position in the merit order",
                            },
                            {
                                "column": "cost_provenance",
                                "unit": "json",
                                "label": "which assumption fed each cost term (e.g. "
                                "carbon intensity)",
                            },
                        ],
                        "dims": [
                            {"column": "bm_unit_id", "role": "filter", "cardinality": 110},
                            {"column": "fuel_type", "role": "series", "cardinality": 5},
                            {"column": "vintage_policy_id", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": {
                            "column": "vintage_policy_id",
                            "equals": "smp_headline_perfect_prog_v2",
                        },
                        "snapshot_column": None,
                        "volume_class": "medium",
                        "notes": [
                            "only the two headline runs carry points (v1 88,542 rows; "
                            "v2 87,678); diagnostic runs have none",
                            "cost_provenance null on every v1 row (50.25%)",
                            "fuel types: CCGT 60, OCGT 20, BIOMASS 12, NUCLEAR 12, COAL 6 units",
                            "Whether a new headline-policy run writes points (the "
                            "diagnostic runs did not) is unknown; check the stack "
                            "config before relying on it.",
                            "The v2 headline stack uses perfect prognosis; it is not a "
                            "live forecast.",
                            "Suggested view: vintage_policy_id = "
                            "'smp_headline_perfect_prog_v2' AND one (event_time) "
                            "selected by the user (~107 points per period)",
                        ],
                    },
                ],
            },
            {
                "slug": "demand-forecasts",
                "label": "Demand forecasts",
                "kind": "series",
                "page": "external",
                "route": "/forecasts",
                "notes": [],
                "datasets": [
                    {
                        "id": "gold_forecasts",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "gold_forecasts",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {
                            "column": "delivery_time",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "issued_at"},
                        "values": [
                            {
                                "column": "q_0.05",
                                "unit": "MW",
                                "label": "quantile forecasts of GB demand (Elexon INDO "
                                "initial demand outturn mw)",
                            },
                            {
                                "column": "q_0.1",
                                "unit": "MW",
                                "label": "quantile forecasts of GB demand (Elexon INDO "
                                "initial demand outturn mw)",
                            },
                            {
                                "column": "q_0.25",
                                "unit": "MW",
                                "label": "quantile forecasts of GB demand (Elexon INDO "
                                "initial demand outturn mw)",
                            },
                            {
                                "column": "q_0.5",
                                "unit": "MW",
                                "label": "quantile forecasts of GB demand (Elexon INDO "
                                "initial demand outturn mw)",
                            },
                            {
                                "column": "q_0.75",
                                "unit": "MW",
                                "label": "quantile forecasts of GB demand (Elexon INDO "
                                "initial demand outturn mw)",
                            },
                            {
                                "column": "q_0.9",
                                "unit": "MW",
                                "label": "quantile forecasts of GB demand (Elexon INDO "
                                "initial demand outturn mw)",
                            },
                            {
                                "column": "q_0.95",
                                "unit": "MW",
                                "label": "quantile forecasts of GB demand (Elexon INDO "
                                "initial demand outturn mw)",
                            },
                            {
                                "column": "actual",
                                "unit": "MW",
                                "label": "realised INDO for the delivery period",
                            },
                        ],
                        "dims": [
                            {"column": "model_id", "role": "series", "cardinality": None},
                            {"column": "vintage_policy_id", "role": "series", "cardinality": None},
                            {"column": "run_id", "role": "filter", "cardinality": 6},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": [
                                "model_id",
                                "vintage_kind",
                                "vintage_policy_id",
                                "issued_at",
                                "delivery_time",
                            ],
                            "order_by": [
                                {"column": "written_at", "direction": "desc", "nulls": "last"},
                                {"column": "run_id", "direction": "desc", "nulls": "last"},
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "the raw view applies no supersession: re-issues coexist "
                            "with current rows",
                            "variants measured: v1 rolling_23h30m (2 runs, "
                            "2022-01-31→2026-08-22), v1 day_anchored_noon_d1 (2 runs), "
                            "v2 perfect_prog_day_anchored_noon_d1, v2 live_issue_fixed "
                            "(72 rows, 5–6 Sep 2026 only)",
                            "actual null on 0.09% of rows",
                            "Unknown: a historical as-of issue reads silver under "
                            "available_at <= as_of, but silver backfilled in P2 "
                            "carries available_at later than the as-of "
                            '(gold_gb_day_ahead_benchmark.sql comment: "A historical '
                            "available_at <= as_of cutoff returns no backfilled rows "
                            'ingested after as_of"). An as-issued week is therefore '
                            "probably unrecoverable. Settle with a predict run without "
                            "--publish. The page already exists; wrap it in the new "
                            "shell (OQ-2).",
                            "Suggested view: one (model_id, vintage_policy_id) "
                            "variant, rows resolved by the supersession rule in "
                            "backend/app/forecasts.py:143-150",
                        ],
                    },
                    {
                        "id": "gold_forecast_metrics",
                        "schedule": None,
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "gold_forecast_metrics",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {"column": "written_at", "grain": "none", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "metric_value",
                                "unit": "metric-specific (MW for pinball/CRPS, ratio for "
                                "coverage/crossing)",
                                "label": "score or gate value per run/fold",
                            }
                        ],
                        "dims": [
                            {"column": "metric_name", "role": "series", "cardinality": 12},
                            {"column": "model_slug", "role": "filter", "cardinality": 2},
                            {"column": "run_id", "role": "filter", "cardinality": 5},
                            {"column": "fold", "role": "filter", "cardinality": 12},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "gate_* columns null on the 96% of rows that are fold "
                            "scores (only run-scope gate rows fill them)",
                            "375 rows; written between 25 and 30 Aug 2026.",
                        ],
                    },
                ],
            },
            {
                "slug": "system-prices-joined-with-carbon-intensity",
                "label": "System prices joined with carbon intensity",
                "kind": "series",
                "page": "build",
                "route": "/sources/gold/system-prices-joined-with-carbon-intensity",
                "notes": [],
                "datasets": [
                    {
                        "id": "gold_uk_imbalance_context",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "gold_uk_imbalance_context",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "system_sell_price",
                                "unit": "GBP/MWh",
                                "label": "SSP/SBP from silver elexon system prices latest",
                            },
                            {
                                "column": "system_buy_price",
                                "unit": "GBP/MWh",
                                "label": "SSP/SBP from silver elexon system prices latest",
                            },
                            {"column": "net_imbalance_volume", "unit": "MWh", "label": "NIV"},
                            {
                                "column": "carbon_intensity_forecast_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "NESO national forecast intensity",
                            },
                            {
                                "column": "carbon_intensity_actual_gco2_kwh",
                                "unit": "gCO2/kWh",
                                "label": "realised intensity, ex-post (leakage warning "
                                "in the view)",
                            },
                        ],
                        "dims": [
                            {"column": "price_derivation_code", "role": "filter", "cardinality": 3}
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "measured P1-3: carbon columns 99.73% null; non-null only "
                            "2026-07-31T23:30Z–2026-08-05T23:30Z (241 rows) because "
                            "silver_neso_carbon_intensity holds 6 days",
                            "one row per (settlement_date, settlement_period) "
                            "(measured 88,456 = 88,456 keys)",
                            "A view, so no rebuild is needed. System prices already "
                            "reach 21 Sep; the carbon_intensity backfill fills the CI "
                            "columns for the week.",
                        ],
                    }
                ],
            },
            {
                "slug": "gb-day-ahead-benchmark-from-the-market-index-price",
                "label": "GB day-ahead benchmark from the market index price",
                "kind": "series",
                "page": "build",
                "route": "/sources/gold/gb-day-ahead-benchmark-from-the-market-index-price",
                "notes": [],
                "datasets": [
                    {
                        "id": "gold_gb_day_ahead_benchmark",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "gold_gb_day_ahead_benchmark",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "benchmark_price_gbp_mwh",
                                "unit": "GBP/MWh",
                                "label": "Elexon MID APXMIDP price",
                            },
                            {
                                "column": "benchmark_volume_mwh",
                                "unit": "MWh",
                                "label": "APXMIDP volume",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "one row per SP via QUALIFY on available_at",
                            "available_at is the ingest clock (MID has no publishTime)",
                            "A view over silver_elexon_mid (carded by P1-1). The "
                            "stack's benchmark per ADR-065.",
                        ],
                    }
                ],
            },
            {
                "slug": "gas-storage-by-country",
                "label": "Gas storage by country",
                "kind": "series",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "gold_eu_gas_storage",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "gold_eu_gas_storage",
                        "latest_relation": None,
                        "not_held_cause": None,
                        "clock": {"column": "gas_day", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "gas_day"},
                        "values": [
                            {
                                "column": "gas_in_storage_gwh",
                                "unit": "GWh",
                                "label": "gas in storage",
                            },
                            {"column": "injection_gwh", "unit": "GWh", "label": "daily flows"},
                            {"column": "withdrawal_gwh", "unit": "GWh", "label": "daily flows"},
                            {
                                "column": "working_gas_volume_gwh",
                                "unit": "GWh",
                                "label": "capacity",
                            },
                            {"column": "storage_pct_full", "unit": "%", "label": "fullness"},
                        ],
                        "dims": [{"column": "country_code", "role": "series", "cardinality": 9}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "measured P1-3: GB rows (5 of 45) have every value null",
                            "A column projection of silver_gie_agsi_storage (P1-4). No "
                            "separate page.",
                        ],
                    }
                ],
            },
            {
                "slug": "system-prices-with-spread-and-calendar-features",
                "label": "System prices with spread and calendar features",
                "kind": "series",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "system_marginal_price",
                        "schedule": None,
                        "kind": "series",
                        "verdict": "not-held",
                        "base_relation": None,
                        "latest_relation": None,
                        "not_held_cause": "never-fetched: builder registered "
                        "(GF/gold/system_marginal_price.py:71) but never "
                        "built; no "
                        "C:/gridflow-data/gold/system_marginal_price dir, "
                        "so no gold_system_marginal_price view "
                        "(GF/storage/duckdb.py:203-207)",
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "30min",
                            "settlement_cols": ["settlement_date", "settlement_period"],
                        },
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "system_buy_price",
                                "unit": "GBP/MWh",
                                "label": "latest-vintage system prices",
                            },
                            {
                                "column": "system_sell_price",
                                "unit": "GBP/MWh",
                                "label": "latest-vintage system prices",
                            },
                            {"column": "spread", "unit": "GBP/MWh", "label": "SBP - SSP"},
                            {"column": "abs_imbalance", "unit": "MWh", "label": "|NIV|"},
                            {
                                "column": "hour_of_day",
                                "unit": "calendar",
                                "label": "ISO weekday 1=Mon (differs from gridflow models' 0=Mon)",
                            },
                            {
                                "column": "day_of_week",
                                "unit": "calendar",
                                "label": "ISO weekday 1=Mon (differs from gridflow models' 0=Mon)",
                            },
                        ],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Enum stretched: 'never-built' is the literal cause. It "
                            "largely duplicates gold_uk_imbalance_context plus two "
                            "derived columns. Recommend not building a page."
                        ],
                    }
                ],
            },
        ],
    },
    {
        "key": "entsog",
        "name": "ENTSO-G Transparency",
        "domain": "Gas",
        "host": "transparency.entsog.eu/api/v1",
        "blurb": "The European gas transparency platform: flows, nominations, capacity and gas quality "
        "at network points.",
        "layer": "silver",
        "families": [
            {
                "slug": "physical-flows",
                "label": "Physical flows",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsog/physical-flows",
                "notes": [],
                "datasets": [
                    {
                        "id": "physical_flows",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_physical_flows",
                        "latest_relation": "silver_entsog_physical_flows_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "flow_gwh_per_day",
                                "unit": "GWh/d",
                                "label": "physical gas flow per operator-point-direction "
                                "and gas day, normalised from vendor kWh/d etc. "
                                "in silver",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 48},
                            {"column": "point_key", "role": "series", "cardinality": 620},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Full-Europe fetch (connector omits pointDirection for "
                            "this dataset): 986 operator-point-directions, 27 operator "
                            "countries",
                            "flow_gwh_per_day null on 18% of rows (893/4926)",
                            "timestamp_utc hours scatter by operator: 04:00 UTC (4351 "
                            "rows), 02/03/05 and 21/22/23 UTC; the 21-23 UTC rows "
                            "belong to the next gas day, so a UTC-date cast misassigns "
                            "them (population file's 2026-07-31 start is this "
                            "artefact: 12 rows)",
                            "flow_status (Provisional/Confirmed) is dropped by the "
                            "silver transformer; dedup keeps the last row per "
                            "(timestamp_utc, point, operator, direction), so revisions "
                            "are invisible",
                            "The gas-day label is not exposed as a column; P3 must "
                            "take it from gridflow (partition day) or show "
                            "timestamp_utc in UK time",
                            "Vault silver sample shows unit 'kWh/d' next to a GWh "
                            "value and says flow_gwh_per_day is non-null default 0.0; "
                            "the code (VTA-ENTSOG-UNITLABEL-01) and the relation hold "
                            "unit 'GWh/d' and nulls. Vault is stale. Relevance medium: "
                            "GB import/export at Bacton and Moffat is a gas-supply "
                            "signal behind CCGT fuel cost, one step removed from the "
                            "power stack.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                            "Suggested view: GB points only: operator_key LIKE 'UK-%' "
                            "(179 operator-point-directions) or the 9 "
                            "DEFAULT_POINT_DIRECTIONS (Bacton IUK/BBL, "
                            "Julianadorp/Balgzand BBL, Moffat IE/GB)",
                        ],
                    },
                    {
                        "id": "aggregated_physical_flows",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_aggregated_physical_flows",
                        "latest_relation": "silver_entsog_aggregated_physical_flows_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "UK balancing-zone entry flow by adjacent system type",
                            }
                        ],
                        "dims": [
                            {"column": "adjacent_systems_key", "role": "series", "cardinality": 3},
                            {"column": "direction_key", "role": "filter", "cardinality": 1},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Only 3 of the 5 configured "
                            "DEFAULT_AGGREGATED_POINT_DIRECTIONS return rows: UK entry "
                            "from Storage, LNG Terminals, Production (the two UK-NI "
                            "rows are absent)",
                            "value in vendor kWh/d; generic transformer does not normalise units",
                            "Relevance medium: GB supply mix (UKCS production vs LNG "
                            "vs storage) is the GB gas-balance picture.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                ],
            },
            {
                "slug": "nominations-and-allocations",
                "label": "Nominations and allocations",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsog/nominations-and-allocations",
                "notes": [],
                "datasets": [
                    {
                        "id": "nominations",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_nominations",
                        "latest_relation": "silver_entsog_nominations_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "nominated quantity per "
                                "operator-point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 3},
                            {"column": "point_key", "role": "series", "cardinality": 4},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 29% of rows (Moffat IE exit and GB Moffat "
                            "entry are all-null: reverse-direction virtual points)",
                            "Scope is the 9 DEFAULT_POINT_DIRECTIONS; 7 return rows",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "renominations",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_renominations",
                        "latest_relation": "silver_entsog_renominations_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "renominated quantity per "
                                "operator-point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 3},
                            {"column": "point_key", "role": "series", "cardinality": 4},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 14% of rows",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "allocations",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_allocations",
                        "latest_relation": "silver_entsog_allocations_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "allocated quantity per "
                                "operator-point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 3},
                            {"column": "point_key", "role": "series", "cardinality": 4},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 43% of rows",
                            "timestamp_utc at 03:00 and 04:00 UTC depending on "
                            "operator (10 distinct values over 5 days)",
                            "Allocations publish after the gas day; the latest day may "
                            "lag nominations.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                ],
            },
            {
                "slug": "firm-and-interruptible-capacity",
                "label": "Firm and interruptible capacity",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsog/firm-and-interruptible-capacity",
                "notes": [],
                "datasets": [
                    {
                        "id": "firm_available",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_firm_available",
                        "latest_relation": "silver_entsog_firm_available_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "firm capacity still available per "
                                "point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 3},
                            {"column": "point_key", "role": "series", "cardinality": 4},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 68% of rows (15/22); only Moffat IE entry "
                            "(5 days) and Bacton IUK entry (2 days) carry numbers",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "firm_booked",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_firm_booked",
                        "latest_relation": "silver_entsog_firm_booked_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "firm capacity booked per point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 3},
                            {"column": "point_key", "role": "series", "cardinality": 4},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 68% of rows (15/22)",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "firm_technical",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_firm_technical",
                        "latest_relation": "silver_entsog_firm_technical_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "firm technical capacity per point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 2},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 100% of rows (10/10): only the two "
                            "reverse-direction virtual points return (Moffat entry, "
                            "Bacton BBL exit; item_remarks 'Virtual Point, currently "
                            "... Unidirectional')",
                            "A chart of the local sample is empty",
                            "Verdict kept at chart for the family page; re-check after "
                            "P2. If still all-null it is a table-only row.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "interruptible_available",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_interruptible_available",
                        "latest_relation": "silver_entsog_interruptible_available_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "interruptible capacity available",
                            }
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 2},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 71% of rows (5/7); 2 numbers in 5 days",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "interruptible_booked",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_interruptible_booked",
                        "latest_relation": "silver_entsog_interruptible_booked_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "interruptible capacity booked",
                            }
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 1},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 83% of rows (5/6); 1 number in 5 days",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "interruptible_total",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_interruptible_total",
                        "latest_relation": "silver_entsog_interruptible_total_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/d",
                                "label": "interruptible capacity total",
                            }
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 2},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 71% of rows (5/7)",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                ],
            },
            {
                "slug": "released-capacity",
                "label": "Released capacity",
                "kind": "series",
                "page": "table-only",
                "route": "/sources/entsog/released-capacity",
                "notes": [],
                "datasets": [
                    {
                        "id": "available_through_oversubscription",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "events-table",
                        "base_relation": "silver_entsog_available_through_oversubscription",
                        "latest_relation": "silver_entsog_available_through_oversubscription_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "default_sentence",
                                "unit": "text",
                                "label": "vendor statement that no capacity was released "
                                "through this mechanism",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "filter", "cardinality": 4},
                            {"column": "point_key", "role": "series", "cardinality": 5},
                            {"column": "direction_key", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 100% of rows (55/55); unit and period_type "
                            "empty strings; is_default_sentence true on every row",
                            "population file's 31 Jul - 4 Aug window is the 22:00 UTC "
                            "clock; the gas days are 1-5 Aug",
                            "Key shape is a daily series, so kind stays series; the "
                            "verdict departs because there is no number to plot. Same "
                            "for the other three released-capacity ids.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "available_through_surrender",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "events-table",
                        "base_relation": "silver_entsog_available_through_surrender",
                        "latest_relation": "silver_entsog_available_through_surrender_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "default_sentence",
                                "unit": "text",
                                "label": "'Currently no capacity has been made available "
                                "on this point through ... "
                                "congestion-management procedures'",
                            }
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 5},
                            {"column": "direction_key", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 100% of rows (55/55); every row is the default sentence",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "available_through_uioli_long_term",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "events-table",
                        "base_relation": "silver_entsog_available_through_uioli_long_term",
                        "latest_relation": "silver_entsog_available_through_uioli_long_term_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "default_sentence",
                                "unit": "text",
                                "label": "vendor statement, no numeric release",
                            }
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 5},
                            {"column": "direction_key", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 100% of rows (55/55)",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "available_through_uioli_short_term",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "events-table",
                        "base_relation": "silver_entsog_available_through_uioli_short_term",
                        "latest_relation": "silver_entsog_available_through_uioli_short_term_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "default_sentence",
                                "unit": "text",
                                "label": "vendor statement, no numeric release",
                            }
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 5},
                            {"column": "direction_key", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 100% of rows (55/55)",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                ],
            },
            {
                "slug": "gas-quality",
                "label": "Gas quality",
                "kind": "series",
                "page": "build",
                "route": "/sources/entsog/gas-quality",
                "notes": [],
                "datasets": [
                    {
                        "id": "gcv",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_gcv",
                        "latest_relation": "silver_entsog_gcv_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/Nm3",
                                "label": "gross calorific value per point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 4},
                            {"column": "point_key", "role": "series", "cardinality": 4},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 43% of rows; Bacton IUK exit "
                            "(Interconnector) reports 0.0, which reads as no-flow "
                            "rather than a GCV",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "wobbe_index",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_wobbe_index",
                        "latest_relation": "silver_entsog_wobbe_index_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "value",
                                "unit": "kWh/Nm3",
                                "label": "Wobbe index per point-direction and gas day",
                            }
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "series", "cardinality": 4},
                            {"column": "point_key", "role": "series", "cardinality": 5},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "value null on 78% of rows (35/45)",
                            "three clock hours (02:00/03:00/04:00 UTC): 15 distinct "
                            "timestamps in 5 days",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "methane_content",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_methane_content",
                        "latest_relation": "silver_entsog_methane_content_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {"column": "value", "unit": "% (mol/mol)", "label": "methane content"}
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 2},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "no nulls",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "hydrogen_content",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_hydrogen_content",
                        "latest_relation": "silver_entsog_hydrogen_content_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {"column": "value", "unit": "% (mol/mol)", "label": "hydrogen content"}
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 1},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "no nulls; 2 distinct values",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "oxygen_content",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_entsog_oxygen_content",
                        "latest_relation": "silver_entsog_oxygen_content_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {"column": "value", "unit": "% (mol/mol)", "label": "oxygen content"}
                        ],
                        "dims": [
                            {"column": "point_key", "role": "series", "cardinality": 1},
                            {"column": "direction_key", "role": "series", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "no nulls; 1 distinct value (flat line)",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                ],
            },
            {
                "slug": "congestion-management",
                "label": "Congestion management",
                "kind": "events",
                "page": "table-only",
                "route": "/sources/entsog/congestion-management",
                "notes": [],
                "datasets": [
                    {
                        "id": "cmp_unsuccessful_requests",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_entsog_cmp_unsuccessful_requests",
                        "latest_relation": "silver_entsog_cmp_unsuccessful_requests_latest",
                        "not_held_cause": None,
                        "clock": {"column": "capacity_from", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "capacity_from"},
                        "values": [
                            {
                                "column": "general_remarks",
                                "unit": "text",
                                "label": "per-point CMP statement",
                            },
                            {
                                "column": "requested_volume",
                                "unit": None,
                                "label": "requested firm capacity; non-null on 2 of 5197 rows",
                            },
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "filter", "cardinality": 50},
                            {"column": "point_key", "role": "filter", "cardinality": 670},
                            {"column": "direction_key", "role": "filter", "cardinality": 3},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["id"],
                            "order_by": [
                                {"column": "available_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "KNOWN SILVER BUG (unmerged gridflow branch "
                            "fix/silver-entsog-cmp-timestamp, commit 0b577dc): "
                            "timestamp_utc, period_from and event_time null on "
                            "5197/5197 rows; the fix coalesces _TIMESTAMP_PRIORITY "
                            "row-wise so capacityFrom dates the row. Do not merge from "
                            "here",
                            "Population file reports None/None/0 days; the window "
                            "above is capacity_from (22:00 UTC stamps, i.e. gas days "
                            "1-5 Aug)",
                            "Boilerplate: 4365 of 5197 rows carry 'no request ... that "
                            "weren't successfully fulfilled'; only ~1041 distinct ids, "
                            "the same statement is re-stored every partition day",
                            "direction_key mixes 'entry'/'Entry'/'exit' (vault: CMP "
                            "family capitalises); compare case-insensitively",
                            "requested/allocated/unallocated_volume units unknown "
                            "(unit column is '' or kWh/d); settle from the ENTSO-G API "
                            "manual",
                            "Page note required per RUNBOOK section 8.",
                            "Unit unconfirmed for requested_volume; research did not "
                            "establish a reliable unit.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                            "Suggested view: operator_key LIKE 'UK-%' or non-default remarks only",
                        ],
                    },
                    {
                        "id": "cmp_auction_premiums",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_entsog_cmp_auction_premiums",
                        "latest_relation": "silver_entsog_cmp_auction_premiums_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "general_remarks",
                                "unit": "text",
                                "label": "per-point statement",
                            },
                            {
                                "column": "auction_premium",
                                "unit": None,
                                "label": "auction premium; null on 100% of rows",
                            },
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "filter", "cardinality": 47},
                            {"column": "point_key", "role": "filter", "cardinality": 654},
                            {"column": "booking_platform_key", "role": "filter", "cardinality": 4},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "auction_premium, cleared_price, reserve_price, "
                            "auction_from, auction_to and value all null on 5035/5035 "
                            "rows",
                            "4270 rows are 'no firm capacity products ... cleared with "
                            "an auction premium'",
                            "1007 distinct ids re-stored each day",
                            "Unit unconfirmed for auction_premium; research did not "
                            "establish a reliable unit.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                            "Suggested view: operator_key LIKE 'UK-%' or non-default remarks only",
                        ],
                    },
                ],
            },
            {
                "slug": "unavailable-firm-capacity",
                "label": "Unavailable firm capacity",
                "kind": "events",
                "page": "table-only",
                "route": "/sources/entsog/unavailable-firm-capacity",
                "notes": [],
                "datasets": [
                    {
                        "id": "cmp_unavailable_firm_capacity",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_entsog_cmp_unavailable_firm_capacity",
                        "latest_relation": "silver_entsog_cmp_unavailable_firm_capacity_latest",
                        "not_held_cause": None,
                        "clock": {"column": "timestamp_utc", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "timestamp_utc"},
                        "values": [
                            {
                                "column": "general_remarks",
                                "unit": "text",
                                "label": "per-point CMP statement",
                            },
                            {
                                "column": "allocation_process",
                                "unit": "text",
                                "label": "'Auction' or empty",
                            },
                        ],
                        "dims": [
                            {"column": "operator_key", "role": "filter", "cardinality": 30},
                            {"column": "point_key", "role": "filter", "cardinality": 367},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "No numeric capacity column exists in silver; value null "
                            "on 100% of rows",
                            "2460 of 2920 rows are 'firm products ... offered in the "
                            "regular allocation process'",
                            "604 distinct ids re-stored each day",
                            "Catalogue says reference (commit ba3bac9); the silver "
                            "shape is identical to cmp_auction_premiums (dated per "
                            "point-day, id-keyed), so events.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                            "Suggested view: operator_key LIKE 'UK-%' or non-default remarks only",
                        ],
                    }
                ],
            },
            {
                "slug": "interruptions-and-urgent-market-messages",
                "label": "Interruptions and urgent market messages",
                "kind": "events",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "interruptions",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_interruptions",
                        "latest_relation": None,
                        "not_held_cause": "fetched-empty",
                        "clock": {"column": "unknown", "grain": "event", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "unknown"},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "fetched-empty is outside the RUNBOOK cause list "
                            "(never-fetched | no-transformer | folded-into | "
                            "current-only); none of those is true. Transformer exists "
                            "(generic registration). A wider window would need a "
                            "connector change in gridflow.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                    {
                        "id": "urgent_market_messages",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_urgent_market_messages",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": "unknown", "grain": "event", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "unknown"},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Transformer exists (generic). Would need isLatestVersion "
                            "handling downstream.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                ],
            },
            {
                "slug": "tariffs",
                "label": "Tariffs",
                "kind": "reference",
                "page": "table-only",
                "route": "/sources/entsog/tariffs",
                "notes": [],
                "datasets": [
                    {
                        "id": "tariffs",
                        "schedule": "monthly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_entsog_tariffs",
                        "latest_relation": "silver_entsog_tariffs_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "product_period_from",
                            "grain": "product",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "applicable_tariff_per_eurk_wh_d_value",
                                "unit": "per the paired _unit column (EUR per kWh/d...)",
                                "label": "applicable tariff",
                            },
                            {
                                "column": "applicable_tariff_in_common_unit_value",
                                "unit": "per applicable_tariff_in_common_unit_unit (2 values)",
                                "label": "tariff in common unit",
                            },
                        ],
                        "dims": [
                            {"column": "country_code", "role": "filter", "cardinality": 21},
                            {"column": "operator", "role": "filter", "cardinality": 37},
                            {"column": "point_key", "role": "filter", "cardinality": 138},
                            {"column": "product_type", "role": "filter", "cardinality": 5},
                        ],
                        "default_filter": None,
                        "dedup": {
                            "keys": ["id"],
                            "order_by": [
                                {"column": "available_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": "available_at",
                        "volume_class": "medium",
                        "notes": [
                            "The full tariff set is re-stored per partition day: 61220 "
                            "rows = 5 x 12244 distinct ids; each daily bronze body is "
                            "the same 29.4 MB",
                            "Config sends countryKey=UK (request_url in the sidecar) "
                            "yet 21 countries come back: the vendor ignores the "
                            "filter, or the parameter is wrong",
                            "Population file's 3 'days' are validity starts, not coverage",
                            "7% of tariff values null; currency varies by operator (8 currencies)",
                            "Vault says the connector defaults to countryKey=UK (true "
                            "of the request) but implies a UK-only result; the "
                            "relation disagrees.",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                            "Suggested view: country_code = 'UK' (1050 of 61220 rows)",
                        ],
                    },
                    {
                        "id": "tariff_simulations",
                        "schedule": "monthly",
                        "kind": "reference",
                        "verdict": "reference-table",
                        "base_relation": "silver_entsog_tariff_simulations",
                        "latest_relation": "silver_entsog_tariff_simulations_latest",
                        "not_held_cause": None,
                        "clock": {
                            "column": "timestamp_utc",
                            "grain": "product",
                            "settlement_cols": [],
                        },
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [
                            {
                                "column": "product_simulation_cost_in_euro",
                                "unit": "EUR (stored as VARCHAR)",
                                "label": "simulated cost of a standard product",
                            }
                        ],
                        "dims": [
                            {"column": "country_code", "role": "filter", "cardinality": 21},
                            {"column": "operator", "role": "filter", "cardinality": 35},
                            {"column": "product_type", "role": "filter", "cardinality": 5},
                        ],
                        "default_filter": {"column": "country_code", "equals": "UK"},
                        "dedup": {
                            "keys": ["id"],
                            "order_by": [
                                {"column": "available_at", "direction": "desc", "nulls": "last"}
                            ],
                        },
                        "row_filter": None,
                        "snapshot_column": "available_at",
                        "volume_class": "medium",
                        "notes": [
                            "13910 rows = 5 x 2782 distinct ids (re-stored per day)",
                            "cost columns are VARCHAR, not numeric (generic "
                            "_looks_numeric misses them)",
                            "UK coverage date of the timestamp can differ from the "
                            "vendor gas-day label.",
                        ],
                    },
                ],
            },
            {
                "slug": "network-topology",
                "label": "Network topology",
                "kind": "reference",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "connection_points",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_connection_points",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Transformer exists (generic registration). Useful as a "
                            "label lookup for point_key on the flow pages."
                        ],
                    },
                    {
                        "id": "operators",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_operators",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["Transformer exists (generic)."],
                    },
                    {
                        "id": "balancing_zones",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_balancing_zones",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["Transformer exists (generic)."],
                    },
                    {
                        "id": "operator_point_directions",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_operator_point_directions",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Transformer exists (generic). Vault: join key for "
                            "country/zone labels on physical_flows."
                        ],
                    },
                    {
                        "id": "interconnections",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_interconnections",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["Transformer exists (generic)."],
                    },
                    {
                        "id": "aggregate_interconnections",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_entsog_aggregate_interconnections",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["Transformer exists (generic)."],
                    },
                ],
            },
        ],
    },
    {
        "key": "gie_agsi",
        "name": "GIE AGSI+",
        "domain": "Gas",
        "host": "agsi.gie.eu",
        "blurb": "Gas storage across Europe: stock, injection, withdrawal and fullness, by country, "
        "company and site.",
        "layer": "silver",
        "families": [
            {
                "slug": "storage-by-country-and-site",
                "label": "Storage by country and site",
                "kind": "series",
                "page": "build",
                "route": "/sources/gie_agsi/storage-by-country-and-site",
                "notes": [],
                "datasets": [
                    {
                        "id": "storage",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_gie_agsi_storage",
                        "latest_relation": "silver_gie_agsi_storage_latest",
                        "not_held_cause": None,
                        "clock": {"column": "gas_day", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "gas_day"},
                        "values": [
                            {
                                "column": "storage_pct_full",
                                "unit": None,
                                "label": "storage fullness",
                            },
                            {
                                "column": "gas_in_storage_gwh",
                                "unit": None,
                                "label": "gas in storage",
                            },
                            {
                                "column": "working_gas_volume_gwh",
                                "unit": None,
                                "label": "working gas volume",
                            },
                            {"column": "injection_gwh", "unit": None, "label": "injection"},
                            {"column": "withdrawal_gwh", "unit": None, "label": "withdrawal"},
                            {
                                "column": "net_withdrawal_gwh",
                                "unit": None,
                                "label": "net withdrawal, signed",
                            },
                        ],
                        "dims": [
                            {"column": "country_code", "role": "series", "cardinality": 9},
                            {"column": "entity_level", "role": "filter", "cardinality": 1},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "UNIT DISAGREEMENT: code (_gwh columns) and vault say GWh, "
                            "but DE working_gas_volume_gwh = 246.5 and "
                            "gas_in_storage_gwh = 116.4 on 3 Aug (47.2% full): that is "
                            "TWh-scale for Germany; injection_gwh 433.7 against "
                            "injection_capacity 4297.7 fits GWh/d. consumption_gwh (DE "
                            "903.9) reads as annual TWh. Settle from the AGSI API "
                            "documentation or /api/about before labelling axes. "
                            "gold_eu_gas_storage (P1-3's group) inherits these columns",
                            "GB: 5/5 rows all-null, status 'N' ('United Kingdom "
                            "(Pre-Brexit)', '-' placeholders per vault); no GB storage "
                            "figures exist locally",
                            "Scope is country level only (AGSI_COUNTRIES: AT BE DE ES "
                            "FR GB IT NL PL); the 'site' in the family label is not "
                            "held (company/facility scopes exist in the connector but "
                            "are not the default)",
                            "numeric nulls 11% (the GB rows)",
                            "Relevance medium: EU storage fullness drives NBP/TTF gas "
                            "price and so CCGT marginal cost; GB itself is null.",
                            "Unit unconfirmed for storage_pct_full; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for gas_in_storage_gwh; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for working_gas_volume_gwh; research did "
                            "not establish a reliable unit.",
                            "Unit unconfirmed for injection_gwh; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for withdrawal_gwh; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for net_withdrawal_gwh; research did not "
                            "establish a reliable unit.",
                        ],
                    },
                    {
                        "id": "storage_reports",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_gie_agsi_storage_reports",
                        "latest_relation": "silver_gie_agsi_storage_reports_latest",
                        "not_held_cause": None,
                        "clock": {"column": "gas_day", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "gas_day"},
                        "values": [
                            {
                                "column": "storage_pct_full",
                                "unit": None,
                                "label": "EU aggregate fullness",
                            },
                            {
                                "column": "gas_in_storage_gwh",
                                "unit": None,
                                "label": "EU gas in storage",
                            },
                            {"column": "injection_gwh", "unit": None, "label": "EU injection"},
                            {"column": "withdrawal_gwh", "unit": None, "label": "EU withdrawal"},
                        ],
                        "dims": [{"column": "entity_code", "role": "filter", "cardinality": 1}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Default scope is aggregate_type EU only (1 row per gas day)",
                            "Same unit disagreement as storage (EU "
                            "working_gas_volume_gwh = 1130.2)",
                            "schema_cls = None: excluded from schema validation",
                            "Unit unconfirmed for storage_pct_full; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for gas_in_storage_gwh; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for injection_gwh; research did not "
                            "establish a reliable unit.",
                            "Unit unconfirmed for withdrawal_gwh; research did not "
                            "establish a reliable unit.",
                        ],
                    },
                ],
            },
            {
                "slug": "storage-unavailability",
                "label": "Storage unavailability",
                "kind": "events",
                "page": "table-only",
                "route": "/sources/gie_agsi/storage-unavailability",
                "notes": [],
                "datasets": [
                    {
                        "id": "unavailability",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "events-table",
                        "base_relation": "silver_gie_agsi_unavailability",
                        "latest_relation": "silver_gie_agsi_unavailability_latest",
                        "not_held_cause": None,
                        "clock": None,
                        "latest_day_rule": {"mode": "max", "column": "event_time"},
                        "values": [
                            {
                                "column": "withdrawal",
                                "unit": "GWh/d per vault (VARCHAR in silver)",
                                "label": "withdrawal capacity reduction",
                            },
                            {
                                "column": "injection",
                                "unit": "GWh/d per vault (VARCHAR)",
                                "label": "injection capacity reduction",
                            },
                            {
                                "column": "volume",
                                "unit": "GWh per vault (VARCHAR)",
                                "label": "volume reduction",
                            },
                        ],
                        "dims": [
                            {"column": "country", "role": "filter", "cardinality": 13},
                            {"column": "facility", "role": "filter", "cardinality": 52},
                            {"column": "type", "role": "filter", "cardinality": 2},
                            {"column": "end_flag", "role": "filter", "cardinality": 2},
                        ],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "KNOWN SILVER BUG (unmerged gridflow branch "
                            "fix/silver-agsi-unavailability-overlap, commit 80bad68): "
                            "_unavailability_record_overlaps reads "
                            "event_start/start_at keys the live records lack, so every "
                            "partition keeps the whole bronze set: 1705 rows = 5 x "
                            "341, 327 distinct outages. The fix bumps DATASET_VERSION "
                            "1.0.0 -> 1.1.0 (local rows are 1.0.0). Do not merge from "
                            "here",
                            "published/start/end/injection/withdrawal/volume are "
                            "VARCHAR; country/company/facility are JSON strings. Vault "
                            "says start/end are parsed by _safe_datetime; they are not "
                            "(the key names miss AgsiJsonTransformer.datetime_columns)",
                            "Population file's '2026-08-16, 1 day' is ingested_at, not "
                            "an event clock",
                            "80 rows carry country code 'GB*' (United Kingdom "
                            "(Post-Brexit)); vault says GB returns zero rows",
                            "Page note required per RUNBOOK section 8. After the fix "
                            "the commit message reports 6-22 outages per day.",
                        ],
                    }
                ],
            },
            {
                "slug": "transparency-news",
                "label": "Transparency news",
                "kind": "events",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "news",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "not-held",
                        "base_relation": "silver_gie_agsi_news",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": "unknown", "grain": "event", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "gas_day"},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Transformer exists. Whether the listing reaches back to "
                            "14-20 Sep is unknown; one fetch would settle it."
                        ],
                    },
                    {
                        "id": "news_item",
                        "schedule": "daily",
                        "kind": "events",
                        "verdict": "not-held",
                        "base_relation": "silver_gie_agsi_news_item",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": "unknown", "grain": "event", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "gas_day"},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [],
                    },
                ],
            },
            {
                "slug": "facility-and-company-listings",
                "label": "Facility and company listings",
                "kind": "reference",
                "page": "not-built",
                "route": None,
                "notes": [],
                "datasets": [
                    {
                        "id": "about_summary",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_gie_agsi_about_summary",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": ["Transformer exists."],
                    },
                    {
                        "id": "about_listing",
                        "schedule": "weekly",
                        "kind": "reference",
                        "verdict": "not-held",
                        "base_relation": "silver_gie_agsi_about_listing",
                        "latest_relation": None,
                        "not_held_cause": "never-fetched",
                        "clock": {"column": None, "grain": "snapshot", "settlement_cols": []},
                        "latest_day_rule": {"mode": "reference", "column": None},
                        "values": [],
                        "dims": [],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "Transformer exists. Would unlock facility-level storage "
                            "scope (the 'site' in the family label)."
                        ],
                    },
                ],
            },
        ],
    },
    {
        "key": "gie_alsi",
        "name": "GIE ALSI",
        "domain": "Gas",
        "host": "alsi.gie.eu",
        "blurb": "LNG terminals across Europe: inventory and send-out.",
        "layer": "silver",
        "families": [
            {
                "slug": "lng-inventory-and-send-out",
                "label": "LNG inventory and send-out",
                "kind": "series",
                "page": "build",
                "route": "/sources/gie_alsi/lng-inventory-and-send-out",
                "notes": [],
                "datasets": [
                    {
                        "id": "lng",
                        "schedule": "daily",
                        "kind": "series",
                        "verdict": "chart",
                        "base_relation": "silver_gie_alsi_lng",
                        "latest_relation": "silver_gie_alsi_lng_latest",
                        "not_held_cause": None,
                        "clock": {"column": "gas_day", "grain": "1d", "settlement_cols": []},
                        "latest_day_rule": {"mode": "max", "column": "gas_day"},
                        "values": [
                            {
                                "column": "send_out_gwh",
                                "unit": "GWh per gas day (per column name)",
                                "label": "LNG send-out by country",
                            },
                            {
                                "column": "dtrs",
                                "unit": None,
                                "label": "raw vendor dtrs, code marks it an unconfirmed "
                                "non-percentage metric",
                            },
                            {
                                "column": "dtmi_gwh",
                                "unit": None,
                                "label": "raw vendor dtmi.gwh, unconfirmed",
                            },
                        ],
                        "dims": [{"column": "country_code", "role": "series", "cardinality": 8}],
                        "default_filter": None,
                        "dedup": None,
                        "row_filter": None,
                        "snapshot_column": None,
                        "volume_class": "small",
                        "notes": [
                            "NEW SILVER GAP (not on any named branch): inventory is "
                            'dropped. Bronze carries "inventory": {"lng", "gwh"} as a '
                            "struct, but LNGTerminalTransformer's field_map only maps "
                            "lngInventory/gasInStorage, so lng_in_storage_gwh, "
                            "lng_pct_full, injection_gwh and trend are absent from the "
                            "relation. Half the family label ('inventory') is not "
                            "chartable",
                            "Vault silver schema lists those columns; the relation "
                            "does not have them",
                            "GB: 5/5 rows all-null",
                            "dtrs/dtmi units unknown (code and vault: official ALSI "
                            "docs auth-walled)",
                            "Needs a gridflow backlog item: map inventory.gwh to "
                            "lng_in_storage_gwh (the dtmi struct is already handled "
                            "the same way).",
                            "Unit unconfirmed for dtrs; research did not establish a "
                            "reliable unit.",
                            "Unit unconfirmed for dtmi_gwh; research did not establish "
                            "a reliable unit.",
                        ],
                    }
                ],
            }
        ],
    },
]
