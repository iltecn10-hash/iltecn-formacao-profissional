"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@/types";

type NavGroup = "inicio" | "treinamento" | "acompanhamento" | "cadastros";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  group?: NavGroup;
}

/** Títulos das seções do menu (o grupo "inicio" não tem título). */
const GROUP_ORDER: { key: NavGroup; title: string | null }[] = [
  { key: "inicio", title: null },
  { key: "treinamento", title: "Treinamento" },
  { key: "acompanhamento", title: "Coordenação e acompanhamento" },
  { key: "cadastros", title: "Cadastros" },
];

/** Qual seção cada item pertence (separado do corpo da lista para facilitar manutenção). */
const GROUP_BY_HREF: Record<string, NavGroup> = {
  "/dashboard": "inicio",
  "/dashboard/email": "treinamento",
  "/dashboard/lab": "treinamento",
  "/dashboard/missoes": "treinamento",
  "/dashboard/jogos": "treinamento",
  "/dashboard/trabalhos": "treinamento",
  "/dashboard/conquistas": "treinamento",
  "/dashboard/certificado": "treinamento",
  "/dashboard/caixa": "treinamento",
  "/dashboard/produtos": "treinamento",
  "/dashboard/financeiro": "treinamento",
  "/dashboard/conselho": "acompanhamento",
  "/dashboard/trabalhos-alunos": "acompanhamento",
  "/dashboard/relatorio": "acompanhamento",
  "/dashboard/schools": "cadastros",
  "/dashboard/teachers": "cadastros",
  "/dashboard/students": "cadastros",
  "/dashboard/classes": "cadastros",
  "/dashboard/formacao": "cadastros",
};

/** Menu enxuto do aluno do ILTECN LAB (crianças): poucas opções, nomes simples. */
const KIDS_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/lab", label: "🏠 Meu painel", roles: ["student"] },
  { href: "/dashboard/jogos", label: "🎮 Jogos", roles: ["student"] },
  { href: "/dashboard/lab/certificado", label: "🎓 Certificado", roles: ["student"] },
];

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
    href: "/dashboard/lab",
    label: "ILTECN LAB",
    roles: ["admin", "teacher", "coordinator"],
  },
  {
    href: "/dashboard/missoes",
    label: "Missões",
    roles: ["student"],
  },
  {
    href: "/dashboard/jogos",
    label: "Jogos",
    roles: ["admin", "teacher", "student", "coordinator"],
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
    href: "/dashboard/conselho",
    label: "Conselho de Classe",
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
  kids = false,
}: {
  role: UserRole;
  name: string;
  kids?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const items = (kids ? KIDS_NAV_ITEMS : NAV_ITEMS).filter((item) => item.roles.includes(role));
  // Aluno infantil: menu enxuto, sem seções. Demais perfis: agrupado por seção.
  const sections = kids
    ? [{ key: "inicio" as NavGroup, title: null, items }]
    : GROUP_ORDER.map((g) => ({
        ...g,
        items: items.filter((i) => (GROUP_BY_HREF[i.href] ?? "cadastros") === g.key),
      })).filter((g) => g.items.length > 0);

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
        <p className="text-xs text-muted">Plataforma de Alfabetização Digital</p>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Menu principal">
        {sections.map((section) => (
          <div key={section.key} className="flex flex-col gap-1">
            {section.title && (
              <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/70">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
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
          </div>
        ))}
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
