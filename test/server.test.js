import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { bills, createApp, settlementAttempts } from '../src/server.js';

// Start a real HTTP server so tests cover request and response behavior.
const startServer = async (settlementAdapter) => {
  const server = createServer(createApp({ settlementAdapter }));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://localhost:${port}` };
};

// Use one small valid bill in tests that need a payment link.
const createBill = (baseUrl) => fetch(`${baseUrl}/api/bills`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    creatorId: 'demo-creator',
    creatorWallet: 'DQRCcvgiwhwCmR7L82FQFr6X6gb4wBcK1kcNLMghr6A',
    currency: 'EUR',
    totalAmountMinor: 9000,
    payers: [{ displayName: 'Alex', amountOwedMinor: 9000 }]
  })
});

// Keep each test independent from the previous test.
test.beforeEach(() => {
  bills.clear();
  settlementAttempts.length = 0;
});

// Check the security headers and reject an untrusted browser origin.
test('sets security headers and rejects an unapproved browser origin', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.headers.get('cache-control'), 'no-store');
    assert.equal(healthResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthResponse.headers.get('x-frame-options'), 'DENY');

    const response = await fetch(`${baseUrl}/api/bills`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://malicious.example'
      },
      body: JSON.stringify({
        creatorId: 'demo-creator',
        currency: 'EUR',
        totalAmountMinor: 9000,
        payers: [{ displayName: 'Alex', amountOwedMinor: 9000 }]
      })
    });
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

// Check the normal create-bill and payer-lookup flow.
test('creates a bill and fetches it through its share link', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const createResponse = await createBill(baseUrl);
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.payers[0].name, 'Alex');
    assert.equal(created.payers[0].amount, 9000);
    assert.match(created.payers[0].linkToken, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(created.payers[0]).sort(), ['amount', 'linkToken', 'name', 'payerId']);

    const linkToken = created.payers[0].linkToken;
    const billResponse = await fetch(`${baseUrl}/api/pay/${linkToken}`);
    assert.equal(billResponse.status, 200);
    assert.deepEqual(await billResponse.json(), {
      billId: created.billId,
      payerId: created.payers[0].payerId,
      currency: 'EUR',
      amount: 9000,
      status: 'pending'
    });
  } finally {
    server.close();
  }
});

// Check successful settlement and protection against paying twice.
test('settles a payer and prevents a second payment', async () => {
  const { server, baseUrl } = await startServer(async ({ payerWallet, creatorWallet, amountCents }) => {
    assert.equal(payerWallet, '7xKX9pQm123456789ABCDEFGHJKLMNPQR');
    assert.equal(creatorWallet, 'DQRCcvgiwhwCmR7L82FQFr6X6gb4wBcK1kcNLMghr6A');
    assert.equal(amountCents, 9000);
    return { success: true, status: 'confirmed', signature: 'test-signature', explorerUrl: 'https://explorer.solana.com/tx/test?cluster=devnet' };
  });
  try {
    const created = await (await createBill(baseUrl)).json();
    const linkToken = created.payers[0].linkToken;
    const settleUrl = `${baseUrl}/api/pay/${linkToken}/settle`;
    const settleResponse = await fetch(settleUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payerWallet: '7xKX9pQm123456789ABCDEFGHJKLMNPQR' })
    });
    assert.equal(settleResponse.status, 200);
    assert.deepEqual(await settleResponse.json(), {
      status: 'paid',
      transactionUrl: 'https://explorer.solana.com/tx/test?cluster=devnet'
    });

    const duplicateResponse = await fetch(settleUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payerWallet: '7xKX9pQm123456789ABCDEFGHJKLMNPQR' })
    });
    assert.equal(duplicateResponse.status, 409);
  } finally {
    server.close();
  }
});

