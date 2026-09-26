import { Wordmark } from "@/components/SiteChrome";
import { ApiError, getPayView, settlePay } from "@/lib/api";
import type { PayViewResponse, PayerStatus } from "@/lib/bills";
import { formatMoney } from "@/lib/money";
import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";

const STATUS_COPY: Record<PayerStatus, string> = {
  pending: "Waiting",
  approved: "Approved",
  paid: "Paid",
};

const DEMO_PAYER_WALLET = "7xKX9pQm123456789ABCDEFGHJKLMNPQR";

export default function Pay() {
  const params = useParams<{ linkToken?: string }>();
  const linkToken = params.linkToken ?? "";
  const [view, setView] = useState<PayViewResponse | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [phase, setPhase] = useState<"idle" | "approved" | "paid">("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!linkToken) {
        setError("This link is missing.");
        setLoading(false);
        return;
      }
      try {
        const data = await getPayView(linkToken);
        if (cancelled) return;
        setView(data);
        if (data.status === "paid") setPhase("paid");
        else if (data.status === "approved") setPhase("approved");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "This link could not be opened.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [linkToken]);

  async function onPay() {
    if (!linkToken) return;
    setError(null);
    setPaying(true);
    setPhase("approved");
    try {
      const result = await settlePay(linkToken, DEMO_PAYER_WALLET);
      setReceiptUrl(result.transactionUrl);
      setView(current =>
        current
          ? { ...current, status: "paid", transactionUrl: result.transactionUrl }
          : current
      );
      setPhase("paid");
    } catch (err) {
      setPhase(view?.status === "paid" ? "paid" : "idle");
      setError(err instanceof ApiError ? err.message : "Payment did not go through.");
    } finally {
      setPaying(false);
    }
  }

  const receipt = receiptUrl || view?.transactionUrl;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-5 py-6 sm:px-8">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-16">
        {loading ? (
          <p className="mt-16 text-sm text-muted-foreground">Looking up your share…</p>
        ) : error && !view ? (
          <div className="mt-16">
            <h1 className="display text-4xl">This link has expired.</h1>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{error}</p>
            <Link href="/" className="mt-8 inline-block text-sm text-oxblood no-underline hover:underline">
              Back to Split
            </Link>
          </div>
        ) : view ? (
          <>
            <p className="text-xs font-medium tracking-[0.22em] text-oxblood uppercase">
              Your share
            </p>
            <h1 className="display mt-5 text-[4.2rem] leading-none">
              {formatMoney(view.amountCents, view.currency)}
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              Opened from a private payment link. Amount and status come from the backend.
            </p>

            <div className="mt-8 flex items-center justify-between border-y border-border py-4 text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">
                {STATUS_COPY[phase === "paid" ? "paid" : phase === "approved" ? "approved" : view.status]}
              </span>
            </div>

            {phase === "paid" && receipt ? (
              <div className="mt-10 space-y-4">
                <p className="text-lg font-medium">Paid.</p>
                <a
                  href={receipt}
                  className="inline-block text-sm text-oxblood underline-offset-4 hover:underline"
                  rel="noreferrer"
                  target="_blank"
                >
                  View receipt
                </a>
              </div>
            ) : (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => void onPay()}
                  disabled={paying}
                  className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#02c9db] disabled:opacity-60"
                >
                  {paying ? "Paying…" : "Pay"}
                </button>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Demo wallet until Privy is wired.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-6 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </>
        ) : null}
      </main>
      <footer className="px-5 py-8 text-sm text-muted-foreground sm:px-8">
        Split the bill. Keep the evening.
      </footer>
    </div>
  );
}
