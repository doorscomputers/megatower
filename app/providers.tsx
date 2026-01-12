"use client";

// DevExtreme license (removes trial banner)
import '@/devextreme-license';

// Better Auth doesn't require a SessionProvider wrapper
// The hooks from lib/auth-client.ts work directly
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
