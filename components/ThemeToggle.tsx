"use client";

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={toggle} className="btn-ghost px-3" aria-label="Toggle dark mode">
      <span className="dark:hidden" aria-hidden>☾</span>
      <span className="hidden dark:inline" aria-hidden>☀</span>
    </button>
  );
}
