# Fleksa Billing — Take-Home

A mini restaurant billing service: TypeScript/Express backend + React (Vite) frontend.

## Run it

Requires Node 18+.

**Backend** (defaults to port 3001):

```bash
cd backend
npm install
npm run dev
```

**Frontend** (in a second terminal, defaults to port 5173):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The frontend talks to `http://localhost:3001` by default — override with `VITE_API_URL` (see `frontend/.env.example`) if you run the backend elsewhere.

## Tests

```bash
cd backend
npm test
```

32 tests covering: money rounding edge cases, the `subtotal + fee + tip − discount = total` invariant, exact-sum splitting (including the 20-way and 1-cent-remainder cases), the Chicago midnight timezone boundary, the Berlin DST fall-back fold, and HTTP-level status codes.

There's no frontend test suite — given the time budget, I put the testing effort into the backend's money/timezone logic, which is where correctness actually lives per the assignment brief. The frontend never recomputes money client-side, so a backend bug is a frontend bug too.

## Project layout

```
backend/
  src/
    money.ts       — integer-cents arithmetic, split algorithm
    orders.ts       — POST /orders pricing + validation
    split.ts        — POST /orders/:id/split
    reports.ts       — GET /reports/daily (timezone-aware grouping)
    server.ts / index.ts
  tests/
  fixtures/          — menu.json, shops.json, sample-orders.json (as given)
frontend/
  src/
    lib/api.ts        — fetch wrapper, one function per endpoint
    lib/types.ts       — mirrors api-contract.md response shapes
    screens/            — Order, Split, Report
```

## Notable design choices

See `DECISIONS.md` for the reasoning behind money representation, split-remainder distribution, and timezone handling. See `AI-USAGE.md` for how AI tools were used while building this, including where they got it wrong.

## What's not done

- The optional `/insights` bonus endpoint (natural-language daily summary) — skipped to keep the required scope solid within the time budget rather than spreading thinner.
- No persistence layer — in-memory store, as the brief allows. Restarting the backend clears all orders.
- No auth — out of scope for the brief.
