"use client";
// Sends a gene to the console on the home page (or opens the home page with it).
export function Replay({ gene, children = "Replay" }: { gene: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      className="btn line sm"
      onClick={() => {
        if (document.getElementById("live")) {
          document.getElementById("live")!.scrollIntoView({ behavior: "smooth", block: "start" });
          window.dispatchEvent(new CustomEvent("engram:investigate", { detail: gene }));
        } else {
          window.location.href = `/?gene=${encodeURIComponent(gene)}#live`;
        }
      }}
    >
      {children}
    </button>
  );
}
