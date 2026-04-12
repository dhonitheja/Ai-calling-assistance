"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { name: "Command Center", href: "/command-center" },
    { name: "Training Studio", href: "/training-studio" },
    { name: "Work History", href: "/work-history" },
    { name: "Interview Mode", href: "/interview-mode" },
  ];

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="text-white font-mono font-bold text-lg tracking-wider">
          VOICE_AI_AGENT
        </div>
      </div>
      <div className="flex gap-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={clsx(
                "px-4 py-2 rounded-md font-mono text-sm transition-colors duration-200",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
              )}
            >
              {link.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
