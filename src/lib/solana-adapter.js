import { randomUUID } from 'node:crypto';

// These mocks use Person 1's confirmed argument and result shapes.
// Replace the function bodies with real Solana code when it is ready.

const mockSignature = () => `MOCK_${randomUUID()}`;

const fundTestWallet = async ({ walletAddress, tokenAmountCents }) => ({
  success: true,
  status: 'confirmed',
  signature: mockSignature(),
  explorerUrl: 'https://explorer.solana.com/tx/mock?cluster=devnet',
  walletAddress,
  amountCents: tokenAmountCents
});

const checkApproval = async ({ payerWallet, amountCents }) => ({
  success: true,
  approved: true,
  payerWallet,
  amountCents
});

const settlePayment = async ({ payerWallet, creatorWallet, amountCents }) => ({
  success: true,
  status: 'confirmed',
  signature: mockSignature(),
  explorerUrl: 'https://explorer.solana.com/tx/mock?cluster=devnet',
  amountCents,
  payerWallet,
  creatorWallet
});

export { checkApproval, fundTestWallet, settlePayment };
