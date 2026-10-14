"use client";
import type { ReactNode } from "react";
import { LiveProvider } from "@/components/live";
import { Wallets } from "@/components/wallet";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Wallets>
      <LiveProvider>{children}</LiveProvider>
    </Wallets>
  );
}
