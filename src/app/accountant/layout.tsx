import { requirePage } from "@/lib/page-auth";
import { Nav } from "@/components/Nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  return (
    <>
      <Nav role={actor.role} />
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </>
  );
}
