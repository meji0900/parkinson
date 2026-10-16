// The page frame, shared by the CSS (app/globals.css, .frame) and the tissue field, which keeps its neurons out
// of the reading area. Change both together.
export const FRAME = {
  /** widest the frame gets, in px */
  max: 1320,
  /** side padding of the frame */
  pad: 40,
  /** the section rail on the left */
  rail: 188,
  /** gap between the rail and the text */
  gap: 56,
  /** the text column */
  col: 720,
  /** below this width the rail goes and the page is one centred column */
  breakpoint: 1100,
} as const;
