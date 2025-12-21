"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";

const baseLinkStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
  transition: "all 0.2s ease",
  outline: "none",
};

export default function NavBar() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/live", label: "Live" },
    { href: "/breaking", label: "Breaking" },
    { href: "/trends", label: "Trends" },
    { href: "/sentiment", label: "Sentiment" },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#628ECB",
        borderBottom: "1px solid #8AAEE0",
        backdropFilter: "blur(12px)",
      }}
    >
      <nav
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            fontWeight: 770,
            fontSize: 29,
            color: "#FFFFFF",
            textDecoration: "none",
            letterSpacing: 0.3,
          }}
        >
          <h1 style={{ margin: 0 }}>News Streaming</h1>
        </Link>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {navLinks.map(({ href, label }) => {
            const active = isActive(href);
            const isHover = hovered === href;

            const bg = active ? "#B1C9EF" : isHover ? "#e7e9efff" : "transparent";
            const fg = active ? "#628ECB" : isHover ? "#628ECB" : "#B1C9EF";
            const border = active ? "#B1C9EF" : "#628ECB";
            const boxShadow = active ? "0 6px 18px rgba(0,0,0,0.25)" : "none";

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => setHovered(href)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(href)}
                onBlur={() => setHovered(null)}
                style={{
                  ...baseLinkStyle,
                  color: fg,
                  background: bg,
                  border: `1px solid ${border}`,
                  boxShadow,
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}