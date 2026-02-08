"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "./SidebarContext";
import { createBrowserClient } from "@supabase/ssr";
import {
  Home,
  Users,
  GraduationCap,
  UserCheck,
  BookOpen,
  BookMarked,
  School,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Power,
  Music,
  ClipboardList,
  FileText,
} from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: NavigationItem[];
}

const navigation: NavigationItem[] = [
  {
    name: "Dirección",
    href: "/director/direccion",
    icon: Home,
    children: [
      { name: "Dashboard", href: "/director/direccion", icon: Home },
      {
        name: "Profesores",
        href: "/director/direccion/professors",
        icon: Users,
      },
      {
        name: "Estudiantes",
        href: "/director/direccion/students",
        icon: GraduationCap,
      },
      {
        name: "Encargados",
        href: "/director/direccion/guardians",
        icon: UserCheck,
      },
      {
        name: "Materias",
        href: "/director/direccion/subjects",
        icon: BookOpen,
      },
      { name: "Cursos", href: "/director/direccion/courses", icon: BookMarked },
      {
        name: "Matrículas",
        href: "/director/direccion/course-registrations",
        icon: ClipboardList,
      },
      {
        name: "Contratos",
        href: "/director/direccion/contracts",
        icon: FileText,
      },
    ],
  },
  {
    name: "Aula",
    href: "/director/aula",
    icon: School,
    children: [
      { name: "Inicio", href: "/director/aula", icon: School },
      {
        name: "Estudiantes",
        href: "/director/aula",
        icon: GraduationCap,
      },
      {
        name: "Canciones",
        href: "/director/aula",
        icon: Music,
      },
    ],
  },
  {
    name: "Hogar",
    href: "/director/hogar",
    icon: Home,
  },
];

function getAulaProfessorId(pathname: string): string | null {
  const match = pathname.match(/\/director\/aula\/([^/]+)/);
  const id = match?.[1];
  if (id && id !== "curso" && id !== "estudiantes") return id;
  return null;
}

export function DirectorSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const aulaProfessorId = getAulaProfessorId(pathname);
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    // Auto-expand section that contains current path
    if (pathname.startsWith("/director/direccion")) return ["dirección"];
    if (pathname.startsWith("/director/aula")) return ["aula"];
    if (pathname.startsWith("/director/hogar")) return ["hogar"];
    return [];
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((s) => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  const isActive = (href: string) => {
    if (href === "/director/direccion") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const isSectionActive = (section: NavigationItem) => {
    if (section.children) {
      return section.children.some((child) => isActive(child.href));
    }
    return isActive(section.href);
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!isCollapsed && (
          <Link
            href="/director/direccion"
            className="text-lg font-bold text-indigo-600 flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span>Academia</span>
          </Link>
        )}
        {isCollapsed && (
          <Link
            href="/director/direccion"
            className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center mx-auto"
          >
            <span className="text-white font-bold text-sm">A</span>
          </Link>
        )}
        <button
          type="button"
          className="lg:hidden rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-2 space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                MENÚ PRINCIPAL
              </h3>
            </div>
          )}

          {navigation.map((section) => {
            const sectionKey = section.name.toLowerCase();
            const sectionExpanded = expandedSections.includes(sectionKey);
            const sectionActive = isSectionActive(section);

            return (
              <div key={section.name} className="relative">
                {section.children ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isCollapsed) {
                          toggleSection(sectionKey);
                        } else {
                          window.location.href = section.href;
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        sectionActive
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      title={isCollapsed ? section.name : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <section.icon className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span>{section.name}</span>}
                      </div>
                      {!isCollapsed &&
                        (sectionExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        ))}
                    </button>
                    {sectionExpanded && !isCollapsed && (
                      <div className="ml-4 mt-1 space-y-1">
                        {section.children!.map((child) => {
                          const isAulaSection = section.name === "Aula";
                          const href =
                            isAulaSection && aulaProfessorId
                              ? child.name === "Inicio"
                                ? `/director/aula/${aulaProfessorId}`
                                : child.name === "Estudiantes"
                                ? `/director/aula/${aulaProfessorId}/estudiantes`
                                : child.name === "Canciones"
                                ? `/director/aula/${aulaProfessorId}/songs`
                                : child.href
                              : child.href;
                          const childActive = isActive(href);
                          return (
                            <Link
                              key={child.name}
                              href={href}
                              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                                childActive
                                  ? "bg-gray-100 text-gray-900 font-medium"
                                  : "text-gray-600 hover:bg-gray-50"
                              }`}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <child.icon className="h-4 w-4 flex-shrink-0" />
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={section.href}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      sectionActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    title={isCollapsed ? section.name : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <section.icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{section.name}</span>}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-gray-200 p-2">
        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-gray-700 hover:bg-gray-50 ${
            isCollapsed ? "justify-center" : ""
          }`}
          title={isCollapsed ? "Cerrar Sesión" : undefined}
        >
          <Power className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>

      <div className="hidden lg:block border-t border-gray-200 p-2">
        <button
          type="button"
          onClick={toggleCollapse}
          className={`flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors ${
            isCollapsed ? "justify-center w-full" : "justify-start"
          }`}
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 rounded-md p-2 bg-white shadow-md text-gray-400 hover:bg-gray-100 hover:text-gray-500"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-30 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="lg:hidden flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50 shadow-xl">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
