const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isBase58PublicKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
  );
}

function fnv1a(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Demo-only public address derived from a login id or name.
 * This is not a Solana keypair and never produces a private key or seed phrase.
 */
export function publicWalletFromSeed(seed: string): string {
  const source = seed.trim() || "split-demo";
  let chars = "";
  let state = fnv1a(`split-public:${source}`);
  while (chars.length < 44) {
    state = fnv1a(`${state}:${chars.length}:${source}`);
    chars += BASE58[state % BASE58.length];
  }
  return chars;
}
