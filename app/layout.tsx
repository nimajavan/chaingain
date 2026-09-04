// Root metadata and shared application shell for LottoChain.
import type { Metadata } from "next";
import "./globals.css";
import { ClientShell } from "./components/client-shell";

export const metadata: Metadata = {
  title: { default: "LottoChain — Provably fair on-chain draws", template: "%s · LottoChain" },
  description: "A transparent on-chain lottery using USDT on TRON and verifiable WINkLink randomness.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lotteryAddress = process.env.TRON_LOTTERY_ADDRESS ?? "";
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <ClientShell lotteryAddress={lotteryAddress}>{children}</ClientShell>
      </body>
    </html>
  );
}
