import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ApiError, createBill } from "@/lib/api";
import type { CreateBillResponse } from "@/lib/bills";
import { formatMoney, fromCents, splitEvenly, toCents } from "@/lib/money";
import { useMemo, useState } from "react";

type Person = { id: string; name: string; amount: string };

function newPerson(name = "", amount = ""): Person {
  return { id: crypto.randomUUID(), name, amount };
}

function parseAmount(value: string): number {
  const cleaned = value.replace(",", ".").trim();
  if (!cleaned) return 0;
  return Number(cleaned);
}

export default function CreateBill() {
  const [title, setTitle] = useState("Dinner");
  const [creatorName, setCreatorName] = useState("");
  const [total, setTotal] = useState("90");
  const [people, setPeople] = useState<Person[]>([
    newPerson("Joel", "45.00"),
    newPerson("Aoife", "45.00"),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreateBillResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const totalCents = toCents(parseAmount(total));
  const assignedCents = people.reduce(
    (sum, person) => sum + toCents(parseAmount(person.amount) || 0),
    0
  );
  const remainder = Number.isInteger(totalCents) ? totalCents - assignedCents : 0;

  const evenPreview = useMemo(() => {
    if (!Number.isInteger(totalCents) || totalCents < 1 || people.length === 0) {
      return [];
    }
    return splitEvenly(totalCents, people.length);
  }, [people.length, totalCents]);

  function updatePerson(id: string, patch: Partial<Person>) {
    setPeople(current => current.map(person => (person.id === id ? { ...person, ...patch } : person)));
  }

  function splitEven() {
    if (evenPreview.length === 0) return;
    setPeople(current =>
      current.map((person, index) => ({
        ...person,
        amount: fromCents(evenPreview[index] ?? 0).toFixed(2),
      }))
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createBill({
        title,
        creatorName,
        total: parseAmount(total),
        payers: people.map(person => ({
          name: person.name,
          amount: parseAmount(person.amount),
        })),
      });
      setCreated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the split.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(url: string, token: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      window.setTimeout(() => setCopied(current => (current === token ? null : current)), 1600);
    } catch {
      setError("Could not copy that link.");
    }
  }

  if (created) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader action="none" />
        <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
          <p className="text-xs font-medium tracking-[0.22em] text-oxblood uppercase">Ready to send</p>
          <h1 className="display mt-4 text-4xl sm:text-5xl">{created.title}</h1>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
            {formatMoney(created.amountCents, created.currency)} · from {created.creatorName}.
            Send each person their own link.
          </p>

          <ul className="mt-10 divide-y divide-border border-y border-border">
            {created.shareLinks.map(link => (
              <li key={link.linkToken} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{link.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatMoney(link.amountCents, created.currency)} · {link.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyLink(link.url, link.linkToken)}
                  className="self-start rounded-full border border-border bg-transparent px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  {copied === link.linkToken ? "Copied" : "Copy link"}
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-muted-foreground">
            Keep this page open if you want to send the links from here. Each person
            can also open their link later.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader action="none" />
      <main className="mx-auto grid max-w-6xl gap-16 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:py-16">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-oxblood uppercase">
            Create a split
          </p>
          <h1 className="display mt-4 text-4xl sm:text-5xl">Who’s in, and what do they owe?</h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-muted-foreground">
            Enter the total, add names, and Split will make a private link for each
            person. Amounts have to add up. Currency is EUR, matching the backend.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          <label className="block">
            <span className="text-sm font-medium">What’s this for?</span>
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              className="mt-2 w-full border-0 border-b border-border bg-transparent px-0 py-3 text-lg outline-none focus:border-oxblood"
              maxLength={80}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Your name</span>
            <input
              value={creatorName}
              onChange={event => setCreatorName(event.target.value)}
              placeholder="The person who already paid"
              className="mt-2 w-full border-0 border-b border-border bg-transparent px-0 py-3 text-lg outline-none focus:border-oxblood"
              maxLength={80}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Total (EUR)</span>
            <input
              value={total}
              onChange={event => setTotal(event.target.value)}
              inputMode="decimal"
              className="mt-2 w-full border-0 border-b border-border bg-transparent px-0 py-3 text-lg outline-none focus:border-oxblood"
              required
            />
          </label>

          <div>
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm font-medium">People</p>
              <button
                type="button"
                onClick={splitEven}
                className="text-sm text-oxblood hover:underline"
              >
                Split evenly
              </button>
            </div>

            <ul className="mt-4 space-y-4">
              {people.map((person, index) => (
                <li key={person.id} className="grid grid-cols-[1fr_6.5rem_auto] items-end gap-3">
                  <label className="block">
                    <span className="sr-only">Name</span>
                    <input
                      value={person.name}
                      onChange={event => updatePerson(person.id, { name: event.target.value })}
                      placeholder={`Person ${index + 1}`}
                      className="w-full border-0 border-b border-border bg-transparent px-0 py-3 outline-none focus:border-oxblood"
                      maxLength={80}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Amount</span>
                    <input
                      value={person.amount}
                      onChange={event => updatePerson(person.id, { amount: event.target.value })}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full border-0 border-b border-border bg-transparent px-0 py-3 text-right outline-none focus:border-oxblood"
                      required
                    />
                  </label>
                  {people.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setPeople(current => current.filter(row => row.id !== person.id))}
                      className="mb-3 text-sm text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${person.name || `person ${index + 1}`}`}
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="mb-3 w-[4.5rem]" />
                  )}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setPeople(current => [...current, newPerson()])}
              className="mt-4 text-sm text-oxblood hover:underline"
            >
              Add a person
            </button>

            <p className="mt-4 text-sm text-muted-foreground">
              {Number.isInteger(totalCents)
                ? remainder === 0
                  ? "The amounts add up."
                  : `Off by ${formatMoney(Math.abs(remainder), "EUR")}.`
                : "Enter a total to continue."}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#02c9db] disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create links"}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
