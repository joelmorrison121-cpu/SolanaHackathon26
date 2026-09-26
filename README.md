## Team Build

The shared backend data model, API contract, and screen flow are documented in [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md).

## Backend

```text
npm test
npm start
```

The API runs at `http://localhost:3000`. It currently uses in-memory storage and a mock settlement adapter. The adapter is isolated in `src/server.js` so Person 1's confirmed Solana settlement function can replace it later without changing the API routes.
