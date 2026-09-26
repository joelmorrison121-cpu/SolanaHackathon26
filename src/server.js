import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { settlePayment } from './lib/solana-adapter.js';

const port = Number(process.env.PORT || 3000);
const linkTtlMs = Number(process.env.LINK_TTL_MS || 24 * 60 * 60 * 1000);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 16 * 1024);
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 60);
const enforceHttps = process.env.NODE_ENV === 'production' || process.env.ENFORCE_HTTPS === 'true';
const trustProxy = process.env.TRUST_PROXY === 'true';
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const bills = new Map();
const settlementAttempts = [];

// Build the same JSON response shape for every API result.
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});

// Store only a hash of each payment-link token.
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

// Temporary adapter used until Person 1 supplies the real Solana function.
const mockSettlementAdapter = settlePayment;

// Read and validate a small JSON request body.
const readJson = async (request) => {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    const error = new Error('Content-Type must be application/json');
    error.statusCode = 415;
    throw error;
  }
  const declaredLength = Number(request.headers['content-length'] || 0);
  if (declaredLength > maxBodyBytes) {
    const error = new Error('Request body is too large');
    error.statusCode = 413;
    throw error;
  }

  let body = '';
  let bodyBytes = 0;
  for await (const chunk of request) {
    bodyBytes += Buffer.byteLength(chunk);
    if (bodyBytes > maxBodyBytes) {
      const error = new Error('Request body is too large');
      error.statusCode = 413;
      throw error;
    }
    body += chunk;
  }
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.statusCode = 400;
    throw error;
  }
};

// Send a prepared API result to the client.
const send = (response, result) => {
  response.writeHead(result.statusCode, result.headers);
  response.end(result.body);
};

// Add headers that protect responses and control browser access.
const applySecurityHeaders = (request, response) => {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");

  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'Content-Type, X-CSRF-Token');
  response.setHeader('access-control-max-age', '600');
  if (enforceHttps) response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
};

// Check whether the request arrived over HTTPS.
const requestIsHttps = (request) => {
  if (request.socket.encrypted) return true;
  if (trustProxy) return request.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https';
  return false;
};

// Get the address used to group requests for rate limiting.
const getClientAddress = (request) => request.socket.remoteAddress || 'unknown';
const rateLimiters = new Map();

// Limit repeated calls from one client to one route.
const isRateLimited = (request) => {
  const route = request.url.replace(/^\/api\/pay\/[^/?]+(?:\/settle)?(?:\?.*)?$/, '/api/pay/:linkToken');
  const key = `${getClientAddress(request)}:${request.method}:${route}`;
  const now = Date.now();
  const current = rateLimiters.get(key);
  if (!current || now >= current.resetAt) {
    rateLimiters.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }
  current.count += 1;
  return current.count > rateLimitMax;
};

// Reject unsafe origins and plain HTTP when HTTPS is required.
const validateRequestSecurity = (request) => {
  if (enforceHttps && !requestIsHttps(request)) return { statusCode: 426, message: 'HTTPS is required' };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.origin;
    const fetchSite = request.headers['sec-fetch-site'];
    if (origin && !allowedOrigins.has(origin)) return { statusCode: 403, message: 'Origin is not allowed' };
    if (fetchSite === 'cross-site') return { statusCode: 403, message: 'Cross-site requests are not allowed' };
  }
  return null;
};

// Clean user text and reject control characters and HTML-like input.
const sanitizeText = (value, fieldName, maxLength) => {
  if (typeof value !== 'string') return { error: `${fieldName} must be a string` };
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { error: `${fieldName} is required` };
  if (/[<>]/.test(cleaned)) return { error: `${fieldName} contains unsupported characters` };
  if (cleaned.length > maxLength) return { error: `${fieldName} is too long` };
  return { value: cleaned };
};

// Accept a Solana-style base58 public key without assuming one exact length.
const isBase58PublicKey = (value) => typeof value === 'string'
  && value.length <= 128
  && /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);

// Validate the fields needed to create a bill.
const validateCreateBill = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body is required';
  const creator = sanitizeText(body.creatorId, 'creatorId', 128);
  if (creator.error) return creator.error;
  if (body.currency !== 'EUR') return 'currency must be EUR';
  if (body.creatorWallet !== undefined && !isBase58PublicKey(body.creatorWallet)) {
    return 'creatorWallet must be a base58 public key';
  }
  if (!Number.isSafeInteger(body.totalAmountMinor) || body.totalAmountMinor <= 0) {
    return 'totalAmountMinor must be a positive integer';
  }
  if (!Array.isArray(body.payers) || body.payers.length === 0 || body.payers.length > 50) {
    return 'payers must contain between 1 and 50 entries';
  }

  for (const payer of body.payers) {
    const displayName = sanitizeText(payer?.displayName, 'Each payer displayName', 80);
    if (displayName.error) return displayName.error;
    if (!Number.isSafeInteger(payer.amountOwedMinor) || payer.amountOwedMinor <= 0) {
      return 'Each payer needs a positive integer amountOwedMinor';
    }
  }

  const payerTotal = body.payers.reduce((sum, payer) => sum + payer.amountOwedMinor, 0);
  if (payerTotal !== body.totalAmountMinor) return 'Payer amounts must add up to totalAmountMinor';
  return null;
};

