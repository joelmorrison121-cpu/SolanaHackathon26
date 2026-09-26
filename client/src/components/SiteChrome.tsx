import { Link } from "wouter";

function SplitMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M34 6H18a14 14 0 0 0 0 28h8a6 6 0 0 1 0 12H10v8h16a14 14 0 0 0 0-28h-8a6 6 0 0 1 0-12h16V6Z" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 text-white no-underline ${className}`}
      aria-label="Split"
    >
      <SplitMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
      <span className="display text-[1.35rem] leading-none tracking-tight">Split</span>
    </Link>
  );
}

export function SiteHeader({ action }: { action?: "create" | "none" }) {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-6 text-sm">
          <a
            href="/#how"
            className="hidden text-white/60 no-underline transition-colors hover:text-white sm:inline"
          >
            How it works
          </a>
          {action !== "none" && (
            <Link
              href="/new"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-[#02c9db]"
            >
              Create a split
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm leading-6 text-white/50">
            Split the bill. Keep the evening.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/50">
          <a href="/#how" className="no-underline hover:text-white">
            How it works
          </a>
          <a href="/#different" className="no-underline hover:text-white">
            Why it feels different
          </a>
          <a href="/#under-the-hood" className="no-underline hover:text-white">
            Under the hood
          </a>
          <Link href="/new" className="no-underline hover:text-white">
            Create a split
          </Link>
        </div>
      </div>
    </footer>
  );
}
