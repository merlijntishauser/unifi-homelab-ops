import { Suspense } from "react";

export default function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