// Prevent a bill from hiding a missing amount in one of its payer entries.
test('rejects bills whose payer amounts do not equal the total', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const response = await fetch(`${baseUrl}/api/bills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        creatorId: 'demo-creator',
        currency: 'EUR',
        totalAmountMinor: 9000,
        payers: [{ displayName: 'Alex', amountOwedMinor: 8999 }]
      })
    });
    assert.equal(response.status, 400);
  } finally {
    server.close();
  }
});

// A guessed or changed bearer token must not reveal another payer record.
test('does not allow a guessed or another payer token to access a record', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const created = await (await createBill(baseUrl)).json();
    const guessedResponse = await fetch(`${baseUrl}/api/pay/${'a'.repeat(64)}`);
    assert.equal(guessedResponse.status, 404);

    const tamperedResponse = await fetch(`${baseUrl}/api/pay/${created.payers[0].linkToken.slice(0, -1)}0`);
    assert.equal(tamperedResponse.status, 404);
  } finally {
    server.close();
  }
});

// Ignore client attempts to set protected values such as status or amount.
test('ignores client-controlled status and amount fields', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const response = await fetch(`${baseUrl}/api/bills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        creatorId: 'demo-creator',
        currency: 'EUR',
        totalAmountMinor: 9000,
        status: 'paid',
        payers: [{ displayName: 'Alex', amountOwedMinor: 9000, status: 'paid', amount: 1 }]
      })
    });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.payers[0].amount, 9000);

    const payerResponse = await fetch(`${baseUrl}/api/pay/${created.payers[0].linkToken}`);
    assert.equal((await payerResponse.json()).status, 'pending');
  } finally {
    server.close();
  }
});

// Reject bad wallet input and requests that are not JSON.
test('rejects invalid wallet input and non-JSON requests', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const created = await (await createBill(baseUrl)).json();
    const invalidWallet = await fetch(`${baseUrl}/api/pay/${created.payers[0].linkToken}/settle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payerWallet: '0x-not-solana' })
    });
    assert.equal(invalidWallet.status, 400);

    const nonJson = await fetch(`${baseUrl}/api/bills`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}'
    });
    assert.equal(nonJson.status, 415);
  } finally {
    server.close();
  }
});

// Reject names that could be interpreted as HTML by a frontend.
test('rejects markup-like payer names', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const response = await fetch(`${baseUrl}/api/bills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        creatorId: 'demo-creator',
        currency: 'EUR',
        totalAmountMinor: 9000,
        payers: [{ displayName: '<script>alert(1)</script>', amountOwedMinor: 9000 }]
      })
    });
    assert.equal(response.status, 400);
  } finally {
    server.close();
  }
});

// Do not allow a payment link to work after its expiry time.
test('rejects an expired payer link', async () => {
  const { server, baseUrl } = await startServer(async () => ({ success: true, status: 'confirmed', explorerUrl: 'mock-url' }));
  try {
    const created = await (await createBill(baseUrl)).json();
    bills.get(created.billId).expiresAt = new Date(Date.now() - 1).toISOString();
    const response = await fetch(`${baseUrl}/api/pay/${created.payers[0].linkToken}`);
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: 'Payment link expired' });
  } finally {
    server.close();
  }
});

// Record a failed attempt but keep the payer unpaid.
test('records failed settlement attempts without marking the payer paid', async () => {
  const { server, baseUrl } = await startServer(async () => {
    throw new Error('insufficient allowance');
  });
  try {
    const created = await (await createBill(baseUrl)).json();
    const response = await fetch(`${baseUrl}/api/pay/${created.payers[0].linkToken}/settle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payerWallet: '7xKX9pQm123456789ABCDEFGHJKLMNPQR' })
    });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Settlement failed', code: 'TRANSACTION_FAILED' });
    assert.equal(settlementAttempts.length, 1);
    assert.equal(settlementAttempts[0].status, 'failed');
    assert.equal(settlementAttempts[0].error, 'insufficient allowance');

    const billResponse = await fetch(`${baseUrl}/api/pay/${created.payers[0].linkToken}`);
    assert.equal((await billResponse.json()).status, 'pending');
  } finally {
    server.close();
  }
});
