"use client";
import { useEffect, useState } from "react";
import { Slip, verify, type Receipt } from "./receipts";

export function ReceiptCheck({ r }: { r: Receipt }) {
  const [ok, setOk] = useState<boolean | undefined>(undefined);
  useEffect(() => { verify(r).then(setOk); }, [r]);
  return <ol className="slips single-slip"><Slip r={r} ok={ok} link={false} /></ol>;
}
