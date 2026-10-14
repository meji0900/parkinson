// A neuron as it looks under hematoxylin: one soma, six dendrites (the six readers), one axon.
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden fill="none" strokeLinecap="round">
      <g stroke="#2a1e45" strokeWidth="1.6">
        <path d="M16 13 L9 5 M16 13 L4 12 M16 13 L7 20" />
        <path d="M16 13 L23 5 M16 13 L28 11 M16 13 L25 20" />
        <path d="M16 16 C16 21 18 24 17 30" />
      </g>
      <circle cx="16" cy="13.5" r="4.2" fill="#c63d74" />
      <circle cx="16" cy="13.5" r="1.5" fill="#2a1e45" />
    </svg>
  );
}
