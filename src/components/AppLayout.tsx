import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { AppHeader } from "./AppHeader";

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 pb-[calc(var(--bottom-nav-height)+0.5rem)] lg:pb-4 pt-4">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
