// Public explanation of LottoChain randomness, payout math, and verification steps.
import Link from "next/link";
import { ArrowRight, Blocks, Check, Cpu, LockKeyhole, ShieldCheck } from "lucide-react";

export default function FairnessPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[.06] px-3 py-1.5 text-sm font-semibold text-emerald-300"><ShieldCheck className="h-4 w-4" /> Verifiable by anyone</span>
        <h1 className="display-font mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">Fairness you can prove,<br className="hidden sm:block" /> not just trust.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400">LottoChain keeps ticket sales, random selection, and payouts on-chain. The website displays that public record; it does not decide who wins.</p>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        <Principle icon={<Blocks />} title="Chain is the ledger" body="Ticket indices and pool amounts come from confirmed contract events. The application cannot invent financial state." />
        <Principle icon={<Cpu />} title="VRF is the selector" body="WINkLink VRF supplies the only random value used to choose a winning ticket on TRON. Local randomness is never used." />
        <Principle icon={<LockKeyhole />} title="Split cannot move" body="70% to the winner and 30% to the multisig treasury are hard-coded constants, unavailable to owner controls." />
      </section>

      <section className="glass mt-6 rounded-[26px] p-6 sm:p-9">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-400">Verification path</p>
            <h2 className="display-font mt-3 text-3xl font-semibold text-white">Recalculate the winner</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-500">For any completed draw, read the VRF random word and the final ordered ticket list from the chain. The contract applies one simple operation.</p>
            <div className="mono mt-6 overflow-x-auto rounded-2xl border border-violet-400/15 bg-violet-500/[.06] p-5 text-sm text-violet-100">winningIndex = randomWord % ticketCount</div>
          </div>
          <ol className="space-y-3">
            <VerifyStep number="1" title="Open the fulfillment transaction" body="Confirm the VRF coordinator fulfilled the request linked to that draw." />
            <VerifyStep number="2" title="Read the random word" body="Use the exact uint256 value emitted with the finished draw event." />
            <VerifyStep number="3" title="Apply the modulo" body="Divide by the final ticket count and keep the remainder." />
            <VerifyStep number="4" title="Match the ticket index" body="The address holding that indexed ticket is the winner entitled to claim the payout." />
          </ol>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="glass rounded-[22px] p-6"><p className="text-sm font-semibold text-amber-300">Payout math</p><p className="mono mt-4 rounded-xl bg-black/20 p-4 text-sm leading-7 text-zinc-300">treasury = pool × 3000 / 10000<br/>winner = pool − treasury</p><p className="mt-4 text-sm leading-6 text-zinc-500">Subtraction after integer division ensures the full token balance is allocated without a rounding remainder.</p></div>
        <div className="glass rounded-[22px] p-6"><p className="text-sm font-semibold text-emerald-300">Refund guarantee</p><p className="mt-4 text-sm leading-7 text-zinc-400">If fewer than 500 players enter before the deadline, the contract returns each wallet&apos;s exact spend. The treasury cannot claim an incomplete pool.</p><div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-300"><Check className="h-4 w-4" /> Contract-enforced, not support-operated</div></div>
      </section>

      <div className="mt-10 flex justify-center"><Link href="/draws/1042" className="focus-ring primary-gradient primary-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white">Inspect a complete proof <ArrowRight className="h-4 w-4" /></Link></div>
    </main>
  );
}

function Principle({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <article className="glass glass-hover rounded-[22px] p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300 [&_svg]:h-5 [&_svg]:w-5">{icon}</span><h2 className="display-font mt-5 text-xl font-semibold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{body}</p></article>;
}

function VerifyStep({ number, title, body }: { number: string; title: string; body: string }) {
  return <li className="flex gap-4 rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><span className="display-font flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-sm font-semibold text-violet-300">{number}</span><div><h3 className="font-semibold text-zinc-200">{title}</h3><p className="mt-1 text-sm leading-6 text-zinc-500">{body}</p></div></li>;
}
