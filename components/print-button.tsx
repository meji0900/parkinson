"use client";
export function PrintButton() {
  return <button type="button" className="copy" style={{ marginLeft: 0 }} onClick={() => window.print()}>print or save as PDF</button>;
}
