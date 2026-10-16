"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types";
import { SidebarNav } from "@/components/sidebar-nav";
import { NavIcon } from "@/components/nav-icons";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  teacher: "Professor",
  student: "Aluno",
  coordinator: "Coordenador",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * Estrutura do painel: barra superior (marca + usuário + sair) e menu lateral.
 * Em telas pequenas o menu vira uma gaveta aberta pelo botão do topo.
 */
export function AppShell({
  role,
  name,
  kids,
  children,
}: {
  role: UserRole;
  name: string;
  kids: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Fecha a gaveta com a tecla Esc (ao navegar, o próprio link fecha).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 shadow-[var(--shadow-card)] lg:px-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="menu-lateral"
          className="btn btn-secondary !min-h-10 !px-2.5 lg:hidden"
        >
          <NavIcon name={open ? "close" : "menu"} />
        </button>

        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white"
          >
            IL
          </span>
          <div className="leading-tight">
            <p className="font-heading text-base font-bold tracking-wide text-primary-dark">ILTECN</p>
            <p className="hidden text-[11px] text-muted sm:block">Plataforma de Alfabetização Digital</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-dark"
            >
              {initials(name)}
            </span>
            <div className="max-w-48 leading-tight">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[role]}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="btn btn-secondary">
            Sair
          </button>
        </div>
      </header>

      {/* Fundo escuro atrás da gaveta (só em telas pequenas). */}
      {open && (
        <div
          className="fixed inset-0 top-16 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        id="menu-lateral"
        className={`fixed bottom-0 left-0 top-16 z-40 w-72 overflow-y-auto border-r border-border bg-surface transition-transform lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarNav role={role} kids={kids} onNavigate={() => setOpen(false)} />
      </aside>

      <main className="bg-background px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
