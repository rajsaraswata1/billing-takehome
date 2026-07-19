# AI Usage

## How this was built

I used Claude to build this end-to-end in one focused session: I gave it the assignment zip (`README.md`, `api-contract.md`, and the three fixture files) and asked it to build the full backend, the full frontend, and the test suite directly, rather than pair-programming line by line. That's a real tradeoff worth being upfront about — it's fast, but it means the honest version of this document is "here's what I checked before trusting it and what I still need to verify myself before the live round," not a blow-by-blow of catching the AI mid-mistake in a back-and-forth.

## Where I had to push back on or override the first draft

- **Dual pricing rounding.** The contract says CARD item prices are increased 4% "before summing." The AI's first implementation applied the 4% and rounded that per unit price, then multiplied by quantity. I asked it to justify that against the alternative (round once, after multiplying by quantity and summing the whole line) — those two approaches disagree by a cent on `FRIES` at `$3.33 × 3`. It walked me through both computations and the wording justified per-unit rounding, so I kept it, but this is exactly the kind of one-cent judgment call I'd want to defend live rather than just trust.
- **Report timezone semantics.** My first instinct reading the contract was that a report groups orders by the *shop's own* timezone. The AI's implementation instead uses whatever `tz` is passed in the query, independent of the shop, and pointed to the endpoint signature (`?date=&tz=`, no `shop_id`) as the reason. I think that's the correct reading, but it's a deliberate, non-obvious call — see `DECISIONS.md`.
- **The `POST /orders` re-use for live pricing.** The frontend's "live fee breakdown" calls the real `POST /orders` endpoint on every debounced cart change, because there's no separate preview/quote endpoint in the contract. I pushed on this because it means every keystroke creates a persisted order — the AI's answer was that no clean alternative exists without inventing an endpoint the spec doesn't have, and that this is worth flagging as a real limitation rather than hiding it. I agree it's a reasonable read, but I don't love it, and it's called out explicitly in `DECISIONS.md` as something I'd change with more time.

## Where it was just wrong (tooling, not logic)

Two purely mechanical mistakes during the build, both caught immediately by the tool output rather than by review:
- An early attempt to sanity-check the pricing math via `tsx -e '...'` failed with a module resolution error (relative import paths don't resolve the same way from an inline `-e` script as from a file) — fixed by writing the check to an actual `.ts` file instead.
- `npm create vite@latest` refused to scaffold into the `frontend/` folder because it wasn't empty (I'd already had it create an empty `src/screens` directory), and silently no-op'd instead of erroring clearly. Caught by checking the directory afterward and finding it still empty; worked around by hand-writing the Vite config instead of using the scaffolder.

## What I verified by hand rather than taking on faith

- Recomputed the `PIZZA_M × 1, FRIES × 3` CARD example by hand (dual pricing → subtotal → convenience fee → total) and matched it against the server's actual JSON response before writing it into `orders.test.ts` as a known-answer test, specifically so the test isn't just "assert whatever the code currently outputs."
- Manually reasoned through the Berlin DST fall-back date math (`+02:00` vs `+01:00` on `2026-10-25T02:30:00`, both landing on Oct 25 Berlin time) before accepting the corresponding test as meaningful rather than a fluke.

## What I have not independently verified, and would before the live round

- I have not tried to break the timezone logic with a zone that has a fractional UTC offset (e.g. `Asia/Kolkata`, +5:30) or a Southern Hemisphere DST spring-forward — the sample data only exercises a European fall-back. Worth adding a test for before Monday.
- I have not load-tested or checked behavior when the in-memory store gets large, or thought hard about concurrent requests (the store is not currently safe against interleaved writes under real concurrency, though Node's single-threaded event loop makes this low-risk for a synchronous in-memory `Map`).
- The frontend has no test suite at all — everything there was verified by running the dev server and clicking through it once, not by automated coverage.

Given the live round has me modify this code with the interviewer watching, my plan before Monday is to re-derive the dual-pricing and timezone logic from scratch on paper without looking at the code, and re-run the test suite line by line until I can explain what each test is actually checking and why it would fail if the logic were wrong.