// Create the HTTP API and keep the settlement function replaceable.
const createApp = ({ settlementAdapter = mockSettlementAdapter } = {}) => async (request, response) => {
  try {
    applySecurityHeaders(request, response);
    const securityError = validateRequestSecurity(request);
    if (securityError) {
      send(response, json(securityError.statusCode, { error: securityError.message }));
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.url !== '/health' && isRateLimited(request)) {
      response.setHeader('retry-after', String(Math.ceil(rateLimitWindowMs / 1000)));
      send(response, json(429, { error: 'Too many requests' }));
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      send(response, json(200, { status: 'ok' }));
      return;
    }

    // Create a bill and return one private link token per payer.
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
            displayName: sanitizeText(payer.displayName, 'Each payer displayName', 80).value,
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
        creatorId: sanitizeText(body.creatorId, 'creatorId', 128).value,
        creatorWallet: body.creatorWallet,
        currency: body.currency,
        totalAmountMinor: body.totalAmountMinor,
        payers,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + linkTtlMs).toISOString()
      });

      send(response, json(201, {
        billId,
        payers: createdPayers.map(({ payer, linkToken }) => ({
          payerId: payer.id,
          name: payer.displayName,
          amount: payer.amountOwedMinor,
          linkToken
        }))
      }));
      return;
    }

    // Let a payer view only the record belonging to its valid link token.
    const billMatch = request.url.match(/^\/api\/pay\/([^/]+)$/);
    if (request.method === 'GET' && billMatch) {
      const payer = findPayer(billMatch[1]);
      if (!payer) {
        send(response, json(404, { error: 'Payment link not found' }));
        return;
      }
      if (isExpired(payer.bill)) {
        send(response, json(410, { error: 'Payment link expired' }));
        return;
      }

      send(response, json(200, {
        billId: payer.bill.id,
        payerId: payer.payer.id,
        currency: payer.bill.currency,
        amount: payer.payer.amountOwedMinor,
        status: payer.payer.status
      }));
      return;
    }

    // Settle one payer and mark it paid only after the adapter succeeds.
    const settleMatch = request.url.match(/^\/api\/pay\/([^/]+)\/settle$/);
    if (request.method === 'POST' && settleMatch) {
      const payer = findPayer(settleMatch[1]);
      if (!payer) {
        send(response, json(404, { error: 'Payment link not found' }));
        return;
      }
      if (isExpired(payer.bill)) {
        send(response, json(410, { error: 'Payment link expired' }));
        return;
      }
      if (payer.payer.status === 'paid') {
        send(response, json(409, { error: 'Payment is already complete' }));
        return;
      }

      const body = await readJson(request);
      if (!isBase58PublicKey(body.payerWallet)) {
        send(response, json(400, { error: 'payerWallet must be a base58 public key' }));
        return;
      }

      const attempt = {
        id: `settlement_${randomUUID()}`,
        billId: payer.bill.id,
        payerId: payer.payer.id,
        payerWallet: body.payerWallet,
        amountOwedMinor: payer.payer.amountOwedMinor,
        status: 'started',
        createdAt: new Date().toISOString()
      };
      settlementAttempts.push(attempt);

      try {
        const settlement = await settlementAdapter({
          payerWallet: attempt.payerWallet,
          creatorWallet: payer.bill.creatorWallet,
          amountCents: payer.payer.amountOwedMinor,
          bill: payer.bill
        });
        if (!settlement?.success || settlement.status !== 'confirmed' || !settlement.explorerUrl) {
          const error = new Error('Settlement was not confirmed');
          error.code = 'TRANSACTION_NOT_CONFIRMED';
          throw error;
        }
        payer.payer.status = 'paid';
        attempt.status = 'paid';
        attempt.signature = settlement.signature;
        attempt.transactionUrl = settlement.explorerUrl;
        attempt.completedAt = new Date().toISOString();
        send(response, json(200, {
          status: 'paid',
          transactionUrl: settlement.explorerUrl
        }));
      } catch (error) {
        attempt.status = 'failed';
        attempt.error = error instanceof Error ? error.message.slice(0, 200) : 'Settlement failed';
        attempt.errorCode = error?.code || 'TRANSACTION_FAILED';
        attempt.completedAt = new Date().toISOString();
        send(response, json(502, { error: 'Settlement failed', code: attempt.errorCode }));
      }
      return;
    }

    send(response, json(404, { error: 'Route not found' }));
  } catch (error) {
    send(response, json(error.statusCode || 500, { error: error.statusCode ? error.message : 'Internal server error' }));
  }
};

// Find a payer by hashing the supplied bearer token.
const findPayer = (linkToken) => {
  const hash = tokenHash(linkToken);
  for (const bill of bills.values()) {
    const payer = bill.payers.find((candidate) => candidate.linkTokenHash === hash);
    if (payer) return { bill, payer };
  }
  return null;
};

// A link cannot be used after the bill expiry time.
const isExpired = (bill) => Date.now() >= Date.parse(bill.expiresAt);

export { bills, createApp, mockSettlementAdapter, settlementAttempts };

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  createServer(createApp()).listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}
