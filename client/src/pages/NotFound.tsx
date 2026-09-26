import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
        <p className="text-xs font-medium tracking-[0.22em] text-oxblood uppercase">404</p>
        <h1 className="display mt-4 text-5xl">That page isn’t here.</h1>
        <p className="mt-4 max-w-md text-[15px] leading-7 text-muted-foreground">
          It may have been a private pay link, or the address is simply wrong.
        </p>
        <Link
          href="/"
          className="mt-10 inline-block text-sm text-oxblood no-underline hover:underline"
        >
          Back to Split
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
