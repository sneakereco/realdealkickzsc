# Storefront search relevance

`tests/unit/product-search.test.ts` is the deterministic catalog fixture for storefront
search. It covers exact and prefix matches across brand, name, model, and SKU; punctuation,
case, whitespace, plural tokens, no-result behavior, stable pagination, and a 5,000-product
latency check.

The search overlay and `/store` both converge on `StorefrontService` and `ProductRepository`,
so they share one filtering and ranking path. Ranking priority is exact, prefix, phrase,
all-token, then partial token matches, with product ID as the stable tie-breaker.
