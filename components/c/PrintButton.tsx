"use client";

export function PrintButton() {
  return (
    <button className="btn-primary" onClick={() => window.print()}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" /></svg>
      Print poster
    </button>
  );
}
