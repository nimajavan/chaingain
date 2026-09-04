// Security model and operational safeguards for LottoChain.
import { AlertTriangle, Check, KeyRound, Pause, RefreshCw, ServerCog, ShieldCheck } from "lucide-react";

const controls = [
  { icon: <KeyRound />, title: "No custodial keys", text: "The application backend holds no wallet or treasury private keys and cannot move player funds." },
  { icon: <ShieldCheck />, title: "Multisig treasury", text: "The production treasury must be a Safe multisig. A single operator cannot withdraw or redirect funds." },
  { icon: <RefreshCw />, title: "Reorg-safe indexing", text: "Events are indexed only after 32 confirmations using an idempotent transaction-hash and log-index key." },
  { icon: <Pause />, title: "Limited pause control", text: "The owner may pause new ticket sales. That role cannot change the split, select a winner, or access the pool." },
  { icon: <ServerCog />, title: "Read-only application", text: "The API mirrors confirmed events for speed. Contract state remains the source of financial truth." },
  { icon: <AlertTriangle />, title: "Failure paths", text: "Low participation triggers refunds. VRF timeout handling prevents a draw from becoming permanently stuck." },
];

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <section className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-violet-400">Threat-aware architecture</p><h1 className="display-font mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">Compromise the website.<br/>Funds still stay on-chain.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">The money path is deliberately smaller than the product. Ticket payments, randomness, refunds, and payouts remain inside the verified contract.</p></section>
      <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{controls.map((control) => <article key={control.title} className="glass glass-hover rounded-[22px] p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300 [&_svg]:h-5 [&_svg]:w-5">{control.icon}</span><h2 className="display-font mt-5 text-xl font-semibold text-white">{control.title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{control.text}</p></article>)}</section>
      <section className="glass mt-6 rounded-[24px] p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400"><Check className="h-6 w-6" /></span><div><h2 className="display-font text-2xl font-semibold text-white">Before mainnet</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-500">The interface is currently marked as a testnet preview. Mainnet launch remains blocked until contract tests, a sustained Amoy soak, treasury multisig verification, monitoring alarms, refund drills, jurisdictional controls, and an independent audit are complete.</p></div></div></section>
    </main>
  );
}
