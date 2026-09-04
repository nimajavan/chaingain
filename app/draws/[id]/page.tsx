// Verifiable LottoChain draw result with payout split and VRF evidence.
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, ShieldCheck, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { drawHistory, formatUsdc, shortAddress, TREASURY_BPS } from "../../data";
import { useLotto } from "../../components/client-shell";

const confettiColors = ["#F59E0B", "#A855F7", "#10B981", "#FDE68A", "#7C3AED"];

export default function DrawResultPage() {
  const params = useParams<{ id: string }>();
  const { account } = useLotto();
  const draw = drawHistory.find((entry) => String(entry.id) === params.id) ?? drawHistory[0];
  const isYou = account?.toLowerCase() === draw.winner.toLowerCase();
  const total = draw.prize * 10_000n / (10_000n - TREASURY_BPS);
  const treasury = total - draw.prize;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <main className="relative min-h-[70vh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => (
          <span key={index} className="confetti-piece absolute -top-6 block rounded-sm" style={{ left: `${(index * 37) % 100}%`, width: `${6 + (index % 3) * 2}px`, height: `${11 + (index % 4) * 2}px`, backgroundColor: confettiColors[index % confettiColors.length], animationDelay: `${(index % 9) * .18}s`, animationDuration: `${3.2 + (index % 5) * .28}s` }} />
        ))}
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <Link href="/history" className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-medium text-zinc-500 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> All draws</Link>

        <section className="mt-8 text-center">
          <div className="trophy-float mx-auto flex h-22 w-22 items-center justify-center rounded-[26px] border border-amber-300/20 bg-amber-400/10 text-amber-300 shadow-[0_0_60px_rgba(245,158,11,.18)]"><Trophy className="h-11 w-11" strokeWidth={1.7} /></div>
          <p className="mt-7 text-sm font-semibold uppercase tracking-[.22em] text-emerald-400">Draw #{draw.id} complete</p>
          <h1 className="display-font mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">We have a winner</h1>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/[.08] bg-white/[.035] px-4 py-3 sm:px-6">
            <span className="mono text-sm text-zinc-200 sm:text-base">{shortAddress(draw.winner)}</span>
            {isYou && <span className="rounded-md bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-300">YOU 🎉</span>}
            <button onClick={() => copy(draw.winner, "Winner address")} className="focus-ring rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[.06] hover:text-white" aria-label="Copy winner address"><Copy className="h-4 w-4" /></button>
          </div>
          <p className="mt-8 text-sm uppercase tracking-[.16em] text-zinc-600">Winner payout</p>
          <p className="display-font gold-text mt-2 text-5xl font-bold tracking-tight sm:text-7xl">${formatUsdc(draw.prize)}</p>
          <p className="mono mt-2 text-sm text-zinc-500">{formatUsdc(draw.prize)} USDC</p>
        </section>

        <section className="glass mt-12 rounded-[24px] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-zinc-500">Contract-enforced payout</p><h2 className="display-font mt-1 text-2xl font-semibold text-white">70 / 30 split</h2></div><p className="mono text-sm text-zinc-500">Total pool: {formatUsdc(total)} USDC</p></div>
          <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-white/[.05]"><div className="w-[70%] bg-gradient-to-r from-amber-500 to-amber-300" /><div className="w-[30%] bg-gradient-to-r from-violet-600 to-fuchsia-500" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SplitCard color="amber" label="Winner · 70%" value={`${formatUsdc(draw.prize)} USDC`} />
            <SplitCard color="violet" label="Treasury · 30%" value={`${formatUsdc(treasury)} USDC`} />
          </div>
        </section>

        <section className="glass mt-5 rounded-[24px] p-5 sm:p-7" aria-labelledby="proof-heading">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400"><ShieldCheck className="h-6 w-6" /></span>
            <div><div className="flex flex-wrap items-center gap-2"><h2 id="proof-heading" className="display-font text-xl font-semibold text-white">Chainlink VRF proof</h2><span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/[.08] px-2 py-1 text-xs font-semibold text-emerald-300"><Check className="h-3 w-3" /> Verified on-chain</span></div><p className="mt-2 text-sm leading-6 text-zinc-500">The returned random word maps deterministically to the winning ticket index.</p></div>
          </div>
          <dl className="mt-6 space-y-3">
            <ProofRow label="Random word" value={draw.randomWord} onCopy={() => copy(draw.randomWord, "Random word")} />
            <ProofRow label="Fulfillment tx" value={draw.txHash} onCopy={() => copy(draw.txHash, "Transaction hash")} />
          </dl>
          <p className="mt-4 rounded-xl bg-amber-400/[.06] px-4 py-3 text-xs leading-5 text-amber-100/60">Preview evidence is illustrative. Explorer links activate after the Amoy contracts and Chainlink subscription are deployed.</p>
        </section>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button disabled variant="outline" className="h-11 rounded-xl border-white/[.09] bg-white/[.035] px-5 text-zinc-400"><ExternalLink className="h-4 w-4" /> Explorer pending deployment</Button>
          <Button asChild className="primary-gradient primary-glow h-11 rounded-xl px-6 font-semibold"><Link href="/">Enter next draw</Link></Button>
        </div>
      </div>
    </main>
  );
}

function SplitCard({ color, label, value }: { color: "amber" | "violet"; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color === "amber" ? "bg-amber-400" : "bg-violet-500"}`} /><p className="text-sm text-zinc-500">{label}</p></div><p className="display-font mt-2 text-xl font-semibold text-white">{value}</p></div>;
}

function ProofRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return <div className="grid gap-2 rounded-xl border border-white/[.06] bg-black/15 p-4 sm:grid-cols-[130px_1fr_auto] sm:items-center"><dt className="text-xs font-medium uppercase tracking-wider text-zinc-600">{label}</dt><dd className="mono overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-400">{value}</dd><button onClick={onCopy} className="focus-ring justify-self-start rounded-lg p-1.5 text-zinc-600 transition hover:bg-white/[.05] hover:text-white sm:justify-self-auto" aria-label={`Copy ${label}`}><Copy className="h-4 w-4" /></button></div>;
}
