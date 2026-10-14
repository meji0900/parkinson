"use client";
import { useEffect, useState } from "react";
import { Slip, verify, type Receipt } from "./receipts";

export function ReceiptCheck({ r }: { r: Receipt }) {
  const [ok, setOk] = useState<boolean | undefined>(undefined);
  useEffect(() => { verify(r).then(setOk); }, [r]);
  return <ul className="slips" style={{ gridAutoColumns: "minmax(0, 340px)" }}><Slip r={r} ok={ok} link={false} /></ul>;
}
