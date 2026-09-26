## What This Project Does

This backend creates a bill, gives each payer a private payment link, and settles a payer's amount. It stores money as integer minor units, so `3000` means EUR 30.00.

The API has three main routes:

- `POST /api/bills` creates a bill and returns payer link tokens.
- `GET /api/pay/:linkToken` shows the amount and payment status for one payer.
- `POST /api/pay/:linkToken/settle` tries to settle one payment.

## Team Build

The shared backend data model, API contract, and screen flow are documented in [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md).
Security controls and current limitations are documented in [SECURITY.md](SECURITY.md).

## Backend

```text
npm test
npm start
```

The API runs at `http://localhost:3000`. It currently uses in-memory storage and a mock settlement adapter. The adapter is isolated in `src/server.js` so Person 1's confirmed Solana settlement function can replace it later without changing the API routes.

The server is for the hackathon demo. Bills and settlement logs disappear when the server stops. Do not use the current in-memory storage as a production database.
