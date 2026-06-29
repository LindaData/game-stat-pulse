import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CheckSquare2,
  Database,
  FlaskConical,
  LayoutGrid,
  ListChecks,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBasketCount } from "@/pages/ReviewBasket";
import GlobalReviewWorkspace from "@/components/GlobalReviewWorkspace";

const navItems = [
  { to: "/", label: "Approve data", icon: CheckSquare2, end: true },
  { to: "/datasets", label: "Catalog", icon: LayoutGrid },
  { to: "/explore", label: "Explore", icon: Database },
  { to: "/coverage", label: "Coverage", icon: LayoutGrid },
  { to: "/dictionary", label: "Dictionary", icon: BookOpen },
  { to: "/quality", label: "Quality", icon: ShieldCheck },
  { to: "/basket", label: "Flagged rows", icon: ListChecks },
  { to: "/status", label: "Status", icon: Activity },
];

const mobileItems = [
  { to: "/", label: "Approve", icon: CheckSquare2, end: true },
  { to: "/datasets", label: "Catalog", icon: LayoutGrid },
  { to: "/explore", label: "Explore", icon: Database },
  { to: "/basket", label: "Flags", icon: ListChecks },
  { to: "/status", label: "Status", icon: Activity },
];

export default function Layout() {
  const basketCount = useBasketCount();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 bg-[hsl(var(--navy-deep))]/95 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2 min-w-0" aria-label="Game Stat Pulse approval workspace">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
              G
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">Game Stat Pulse</div>
              <div className="hidden min-[360px]:block text-[10px] uppercase tracking-wider text-primary truncate">Data approval first</div>
            </div>
          </NavLink>
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "px-2.5 py-2 rounded-md text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-foreground/70 hover:text-foreground hover:bg-white/5",
                    )
                  }
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {item.to === "/basket" && basketCount > 0 && (
                    <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {basketCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
            <span
              aria-disabled="true"
              title="Models remain locked until the data review is approved"
              className="px-2.5 py-2 rounded-md text-sm font-medium text-foreground/30 flex items-center gap-1.5 cursor-not-allowed whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              <FlaskConical className="w-4 h-4" /> Models
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-3 sm:py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-10">
        <Outlet />
      </main>

      <footer className="hidden lg:block border-t border-white/10 py-4 text-center text-xs text-muted-foreground">
        Review and approve source data before model development begins.
      </footer>

      <GlobalReviewWorkspace />

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[hsl(var(--navy-deep))]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]" aria-label="Mobile navigation">
        <ul className="grid grid-cols-5">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "min-h-[4.25rem] flex flex-col items-center justify-center py-2 gap-0.5 text-[11px] relative active:bg-white/5",
                      isActive ? "text-primary" : "text-foreground/60",
                    )
                  }
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                  {item.to === "/basket" && basketCount > 0 && (
                    <span className="absolute top-1 right-3 text-[9px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                      {basketCount}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
