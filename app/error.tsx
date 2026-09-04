// Recoverable global client error state for LottoChain routes.
"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[68vh] max-w-3xl items-center px-4 py-16 text-center"><section className="glass w-full rounded-[26px] p-8 sm:p-12"><AlertTriangle className="mx-auto h-12 w-12 text-amber-400" /><h1 className="display-font mt-6 text-3xl font-semibold text-white">We couldn&apos;t load this view</h1><p className="mt-3 text-zinc-500">Your wallet and funds are unaffected. Try loading the indexed view again.</p><Button onClick={reset} className="primary-gradient primary-glow mt-7 h-11 rounded-xl px-6 font-semibold"><RefreshCw className="h-4 w-4" /> Try again</Button></section></main>;
}
