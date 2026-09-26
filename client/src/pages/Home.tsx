import { PayPhone } from "@/components/PayPhone";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Link } from "wouter";
import { lazy, Suspense } from "react";

const HyperspeedBackdrop = lazy(() => import("@/components/HyperspeedBackdrop"));

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <section className="relative min-h-[100svh] overflow-hidden">
        <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
          <HyperspeedBackdrop />
        </Suspense>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black" />

        <div className="pointer-events-none relative z-10 flex min-h-[100svh] flex-col">
          <div className="pointer-events-auto">
            <SiteHeader />
          </div>
          <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="pointer-events-auto max-w-2xl">
              <p className="text-xs font-medium tracking-[0.28em] text-primary uppercase">
                Hold to speed up
              </p>
              <h1 className="display mt-6 text-[3.2rem] text-white sm:text-[5rem] lg:text-[5.6rem]">
                Someone already paid. You tap Pay.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                One person pays for dinner and creates a split. Everyone else gets a
                link, signs in, and settles their share. No app to download. No
                account to remember.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/new"
                  className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-[#02c9db]"
                >
                  Create a split
                </Link>
                <a
                  href="#how"
                  className="text-sm text-white/70 no-underline hover:text-white"
                >
                  See how it works
                </a>
              </div>
            </div>
            <div className="pointer-events-auto lg:justify-self-end">
              <PayPhone />
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-white/10 bg-black">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:py-28">
          <div>
            <p className="text-xs font-medium tracking-[0.28em] text-primary uppercase">
              How it works
            </p>
            <h2 className="display mt-4 text-4xl text-white sm:text-5xl">Three taps. Then dinner.</h2>
          </div>
          <ol className="space-y-10">
            {[
              {
                n: "01",
                title: "Someone pays.",
                body: "They enter the total, add names, and Split writes a link for each person at the table.",
              },
              {
                n: "02",
                title: "You get a link.",
                body: "Open it on your phone. It already knows who you are and what you owe.",
              },
              {
                n: "03",
                title: "You tap Pay.",
                body: "Sign in if you haven’t already. The money moves. That’s the whole job.",
              },
            ].map(step => (
              <li key={step.n} className="grid grid-cols-[4.5rem_1fr] gap-6 border-t border-white/10 pt-8 first:border-t-0 first:pt-0">
                <span className="font-medium text-primary">{step.n}</span>
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-white">{step.title}</h3>
                  <p className="mt-2 max-w-lg text-[15px] leading-7 text-white/65">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="different" className="border-t border-white/10 bg-[#080808]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-[0.28em] text-primary uppercase">
              Why it feels different
            </p>
            <h2 className="display mt-4 text-4xl text-white sm:text-5xl">Nothing extra to learn.</h2>
            <p className="mt-6 text-[15px] leading-7 text-white/65">
              No new account to create, no fee to calculate, no long number to copy.
              Your order stays yours — names and notes never leave the app.
            </p>
          </div>

          <dl className="mt-16 max-w-2xl space-y-10">
            {[
              {
                title: "No setup",
                body: "Open the link. Sign in. Pay. There is nothing to install and nothing to configure.",
              },
              {
                title: "No arithmetic",
                body: "Fees and transfer details stay out of the way. You see the amount. You tap Pay.",
              },
              {
                title: "No leftover details",
                body: "Who ordered what stays off the public record. Privacy is the default, not a setting.",
              },
            ].map(item => (
              <div key={item.title} className="border-t border-white/10 pt-6">
                <dt className="text-lg font-medium tracking-tight text-white">{item.title}</dt>
                <dd className="mt-2 text-[15px] leading-7 text-white/65">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="under-the-hood" className="border-t border-white/10 bg-black">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="text-xs font-medium tracking-[0.28em] text-white/40 uppercase">
            Under the hood
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">
            First sign-in creates an embedded Solana wallet. The payer grants a
            capped, revocable allowance in USDC for exactly the amount owed. Split
            pulls that amount and nothing more. Names, dishes, and notes stay in
            our database, not on-chain.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-end">
          <h2 className="display max-w-xl text-4xl text-white sm:text-5xl">
            If you’re holding the bill, start here.
          </h2>
          <Link
            href="/new"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-[#02c9db]"
          >
            Create a split
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
