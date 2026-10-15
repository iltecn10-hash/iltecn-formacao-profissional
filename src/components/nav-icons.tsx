/** Ícones do menu (SVG próprio, sem biblioteca). Traço simples e consistente. */
const PATHS: Record<string, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M10 21v-6h4v6"],
  mail: ["M3 6h18v12H3z", "m3 7 9 6 9-6"],
  flask: ["M9 3h6", "M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"],
  game: ["M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.2 2L15 14H9l-1.8 2A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4z", "M8 10v3M6.5 11.5h3", "M16 11h.01M18 13h.01"],
  book: ["M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z", "M4 19V5", "M9 7h6"],
  file: ["M7 3h7l5 5v13H7z", "M14 3v5h5", "M10 13h6M10 17h6"],
  trophy: ["M8 4h8v5a4 4 0 0 1-8 0z", "M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4", "M12 13v4M8 21h8M10 17h4"],
  award: ["M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z", "m8.5 14.5-1.5 6.5 5-3 5 3-1.5-6.5"],
  wallet: ["M3 7a2 2 0 0 1 2-2h13v4", "M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2", "M16 14h.01"],
  box: ["M21 8 12 3 3 8v8l9 5 9-5z", "m3 8 9 5 9-5M12 13v8"],
  dollar: ["M12 3v18", "M16.5 7.5C16 6 14.3 5 12 5c-2.5 0-4.5 1.2-4.5 3.2 0 4.3 9 2.3 9 6.6 0 2-2 3.2-4.5 3.2-2.4 0-4.2-1.1-4.7-2.8"],
  clipboard: ["M9 4h6v3H9z", "M7 5H5v16h14V5h-2", "m9 14 2 2 4-4"],
  chart: ["M4 20V4", "M4 20h16", "M8 16v-4M12 16V8M16 16v-6"],
  building: ["M4 21V5l8-2 8 2v16", "M9 21v-4h6v4", "M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  users: ["M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.3 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  close: ["M6 6l12 12M18 6 6 18"],
};

export type IconName = keyof typeof PATHS;

export function NavIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
