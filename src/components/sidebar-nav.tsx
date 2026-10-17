"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types";
import { NavIcon, type IconName } from "@/components/nav-icons";

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

const ICON_BY_HREF: Record<string, IconName> = {
  "/dashboard": "home",
  "/dashboard/email": "mail",
  "/dashboard/lab": "flask",
  "/dashboard/missoes": "book",
  "/dashboard/jogos": "game",
  "/dashboard/trabalhos": "file",
  "/dashboard/atividades": "clipboard",
  "/dashboard/conquistas": "trophy",
  "/dashboard/certificado": "award",
  "/dashboard/lab/certificado": "award",
  "/dashboard/caixa": "wallet",
  "/dashboard/produtos": "box",
  "/dashboard/financeiro": "dollar",
  "/dashboard/conselho": "clipboard",
  "/dashboard/trabalhos-alunos": "file",
  "/dashboard/relatorio": "chart",
  "/dashboard/schools": "building",
  "/dashboard/teachers": "user",
  "/dashboard/coordenacao": "users",
  "/dashboard/students": "users",
  "/dashboard/classes": "users",
  "/dashboard/formacao": "settings",
  "/dashboard/usuarios": "user",
  "/dashboard/conta": "settings",
};

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
  "/dashboard/atividades": "treinamento",
  "/dashboard/relatorio": "acompanhamento",
  "/dashboard/schools": "cadastros",
  "/dashboard/teachers": "cadastros",
  "/dashboard/coordenacao": "cadastros",
  "/dashboard/students": "cadastros",
  "/dashboard/classes": "cadastros",
  "/dashboard/formacao": "cadastros",
  "/dashboard/usuarios": "cadastros",
  "/dashboard/conta": "cadastros",
};

/** Menu enxuto do aluno do ILTECN LAB (crianças): poucas opções, nomes simples. */
const KIDS_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/lab", label: "🏠 Meu painel", roles: ["student"] },
  { href: "/dashboard/jogos", label: "🎮 Jogos", roles: ["student"] },
  { href: "/dashboard/atividades", label: "📚 Atividades", roles: ["student"] },
  { href: "/dashboard/lab/certificado", label: "🎓 Certificado", roles: ["student"] },
  { href: "/dashboard/conta", label: "🔑 Minha conta", roles: ["student"] },
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
    href: "/dashboard/atividades",
    label: "Atividades",
    roles: ["admin", "teacher", "coordinator", "student"],
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
  { href: "/dashboard/coordenacao", label: "Coordenação e direção", roles: ["admin"] },
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
  {
    href: "/dashboard/usuarios",
    label: "Acessos e senhas",
    roles: ["admin", "teacher", "coordinator"],
  },
  { href: "/dashboard/conta", label: "Minha conta", roles: ["admin", "teacher", "coordinator", "student"] },
];

/**
 * Navegação lateral. A barra superior, o usuário e o botão "Sair" ficam no AppShell;
 * aqui só a lista de itens (filtrada pelo perfil — a autorização real é no servidor).
 */
export function SidebarNav({
  role,
  kids = false,
  onNavigate,
}: {
  role: UserRole;
  kids?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const items = (kids ? KIDS_NAV_ITEMS : NAV_ITEMS).filter((item) => item.roles.includes(role));
  // Aluno infantil: menu enxuto, sem seções. Demais perfis: agrupado por seção.
  const sections = kids
    ? [{ key: "inicio" as NavGroup, title: null, items }]
    : GROUP_ORDER.map((g) => ({
        ...g,
        items: items.filter((i) => (GROUP_BY_HREF[i.href] ?? "cadastros") === g.key),
      })).filter((g) => g.items.length > 0);

  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Menu principal">
      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-1">
          {section.title && (
            <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href) &&
                  // "Meu painel" do LAB não deve ficar ativo dentro de /lab/certificado
                  !(item.href === "/dashboard/lab" && pathname.startsWith("/dashboard/lab/certificado"));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary-light text-primary-dark"
                    : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                <NavIcon name={ICON_BY_HREF[item.href] ?? "file"} />
                <span>{item.label.replace(/^[^\p{L}]+/u, "")}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
