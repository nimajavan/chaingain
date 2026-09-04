// Friendly fallback for missing LottoChain routes.
import Link from "next/link";
import { ArrowLeft, Ticket } from "lucide-react";

export default function NotFound() {
  return <main className="mx-auto flex min-h-[68vh] max-w-3xl items-center px-4 py-16 text-center"><section className="glass w-full rounded-[26px] p-8 sm:p-12"><Ticket className="mx-auto h-12 w-12 text-violet-400" /><p className="display-font mt-6 text-7xl font-bold text-white">404</p><h1 className="display-font mt-4 text-2xl font-semibold text-white">This ticket leads nowhere</h1><p className="mt-3 text-zinc-500">The page may have moved, or the draw number does not exist.</p><Link href="/" className="focus-ring primary-gradient primary-glow mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"><ArrowLeft className="h-4 w-4" /> Back to live draw</Link></section></main>;
}
