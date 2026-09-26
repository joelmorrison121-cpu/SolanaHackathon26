import type {
  CreateBillResponse,
  PayViewResponse,
  SettleResponse,
} from "./bills";
import { publicWalletFromSeed } from "./wallet";

type ApiErrorBody = {
  error?: string;
  code?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.code || body.error || "failed",
      body.error || body.message || "Something went wrong."
    );
  }
  return body;
}

export async function createBill(input: {
  title: string;
  creatorName: string;
  total: number;
  payers: Array<{ name: string; amount: number }>;
}): Promise<CreateBillResponse> {
  const totalAmountMinor = Math.round(input.total * 100);
  const response = await fetch("/api/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creatorId: input.creatorName,
      creatorWallet: publicWalletFromSeed(input.creatorName),
      currency: "EUR",
      totalAmountMinor,
      payers: input.payers.map(payer => ({
        displayName: payer.name,
        amountOwedMinor: Math.round(payer.amount * 100),
      })),
    }),
  });
  const created = await parseResponse<{
    billId: string;
    payers: Array<{
      payerId: string;
      name: string;
      amount: number;
      linkToken: string;
    }>;
  }>(response);

  return {
    id: created.billId,
    title: input.title,
    currency: "EUR",
    amountCents: totalAmountMinor,
    creatorName: input.creatorName,
    shareLinks: created.payers.map(payer => ({
      name: payer.name,
      amountCents: payer.amount,
      status: "pending",
      url: `${window.location.origin}/pay/${payer.linkToken}`,
      linkToken: payer.linkToken,
    })),
  };
}

export async function getPayView(linkToken: string): Promise<PayViewResponse> {
  const response = await fetch(`/api/pay/${encodeURIComponent(linkToken)}`);
  const view = await parseResponse<{
    billId: string;
    payerId: string;
    currency: "EUR";
    amount: number;
    status: PayViewResponse["status"];
  }>(response);

  return {
    amountCents: view.amount,
    currency: "EUR",
    status: view.status,
    billId: view.billId,
    payerId: view.payerId,
    transactionUrl: null,
  };
}

export async function settlePay(
  linkToken: string,
  payerWallet: string
): Promise<SettleResponse> {
  const response = await fetch(`/api/pay/${encodeURIComponent(linkToken)}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payerWallet }),
  });
  return parseResponse<SettleResponse>(response);
}
