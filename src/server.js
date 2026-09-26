import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 3000);
const bills = new Map();

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

const mockSettlementAdapter = async ({ payerWallet, amountOwedMinor }) => ({
  transactionUrl: `https://explorer.solana.com/tx/mock-${randomUUID()}?cluster=devnet`,
  payerWallet,
  amountOwedMinor
});

const readJson = async (request) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.statusCode = 400;
    throw error;
  }
};

const send = (response, result) => {
  response.writeHead(result.statusCode, result.headers);
  response.end(result.body);
};

const validateCreateBill = (body) => {
  if (!body || typeof body !== 'object') return 'Request body is required';
  if (typeof body.creatorId !== 'string' || !body.creatorId.trim()) return 'creatorId is required';
  if (body.currency !== 'EUR') return 'currency must be EUR';
  if (!Number.isInteger(body.totalAmountMinor) || body.totalAmountMinor <= 0) {
    return 'totalAmountMinor must be a positive integer';
  }
  if (!Array.isArray(body.payers) || body.payers.length === 0) return 'payers must not be empty';

  for (const payer of body.payers) {
    if (typeof payer.displayName !== 'string' || !payer.displayName.trim()) return 'Each payer needs a displayName';
    if (!Number.isInteger(payer.amountOwedMinor) || payer.amountOwedMinor <= 0) {
      return 'Each payer needs a positive integer amountOwedMinor';
    }
  }

  const payerTotal = body.payers.reduce((sum, payer) => sum + payer.amountOwedMinor, 0);
  if (payerTotal !== body.totalAmountMinor) return 'Payer amounts must add up to totalAmountMinor';
  return null;
};

const createApp = ({ settlementAdapter = mockSettlementAdapter } = {}) => async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      send(response, json(200, { status: 'ok' }));
      return;
    }

    if (request.method === 'POST' && request.url === '/api/bills') {
      const body = await readJson(request);
      const validationError = validateCreateBill(body);
      if (validationError) {
        send(response, json(400, { error: validationError }));
        return;
      }

      const billId = `bill_${randomUUID()}`;
      const createdPayers = body.payers.map((payer) => {
        const linkToken = randomBytes(32).toString('hex');
        return {
          payer: {
            id: `payer_${randomUUID()}`,
            displayName: payer.displayName.trim(),
            amountOwedMinor: payer.amountOwedMinor,
            status: 'pending',
            linkTokenHash: tokenHash(linkToken)
          },
          linkToken
        };
      });
      const payers = createdPayers.map(({ payer }) => payer);

      bills.set(billId, {
        id: billId,
        creatorId: body.creatorId.trim(),
        currency: body.currency,
        totalAmountMinor: body.totalAmountMinor,
        payers,
        createdAt: new Date().toISOString()
      });

      send(response, json(201, {
        billId,
        payers: createdPayers.map(({ payer, linkToken }) => ({
          payerId: payer.id,
          displayName: payer.displayName,
          amountOwedMinor: payer.amountOwedMinor,
          shareLink: `/pay/${linkToken}`
        }))
      }));
      return;
    }

    const billMatch = request.url.match(/^\/api\/pay\/([^/]+)$/);
    if (request.method === 'GET' && billMatch) {
      const payer = findPayer(billMatch[1]);
      if (!payer) {
        send(response, json(404, { error: 'Payment link not found' }));
        return;
      }

      send(response, json(200, {
        billId: payer.bill.id,
        payerId: payer.payer.id,
        currency: payer.bill.currency,
        amountOwedMinor: payer.payer.amountOwedMinor,
        status: payer.payer.status
      }));
      return;
    }

    const settleMatch = request.url.match(/^\/api\/pay\/([^/]+)\/settle$/);
    if (request.method === 'POST' && settleMatch) {
      const payer = findPayer(settleMatch[1]);
      if (!payer) {
        send(response, json(404, { error: 'Payment link not found' }));
        return;
      }
      if (payer.payer.status === 'paid') {
        send(response, json(409, { error: 'Payment is already complete' }));
        return;
      }

      const body = await readJson(request);
      if (typeof body.payerWallet !== 'string' || !body.payerWallet.trim()) {
        send(response, json(400, { error: 'payerWallet is required' }));
        return;
      }

      try {
        const settlement = await settlementAdapter({
          payerWallet: body.payerWallet.trim(),
          amountOwedMinor: payer.payer.amountOwedMinor,
          bill: payer.bill
        });
        payer.payer.status = 'paid';
        send(response, json(200, {
          status: 'paid',
          transactionUrl: settlement.transactionUrl
        }));
      } catch {
        send(response, json(502, { error: 'Settlement failed' }));
      }
      return;
    }

    send(response, json(404, { error: 'Route not found' }));
  } catch (error) {
    send(response, json(error.statusCode || 500, { error: error.statusCode ? error.message : 'Internal server error' }));
  }
};

const findPayer = (linkToken) => {
  const hash = tokenHash(linkToken);
  for (const bill of bills.values()) {
    const payer = bill.payers.find((candidate) => candidate.linkTokenHash === hash);
    if (payer) return { bill, payer };
  }
  return null;
};

export { createApp, bills, mockSettlementAdapter };

if (process.argv[1] && process.argv[1].endsWith('src/server.js')) {
  createServer(createApp()).listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}
