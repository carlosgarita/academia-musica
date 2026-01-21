"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  GraduationCap,
  UserCheck,
  BookOpen,
  Calendar,
  School,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
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
      { name: "Profesores", href: "/director/direccion/professors", icon: Users },
      { name: "Estudiantes", href: "/director/direccion/students", icon: GraduationCap },
      { name: "Encargados", href: "/director/direccion/guardians", icon: UserCheck },
      { name: "Materias", href: "/director/direccion/subjects", icon: BookOpen },
      { name: "Horarios", href: "/director/direccion/schedules", icon: Calendar },
    ],
  },
  {
    name: "Aula",
    href: "/director/aula",
    icon: School,
  },
  {
    name: "Hogar",
    href: "/director/hogar",
    icon: Home,
  },
];

export function DirectorNavigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    // Auto-expand section that contains current path
    if (pathname.startsWith("/director/direccion")) return ["direccion"];
    if (pathname.startsWith("/director/aula")) return ["aula"];
    if (pathname.startsWith("/director/hogar")) return ["hogar"];
    return [];
  });

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

  const NavContent = () => (
    <>
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <Link
          href="/director/direccion"
          className="text-xl font-bold text-indigo-600"
        >
          Academia
        </Link>
        {/* Mobile menu button - hidden on desktop */}
        <button
          type="button"
          className="sm:hidden rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Desktop Navigation - Main Menu */}
      <nav className="hidden sm:flex sm:space-x-1 px-4 sm:px-6 lg:px-8 pt-2 pb-0">
        {navigation.map((section) => {
          const sectionKey = section.name.toLowerCase();
          const sectionActive = isSectionActive(section);

          return (
            <Link
              key={section.name}
              href={section.href}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                sectionActive
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <section.icon className="mr-2 h-5 w-5" />
              {section.name}
            </Link>
          );
        })}
      </nav>

      {/* Desktop Submenu - Show children of active section */}
      {navigation.some((section) => {
        const sectionKey = section.name.toLowerCase();
        const sectionActive = isSectionActive(section);
        return sectionActive && section.children && section.children.length > 0;
      }) && (
        <nav className="hidden sm:flex sm:space-x-1 px-4 sm:px-6 lg:px-8 pt-0 pb-4 border-t border-gray-200">
          {navigation
            .find((section) => {
              const sectionActive = isSectionActive(section);
              return sectionActive && section.children && section.children.length > 0;
            })
            ?.children?.map((child) => {
              const childActive = isActive(child.href);
              return (
                <Link
                  key={child.name}
                  href={child.href}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                    childActive
                      ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <child.icon className="mr-2 h-4 w-4" />
                  {child.name}
                </Link>
              );
            })}
        </nav>
      )}

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-200">
          <nav className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((section) => {
              const sectionKey = section.name.toLowerCase();
              const sectionExpanded = expandedSections.includes(sectionKey);
              const sectionActive = isSectionActive(section);

              return (
                <div key={section.name}>
                  {section.children ? (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleSection(sectionKey)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-base font-medium rounded-md ${
                          sectionActive
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center">
                          <section.icon className="mr-3 h-5 w-5" />
                          {section.name}
                        </div>
                        {sectionExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                      {sectionExpanded && (
                        <div className="pl-11 mt-1 space-y-1">
                          {section.children.map((child) => {
                            const childActive = isActive(child.href);
                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={`flex items-center px-3 py-2 text-base rounded-md ${
                                  childActive
                                    ? "bg-indigo-50 text-indigo-700 font-medium"
                                    : "text-gray-600 hover:bg-gray-50"
                                }`}
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                <child.icon className="mr-3 h-4 w-4" />
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={section.href}
                      className={`flex items-center px-3 py-2 text-base font-medium rounded-md ${
                        sectionActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <section.icon className="mr-3 h-5 w-5" />
                      {section.name}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );

  return (
    <nav className="bg-white shadow">
      <div className="mx-auto max-w-7xl">
        <NavContent />
      </div>
    </nav>
  );
}
