import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
export const dynamic = "force-dynamic";
export default async function Panel({ children }: { children: React.ReactNode }) {
  return <AdminShell username={await requireAdmin()}>{children}</AdminShell>;
}