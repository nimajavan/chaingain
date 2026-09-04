// No-draw and paused-contract system states.
import Link from "next/link";
import { Clock3, Pause, ShieldCheck } from "lucide-react";

export default async function StatusPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const paused = state === "paused";
  return <main className="mx-auto flex min-h-[68vh] max-w-3xl items-center px-4 py-16 text-center"><section className="glass w-full rounded-[26px] p-8 sm:p-12"><span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${paused ? "bg-amber-400/10 text-amber-300" : "bg-violet-500/10 text-violet-300"}`}>{paused ? <Pause className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}</span><h1 className="display-font mt-6 text-3xl font-semibold text-white">{paused ? "Ticket sales are paused" : "No active draw right now"}</h1><p className="mx-auto mt-3 max-w-lg text-base leading-7 text-zinc-500">{paused ? "New purchases are temporarily disabled. Existing pool funds remain protected by the contract and owner controls cannot withdraw them." : "The next draw will appear after the current cycle settles and its on-chain state is confirmed."}</p><div className="mt-6 flex items-center justify-center gap-2 text-sm text-emerald-300"><ShieldCheck className="h-4 w-4" /> Funds remain non-custodial</div><Link href="/history" className="focus-ring mt-7 inline-flex rounded-xl border border-white/[.09] bg-white/[.04] px-5 py-3 text-sm font-semibold text-zinc-200">View completed draws</Link></section></main>;
}
