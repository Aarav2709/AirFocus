import type { JSX, ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <div className="flex h-screen bg-[#020817] text-white">
      <section className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </section>
    </div>
  );
}
