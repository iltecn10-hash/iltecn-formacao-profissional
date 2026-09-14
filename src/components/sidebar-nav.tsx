"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Painel",
    roles: ["admin", "teacher", "student", "coordinator"],
  },
  {
    href: "/dashboard/email",
    label: "E-mail",
    roles: ["admin", "teacher", "student", "coordinator"],
  },
  {
    href: "/dashboard/missoes",
    label: "Missões",
    roles: ["student"],
  },
  {
    href: "/dashboard/trabalhos",
    label: "Meus Trabalhos",
    roles: ["student"],
  },
  {
    href: "/dashboard/trabalhos-alunos",
    label: "Trabalhos dos Alunos",
    roles: ["admin", "teacher", "coordinator"],
  },
  {
    href: "/dashboard/conquistas",
    label: "Conquistas",
    roles: ["student"],
  },
  {
    href: "/dashboard/certificado",
    label: "Certificado",
    roles: ["student"],
  },
  {
    href: "/dashboard/relatorio",
    label: "Relatórios",
    roles: ["admin", "teacher", "student", "coordinator"],
  },
  {
    href: "/dashboard/caixa",
    label: "Caixa",
    roles: ["admin", "teacher", "student"],
  },
  {
    href: "/dashboard/produtos",
    label: "Estoque",
    roles: ["admin", "teacher"],
  },
  {
    href: "/dashboard/financeiro",
    label: "Financeiro",
    roles: ["admin", "teacher"],
  },
  { href: "/dashboard/schools", label: "Escolas", roles: ["admin", "coordinator"] },
  { href: "/dashboard/teachers", label: "Professores", roles: ["admin"] },
  {
    href: "/dashboard/students",
    label: "Alunos",
    roles: ["admin", "teacher", "coordinator"],
  },
  {
    href: "/dashboard/formacao",
    label: "Formação",
    roles: ["admin"],
  },
  {
    href: "/dashboard/classes",
    label: "Turmas",
    roles: ["admin", "teacher", "coordinator"],
  },
];

export function SidebarNav({
  role,
  name,
}: {
  role: UserRole;
  name: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleLabel: Record<UserRole, string> = {
    admin: "Administrador",
    teacher: "Professor",
    student: "Aluno",
    coordinator: "Coordenador",
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6">
      <div className="px-2">
        <p className="font-heading text-lg font-bold text-primary">ILTECN</p>
        <p className="text-xs text-muted">Formação Profissional</p>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-primary-light text-primary-dark"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted">{roleLabel[role]}</p>
        <button
          onClick={handleLogout}
          className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-background"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
