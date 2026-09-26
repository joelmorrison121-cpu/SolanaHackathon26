export function PayPhone() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      <div className="rounded-[2.2rem] border border-white/15 bg-black/50 p-3 shadow-[0_30px_80px_-20px_rgba(3,179,195,0.35)] backdrop-blur-md">
        <div className="rounded-[1.7rem] bg-[#0a0a0a] px-5 pb-6 pt-4">
          <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-white/15" />
          <p className="text-[11px] font-medium tracking-[0.18em] text-primary uppercase">
            From Maya
          </p>
          <p className="display mt-4 text-[2.6rem] text-white">€30</p>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Dinner at The Fumbally.
            <br />
            Your share of €90.
          </p>
          <div className="mt-8 rounded-full bg-primary py-3 text-center text-sm font-medium text-primary-foreground">
            Pay
          </div>
          <p className="mt-4 text-center text-[11px] text-white/40">
            Signed in as joel
          </p>
        </div>
      </div>
    </div>
  );
}
