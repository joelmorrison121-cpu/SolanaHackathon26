export const PAYER_STATUSES = ["pending", "approved", "paid"] as const;
export type PayerStatus = (typeof PAYER_STATUSES)[number];
export type Currency = "EUR";

export type ShareLink = {
  name: string;
  amountCents: number;
  status: PayerStatus;
  url: string;
  linkToken: string;
};

export type CreateBillResponse = {
  id: string;
  title: string;
  currency: Currency;
  amountCents: number;
  creatorName: string;
  shareLinks: ShareLink[];
};

export type PayViewResponse = {
  amountCents: number;
  currency: Currency;
  status: PayerStatus;
  billId: string;
  payerId: string;
  transactionUrl: string | null;
};

export type SettleResponse = {
  status: "paid";
  transactionUrl: string;
};
