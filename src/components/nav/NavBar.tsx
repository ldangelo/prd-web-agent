import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { NavLinks } from "./NavLinks";
import { MobileMenuButton } from "./MobileMenuButton";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "@/components/notifications";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/prd/new", label: "New PRD" },
];

const ADMIN_LINK = { href: "/admin", label: "Admin" };

export async function NavBar() {
  const session = await auth();

  if (!session) {
    return null;
  }

  const links =
    session.user.role === "ADMIN"
      ? [...NAV_LINKS, ADMIN_LINK]
      : NAV_LINKS;

  return (
    <nav className="relative bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Logo + Links */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-lg font-semibold text-white"
            >
              PRD Agent
            </Link>
            <div className="hidden items-center gap-1 sm:flex">
              <NavLinks links={links} userName={session.user.name} />
            </div>
          </div>

          {/* Right: Notifications + User */}
          <div className="hidden items-center gap-3 sm:flex">
            <NotificationBell />
            <UserMenu
              userName={session.user.name}
              userImage={session.user.image}
            />
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden">
            <MobileMenuButton links={links} userName={session.user.name} />
          </div>
        </div>
      </div>
    </nav>
  );
}
