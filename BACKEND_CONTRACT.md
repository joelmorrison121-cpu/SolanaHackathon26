# Backend Contract

This is the shared contract for the backend, frontend, and Solana integration.

## Data model

### Bill

```json
{
  "id": "bill_123",
  "creatorId": "user_456",
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
    { "payerId": "payer_789", "displayName": "Alex", "amountOwedMinor": 3000, "shareLink": "/pay/opaque-random-token" }
  ]
}
```

The backend must reject a bill where payer amounts do not add up to the total.

### Get a payer bill

`GET /api/pay/:linkToken`

Response `200`:

```json
{
  "billId": "bill_123",
  "payerId": "payer_789",
  "currency": "EUR",
  "amountOwedMinor": 3000,
  "status": "pending"
}
```

Invalid or expired links return `404`.

### Settle a payer bill

`POST /api/pay/:linkToken/settle`

Request:

```json
{
  "payerWallet": "payer-wallet-public-key"
}
```

Person 1 will confirm the final settlement function shape. The backend should pass the payer wallet and amount owed to that function rather than duplicating on-chain logic.

Response `200`:

```json
{
  "status": "paid",
  "transactionUrl": "https://explorer.solana.com/tx/transaction-signature?cluster=devnet"
}
```

Return `409` when the payer is already paid, `400` for invalid input, and `502` when the on-chain settlement fails. Do not mark a payer as paid until Person 1's settlement function confirms success.

## Screen flow

1. Person 4's create-bill screen sends the total and payer amounts to `POST /api/bills`.
2. The response displays one share link per payer.
3. A payer opens their link; the payer screen calls `GET /api/pay/:linkToken`.
4. The payer logs in and gets a wallet from Person 3.
5. The payer taps Pay; the screen sends the wallet public key to the settle endpoint.
6. The screen displays Paid and the returned transaction link only after a successful response.

## Team decisions needed at the 12:30 sync

- Person 1's exact settlement function arguments and return type.
- Whether the backend identifies the creator by authenticated user ID or a demo-only creator ID.
- Link expiry duration and whether links can be revoked.
