import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";

export default function AppShell() {
  return (
    <div className="flex min-h-dvh bg-bg">
      <SideNav />
      <div className="relative flex w-full flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:ml-56 lg:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
