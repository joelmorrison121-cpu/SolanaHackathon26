import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { bills, createApp } from '../src/server.js';

const startServer = async (settlementAdapter) => {
  const server = createServer(createApp({ settlementAdapter }));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://localhost:${port}` };
};

const createBill = (baseUrl) => fetch(`${baseUrl}/api/bills`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    creatorId: 'demo-creator',
    currency: 'EUR',
    totalAmountMinor: 9000,
    payers: [{ displayName: 'Alex', amountOwedMinor: 9000 }]
  })
});

test.beforeEach(() => bills.clear());

test('creates a bill and fetches it through its share link', async () => {
  const { server, baseUrl } = await startServer(async () => ({ transactionUrl: 'mock-url' }));
  try {
    const createResponse = await createBill(baseUrl);
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.match(created.payers[0].shareLink, /^\/pay\/[a-f0-9]{64}$/);

    const linkToken = created.payers[0].shareLink.split('/').pop();
    const billResponse = await fetch(`${baseUrl}/api/pay/${linkToken}`);
    assert.equal(billResponse.status, 200);
    assert.deepEqual(await billResponse.json(), {
      billId: created.billId,
      payerId: created.payers[0].payerId,
      currency: 'EUR',
      amountOwedMinor: 9000,
      status: 'pending'
    });
  } finally {
    server.close();
  }
});

test('settles a payer and prevents a second payment', async () => {
  const { server, baseUrl } = await startServer(async ({ payerWallet, amountOwedMinor }) => {
    assert.equal(payerWallet, 'wallet-public-key');
    assert.equal(amountOwedMinor, 9000);
    return { transactionUrl: 'https://explorer.solana.com/tx/test?cluster=devnet' };
  });
  try {
    const created = await (await createBill(baseUrl)).json();
    const linkToken = created.payers[0].shareLink.split('/').pop();
    const settleUrl = `${baseUrl}/api/pay/${linkToken}/settle`;
    const settleResponse = await fetch(settleUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payerWallet: 'wallet-public-key' })
    });
    assert.equal(settleResponse.status, 200);
    assert.deepEqual(await settleResponse.json(), {
      status: 'paid',
      transactionUrl: 'https://explorer.solana.com/tx/test?cluster=devnet'
    });

    const duplicateResponse = await fetch(settleUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payerWallet: 'wallet-public-key' })
    });
    assert.equal(duplicateResponse.status, 409);
  } finally {
    server.close();
  }
});

test('rejects bills whose payer amounts do not equal the total', async () => {
  const { server, baseUrl } = await startServer(async () => ({ transactionUrl: 'mock-url' }));
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
