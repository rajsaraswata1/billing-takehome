# Decisions

## Money representation

All arithmetic happens in **integer cents**, never floats or string math on dollar amounts. `"12.99"` becomes `1299` at the API boundary (`parseMoneyToCents`) and is only ever converted back to a `"12.99"`-style string when a response is built (`centsToMoney`). Floats can't represent money exactly (`0.1 + 0.2 !== 0.3` in IEEE 754), and doing math on decimal strings invites subtle bugs. Integer cents sidestep both.

`parseMoneyToCents` is strict: it requires exactly 2 decimals (`^\d+\.\d{2}$`) and throws on anything else, including negative-sign input — negativity is checked separately by the caller so the error messages stay specific ("tip must not be negative" vs "malformed money string").

## Rounding: dual pricing and convenience fee

Percentage-based amounts (4% dual pricing, 2.9% convenience fee) produce fractional cents, which get **round-half-up** to the nearest cent (`roundHalfUpToCent`), not banker's rounding. Half-up is what most POS/payment systems and customers expect, and it's simpler to reason about than round-to-even for a take-home this size.

The trickier call: **dual pricing is rounded per unit, then multiplied by quantity** — not applied to the summed subtotal, and not rounded once per line. `menu.json`'s `FRIES` at `$3.33` illustrates why this matters:

- Per unit: `3.33 × 1.04 = 3.4632` → rounds to `3.46` → × 3 = `$10.38`
- Per line (round after multiplying): `3.33 × 3 × 1.04 = 9.99 × 1.04 = 10.3896` → rounds to `$10.39`

These disagree by a cent. I went with per-unit because the contract says the surcharge is "increased by 4% ... before summing," which reads as a per-item transformation applied before the sum, not a global markup on the pre-computed subtotal. It also matches what a receipt listing individual item prices would show. This is documented with a dedicated test (`SODA × 50` in `orders.test.ts`) so a future reader can see the intent, not just the arithmetic.

## Split: remainder distribution

`splitCentsExact` does integer division for the base share (`total / ways`, floored) and then hands the leftover cents out one at a time to the first `remainder` shares. This is deterministic, has no float drift, and by construction the shares always sum to exactly `total` with a max–min spread of at most 1 cent — both hard requirements in the contract. The alternative (splitting the dollar string and using `toFixed`) can lose or invent a cent depending on rounding direction; this doesn't.

I put the extra cent on the *first* N shares rather than randomizing or rotating who gets it. It's arbitrary which shares get the extra penny, but determinism matters more than "fairness" here — the contract only requires the sum and spread invariants, and a stable rule is easier to test and to explain live.

## Timezone handling (the actual point of the assignment)

Every order stores **two** representations of `placed_at`: the original ISO-8601 string with offset (returned verbatim in responses) and a resolved UTC instant in milliseconds (`placed_at_utc_ms`, used internally). `placed_at` is required to carry an explicit UTC offset — a bare local time with no offset can't be placed unambiguously on a timeline, and report grouping depends on having a real instant.

`GET /reports/daily` re-projects each order's UTC instant into the **timezone given in the query**, not the shop's own timezone, and asks Luxon for that instant's calendar date in that zone. This is deliberate: the contract's endpoint takes an explicit `tz` parameter separate from any shop, so a Chicago order should be able to show up on a different calendar day if you ask for it in `UTC` versus `America/Chicago` — and the test suite checks exactly that (`reports.test.ts`, "re-projects into the REQUESTED report tz, not the shop's own tz").

The Berlin sample orders (`2026-10-25T02:30:00+02:00` and `...+01:00`) are the DST fall-back fold: local clocks read 02:30 twice that night as they roll back from CEST to CET. Because both timestamps carry explicit (and different) offsets, they resolve to two distinct UTC instants an hour apart — not duplicates — and both land on Oct 25 in `Europe/Berlin`. Getting this right depends entirely on treating `placed_at` as an instant (offset respected) rather than parsing it as a naive wall-clock string and discarding the offset, which is the easy mistake to make here.

## What I'd do differently with more time

- **Persistence.** In-memory storage is fine for the brief but means a server restart during the live-modification round wipes all orders — worth a JSON-file or SQLite-backed store if this were going further.
- **A real preview/quote endpoint.** The frontend currently uses `POST /orders` itself (debounced) to get a live, server-computed breakdown before the user commits, because the contract has no separate quote endpoint. That's a reasonable read of the spec but it means every keystroke that changes the cart creates a new stored order — harmless for a demo, but not something I'd want in a production system's order history. A `POST /orders/preview` that does the same pricing without persisting would be the fix.
- **Idempotency keys** on `POST /orders`, so a flaky network retry from the frontend can't double-charge.
- **The `/insights` bonus endpoint** — skipped to keep the required three endpoints solid rather than spreading the time budget thinner.
