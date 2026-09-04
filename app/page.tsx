// Live LottoChain draw dashboard with countdown, pool, activity, and purchase entry.
"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Blocks,
  Check,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLotto } from "./components/client-shell";
import { formatUsdt, LOTTERY_CONTRACT_PENDING, recentActivity, shortAddress, TICKET_PRICE, TRON_USDT_ADDRESS } from "./data";

const targetPrize = 17_640_000_000n;

export default function Home() {
  const { account, openBuy, isLive } = useLotto();
  const [prize, setPrize] = useState(0n);
  const [countdown, setCountdown] = useState({ days: 1, hours: 8, minutes: 42, seconds: 19 });
  const deadlineRef = useRef(0);

  useEffect(() => {
    const animation = window.setInterval(() => {
      setPrize((current) => {
        if (current >= targetPrize) {
          window.clearInterval(animation);
          return targetPrize;
        }
        const gap = targetPrize - current;
        return current + (gap / 8n > 1n ? gap / 8n : 1n);
      });
    }, 55);
    return () => window.clearInterval(animation);
  }, []);

  useEffect(() => {
    deadlineRef.current = Date.now() + ((1 * 24 + 8) * 60 * 60 + 42 * 60 + 19) * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      setCountdown({
        days: Math.floor(remaining / 86_400_000),
        hours: Math.floor((remaining % 86_400_000) / 3_600_000),
        minutes: Math.floor((remaining % 3_600_000) / 60_000),
        seconds: Math.floor((remaining % 60_000) / 1000),
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main>
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pt-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${isLive ? "border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300" : "border-amber-400/15 bg-amber-400/[.06] text-amber-300"}`}>
            <span className={`h-2 w-2 rounded-full ${isLive ? "live-dot bg-emerald-400" : "bg-amber-400"}`} /> {isLive ? "TRON Mainnet contract configured" : "Production launch gate"}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-1.5 text-xs font-medium text-emerald-200/80">
            <CircleDollarSign className="h-3.5 w-3.5" /> USDT only · TRON Mainnet
          </div>
        </div>

        <section className="grid items-stretch gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <div className="glass relative overflow-hidden rounded-[26px] p-5 sm:p-8 lg:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/[.07] blur-3xl" />
            <div className="relative">
              <p className="text-sm font-medium uppercase tracking-[.2em] text-zinc-500">Illustrative launch pool</p>
              <div className="prize-bump display-font gold-text mt-3 text-[clamp(3.25rem,9vw,6.75rem)] font-bold leading-none tracking-[-.055em]" aria-live="polite">
                ${formatUsdt(prize)}
              </div>
              <p className="mono mt-3 text-sm text-zinc-500">{formatUsdt(prize)} USDT · sample display, not a live balance</p>

              <div className="mt-8">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300"><Clock3 className="h-4 w-4 text-violet-400" /> Draw closes in</div>
                <div className="grid max-w-xl grid-cols-4 gap-2 sm:gap-3" aria-live="polite" aria-label={`${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes ${countdown.seconds} seconds remaining`}>
                  <TimeBox label="Days" value={countdown.days} />
                  <TimeBox label="Hours" value={countdown.hours} />
                  <TimeBox label="Minutes" value={countdown.minutes} />
                  <TimeBox label="Seconds" value={countdown.seconds} />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button onClick={openBuy} className="primary-gradient primary-glow h-13 rounded-xl px-7 text-base font-semibold hover:brightness-110 sm:min-w-60">
                  <Ticket className="h-5 w-5" /> Buy Ticket — {formatUsdt(TICKET_PRICE)} USDT
                </Button>
                <Link href="/fairness" className="focus-ring flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium text-zinc-400 transition hover:bg-white/[.04] hover:text-zinc-100">
                  Verify the draw <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid gap-3 border-t border-white/[.07] pt-6 sm:grid-cols-3">
                <StatChip icon={<Ticket />} label="Tickets sold" value="3,784" />
                <StatChip icon={<Users />} label="Unique players" value="1,142" />
                <StatChip icon={<Sparkles />} label="Your odds" value={account ? "1 in 3,784" : "Connect to see"} />
              </div>
            </div>
          </div>

          <aside className="glass flex min-h-[470px] flex-col rounded-[26px] p-5 sm:p-6" aria-labelledby="activity-heading">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-violet-400" /><h2 id="activity-heading" className="display-font font-semibold text-white">Live activity</h2></div>
                <p className="mt-1 text-xs text-zinc-500">Sample TRON event stream</p>
              </div>
              <RefreshCw className="h-4 w-4 text-zinc-600" />
            </div>
            <div className="mt-5 flex-1 divide-y divide-white/[.06]" aria-live="polite">
              {recentActivity.map((item, index) => (
                <div key={item.txHash} className="feed-in flex items-center gap-3 py-4" style={{ animationDelay: `${index * 70}ms` }}>
                  <span className="primary-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white">{item.quantity}</span>
                  <div className="min-w-0 flex-1"><p className="mono truncate text-sm text-zinc-300">{item.address}</p><p className="mt-0.5 text-xs text-zinc-600">bought {item.quantity} ticket{item.quantity > 1 ? "s" : ""}</p></div>
                  <span className="text-xs text-zinc-600">{item.age}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 border-t border-white/[.06] pt-4 text-xs text-zinc-600"><Blocks className="h-3.5 w-3.5" /> 32-block confirmation safety</p>
          </aside>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_.48fr]">
          <div className="glass rounded-[22px] p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-sm font-medium text-zinc-200">3,784 of 5,000 tickets claimed</p><p className="mt-1 text-sm text-zinc-500">Minimum participation threshold passed</p></div>
              <span className="display-font text-2xl font-semibold text-white">75.7%</span>
            </div>
            <Progress value={75.68} className="mt-5 h-3 bg-white/[.06] [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-violet-600 [&_[data-slot=progress-indicator]]:to-fuchsia-500" />
            <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-zinc-500"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-400" /> If a draw closes below 500 players, every purchase is refunded by the contract.</div>
          </div>
          <div className="glass rounded-[22px] p-5 sm:p-6">
            <p className="text-sm text-zinc-500">Projected winner payout</p>
            <p className="display-font gold-text mt-2 text-3xl font-semibold">$12,348</p>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="w-[70%] bg-amber-400" /><div className="w-[30%] bg-violet-500" /></div>
            <div className="mt-3 flex justify-between text-xs"><span className="text-amber-300">70% winner</span><span className="text-violet-300">30% treasury</span></div>
          </div>
        </section>

        <section className="py-20" aria-labelledby="how-heading">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-400">One transparent flow</p>
            <h2 id="how-heading" className="display-font mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">How every draw works</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StepCard number="01" icon={<Wallet />} title="Connect" body="Use your wallet. No email, password, or custodial account." />
            <StepCard number="02" icon={<Ticket />} title="Buy tickets" body="Approve the exact USDT total on TRON, then enter the active draw." />
            <StepCard number="03" icon={<Sparkles />} title="VRF selects" body="WINkLink delivers randomness that anyone can verify on TRON." />
            <StepCard number="04" icon={<CircleDollarSign />} title="Contract allocates" body="70% becomes claimable by the winner and 30% by the treasury." />
          </div>
        </section>

        <section className="glass relative overflow-hidden rounded-[26px] p-6 sm:p-9">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-violet-500/[.08] to-transparent" />
          <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-2xl items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400"><LockKeyhole className="h-6 w-6" /></span>
              <div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Check className="h-4 w-4" /> Provably fair by design</p><h2 className="display-font mt-2 text-2xl font-semibold text-white">Don&apos;t trust a promise. Verify the proof.</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Winner selection comes from WINkLink VRF. The 70/30 split is hard-coded, and the application never takes custody of funds.</p></div>
            </div>
            <Link href="/draws/1042" className="focus-ring flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-5 py-3 text-sm font-semibold text-white transition hover:border-violet-400/30 hover:bg-white/[.08]">Inspect last proof <ExternalLink className="h-4 w-4" /></Link>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-zinc-600">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> WINkLink VRF</span>
          <span className="flex items-center gap-2"><Blocks className="h-4 w-4" /> TRON Mainnet</span>
          <span className="mono flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> USDT: {shortAddress(TRON_USDT_ADDRESS)}</span>
          <span className="mono flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Lottery: {shortAddress(LOTTERY_CONTRACT_PENDING)}</span>
        </div>
      </div>
    </main>
  );
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl border border-white/[.07] bg-black/20 px-2 py-3 text-center sm:px-4"><div className="display-font text-2xl font-semibold tabular-nums text-white sm:text-3xl">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-600 sm:text-xs">{label}</div></div>;
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-white/[.025] px-3 py-3 text-zinc-400 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-violet-400"><span>{icon}</span><div><p className="text-xs text-zinc-600">{label}</p><p className="display-font mt-0.5 text-sm font-semibold text-zinc-200">{value}</p></div></div>;
}

function StepCard({ number, icon, title, body }: { number: string; icon: React.ReactNode; title: string; body: string }) {
  return <article className="glass glass-hover rounded-[20px] p-5"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300 [&_svg]:h-5 [&_svg]:w-5">{icon}</span><span className="mono text-xs text-zinc-700">{number}</span></div><h3 className="display-font mt-5 text-lg font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{body}</p></article>;
}
