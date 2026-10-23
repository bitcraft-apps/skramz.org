# Changelog

## 1.0.0 (2026-10-23)


### Features

* **api:** add five-table D1 migration ([#5](https://github.com/bitcraft-apps/skramz.org/issues/5)) ([#19](https://github.com/bitcraft-apps/skramz.org/issues/19)) ([571765a](https://github.com/bitcraft-apps/skramz.org/commit/571765a955874539d306b23db3454c768b2b904d))
* **api:** band graph endpoint + recursive CTE ([#31](https://github.com/bitcraft-apps/skramz.org/issues/31)) ([9d4d17f](https://github.com/bitcraft-apps/skramz.org/commit/9d4d17fa0c72f74d5e8cd29937e68e5a1eecddec))
* **api:** CRUD endpoints + ingestion-token auth ([#8](https://github.com/bitcraft-apps/skramz.org/issues/8)) ([#30](https://github.com/bitcraft-apps/skramz.org/issues/30)) ([2390f00](https://github.com/bitcraft-apps/skramz.org/commit/2390f00fc5b3c733de9dd79097a4d641ff43571e))
* **api:** D1 database + wrangler project + local/dev workflow ([#17](https://github.com/bitcraft-apps/skramz.org/issues/17)) ([47f2388](https://github.com/bitcraft-apps/skramz.org/commit/47f2388cddd922d0a62b616d48b906c01bad6ee6))


### Bug Fixes

* **api:** make tokensEqual length-agnostic to avoid leaking token length via timing ([#41](https://github.com/bitcraft-apps/skramz.org/issues/41)) ([8863e16](https://github.com/bitcraft-apps/skramz.org/commit/8863e16b07821b6092494cc6d6955eda024c3df6))
* **api:** null-safe dedupe for band_members ([#20](https://github.com/bitcraft-apps/skramz.org/issues/20)) ([#47](https://github.com/bitcraft-apps/skramz.org/issues/47)) ([ce05d71](https://github.com/bitcraft-apps/skramz.org/commit/ce05d71d70cb204c65295450b367e527c3ca323a))
* **api:** per-type search limits ([#50](https://github.com/bitcraft-apps/skramz.org/issues/50)) and normalized release search ([#51](https://github.com/bitcraft-apps/skramz.org/issues/51)) ([#52](https://github.com/bitcraft-apps/skramz.org/issues/52)) ([3aea6e1](https://github.com/bitcraft-apps/skramz.org/commit/3aea6e16407320881b293c2a40841088d3dbc1d8))
* **api:** require releases.release_type via NOT NULL ([#45](https://github.com/bitcraft-apps/skramz.org/issues/45)) ([03376b2](https://github.com/bitcraft-apps/skramz.org/commit/03376b259a10c2217e5754d95fa9a6e2a2a6c2bb))
* **api:** sanitize engine error messages in API responses ([#37](https://github.com/bitcraft-apps/skramz.org/issues/37)) ([d73628d](https://github.com/bitcraft-apps/skramz.org/commit/d73628def3fd4b18396886cc792bbb3153cfa0b5))
* **api:** stable cross-type cursor for /api/search ([#29](https://github.com/bitcraft-apps/skramz.org/issues/29)) ([#49](https://github.com/bitcraft-apps/skramz.org/issues/49)) ([5a7355e](https://github.com/bitcraft-apps/skramz.org/commit/5a7355ee391ac5efbe9ff3a864cc3df314536a07))
