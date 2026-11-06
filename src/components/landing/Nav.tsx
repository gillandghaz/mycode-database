"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo, { BrandWord } from "@/components/Logo";
import { IconMenu, IconClose } from "@/components/Icons";

const ITEMS = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "faq", label: "FAQ" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const els = ITEMS.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const links = ITEMS.map((i) => (
    <Link key={i.id} href={`/#${i.id}`} className={"lp-mi" + (active === i.id ? " is-active" : "")} onClick={() => setOpen(false)}>
      {i.label}
    </Link>
  ));

  return (
    <header className="lp-top" ref={wrapRef}>
      <div className="lp-top__in">
        <button type="button" className="icon-btn lp-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <Logo size={26} />
          <BrandWord />
        </Link>
        <nav className="lp-menu" aria-label="Sections">{links}</nav>
        <div className="lp-top__act">
          <Link href="/login" className="btn btn--ghost btn--sm lp-signin">Sign in</Link>
          <Link href="/register" className="btn btn--primary btn--sm">Sign up</Link>
        </div>
      </div>
      {open && (
        <nav className="lp-menu-m" aria-label="Menu">
          {links}
          <Link href="/login" className="lp-mi lp-mi--signin" onClick={() => setOpen(false)}>Sign in</Link>
        </nav>
      )}
    </header>
  );
}
