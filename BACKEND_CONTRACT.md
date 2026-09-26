# Backend Contract

This is the shared contract for the backend, frontend, and Solana integration.

## Data model

### Bill

```json
{
  "id": "bill_123",
  "creatorId": "user_456",
  "creatorWallet": "creator-wallet-public-key",
  "currency": "EUR",
  "totalAmountMinor": 9000,
  "payers": [
    {
      "id": "payer_789",
      "displayName": "Alex",
      "amountOwedMinor": 3000,
      "status": "pending",
      "linkToken": "opaque-random-token"
    }
  ],
  "createdAt": "2026-09-26T10:30:00.000Z"
}
```

Money is stored as integer minor units. For example, EUR 30.00 is `3000`.

Payer status values are:

- `pending`: the payer has not started payment.
- `approved`: the payer approved the capped allowance, but settlement has not completed.
- `paid`: settlement completed successfully.

The link token must be cryptographically random and must not contain personal information or the bill amount. Store a hash of the token where practical, and never log the raw token.

## API endpoints

### Create a bill

`POST /api/bills`

Request:

```json
{
  "creatorId": "user_456",
  "creatorWallet": "creator-wallet-public-key",
  "currency": "EUR",
  "totalAmountMinor": 9000,
  "payers": [
    { "displayName": "Alex", "amountOwedMinor": 3000 },
    { "displayName": "Sam", "amountOwedMinor": 3000 },
    { "displayName": "Taylor", "amountOwedMinor": 3000 }
  ]
}
```

Response `201`:

```json
{
  "billId": "bill_123",
  "payers": [
    { "payerId": "payer_789", "name": "Alex", "amount": 3000, "linkToken": "opaque-random-token" }
  ]
}
```

The response intentionally contains only `payerId`, `name`, `amount`, and `linkToken` for each payer. The client cannot set the payer status or amount through extra request fields.

The backend must reject a bill where payer amounts do not add up to the total.
`creatorWallet` is required for real settlement and must be a base58 wallet address. It is optional while the mock settlement adapter is being used.

### Get a payer bill

`GET /api/pay/:linkToken`

Response `200`:

```json
{
  "billId": "bill_123",
  "payerId": "payer_789",
  "currency": "EUR",
  "amount": 3000,
  "status": "pending"
}
```

Invalid links return `404`; expired links return `410`.

### Settle a payer bill

`POST /api/pay/:linkToken/settle`

Request:

```json
{
  "payerWallet": "payer-wallet-public-key"
}
```

The backend calls `settlePayment({ payerWallet, creatorWallet, amountCents })`. The real adapter must return `success: true`, `status: "confirmed"`, a transaction `signature`, and an `explorerUrl` before the backend marks the payer as paid.

Response `200`:

```json
{
  "status": "paid",
  "transactionUrl": "https://explorer.solana.com/tx/transaction-signature?cluster=devnet"
}
```

Return `409` when the payer is already paid, `400` for invalid input, and `502` when the on-chain settlement fails. Do not mark a payer as paid until Person 1's settlement function confirms success.
Settlement failures return a safe error code such as `INSUFFICIENT_ALLOWANCE` or `TRANSACTION_NOT_CONFIRMED`; raw provider errors are never returned to the client.

Every settlement attempt is recorded with its payer, wallet public key, amount, timestamp, and outcome (`started`, `paid`, or `failed`). Settlement errors are recorded internally without exposing sensitive key material in the response.

## Wallet handoff

After Google login, the frontend waits for the embedded wallet to appear in Privy's `wallets` array. It then sends the wallet's public key to the backend so Person 1's funding function can airdrop mUSDC and devnet SOL. The private key never leaves Privy and must never be sent to the backend.

The public key is a base58-encoded Solana address. The backend treats it as an opaque string and does not enforce an exact character count or add a `0x` prefix.

The planned server-only funding interface is `fundTestWallet({ walletAddress, tokenAmountCents })`. The planned approval check is `checkApproval({ payerWallet, amountCents })`. Both are mocked until Person 1 supplies the real implementations. The settlement endpoint accepts the payer public key in `payerWallet` and uses the stored `creatorWallet`.

Payment links are bearer credentials: possession of a valid, unexpired link grants access to that payer record. Tokens are 32 random bytes and only their SHA-256 hashes are stored. Bill creation currently has no authenticated session because the wallet/auth contract is not integrated into this backend yet; add creator authentication before production use.

## Screen flow

1. Person 4's create-bill screen sends the total and payer amounts to `POST /api/bills`.
2. The response displays one share link per payer.
3. A payer opens their link; the payer screen calls `GET /api/pay/:linkToken`.
4. The payer logs in and gets a wallet from Person 3.
5. The payer taps Pay; the screen sends the wallet public key to the settle endpoint.
6. The screen displays Paid and the returned transaction link only after a successful response.

## Team decisions needed at the 12:30 sync

- Person 1's exact settlement and wallet-funding function arguments and return types.
- Whether the backend identifies the creator by authenticated user ID or a demo-only creator ID.
- Link expiry duration and whether links can be revoked.
