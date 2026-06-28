import { NavLink, Outlet } from "react-router-dom";
import { Home, Trophy, BarChart3, Activity, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/nba", label: "NBA", icon: Trophy },
  { to: "/mlb", label: "MLB", icon: Activity },
  { to: "/raw", label: "Raw Data", icon: Database },
  { to: "/status", label: "Status", icon: BarChart3 },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[hsl(var(--navy-deep))]/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              L
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">LindaData</div>
              <div className="text-[10px] uppercase tracking-wider text-primary">Sports Hub</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-foreground/70 hover:text-foreground hover:bg-white/5",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 pb-24 md:pb-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="hidden md:block border-t border-white/10 py-4 text-center text-xs text-muted-foreground">
        Historical research data sourced from public LindaData repository. No betting claims.
      </footer>

      {/* Bottom mobile nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[hsl(var(--navy-deep))]/95 backdrop-blur border-t border-white/10">
        <ul className="grid grid-cols-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center justify-center py-2.5 gap-0.5 text-[11px]",
                      isActive ? "text-primary" : "text-foreground/60",
                    )
                  }
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
