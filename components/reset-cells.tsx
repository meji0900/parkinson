"use client";
// Regrows the neurons in the margins.
export function ResetCells() {
  return (
    <button type="button" className="reset" onClick={() => window.dispatchEvent(new Event("james:reset"))}>
      reset cells
    </button>
  );
}
