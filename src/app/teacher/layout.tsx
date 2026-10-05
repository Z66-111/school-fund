import { requirePage } from "@/lib/page-auth";
import { Nav } from "@/components/Nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requirePage("TEACHER", "ADMIN");
  return (
    <>
      <Nav role={actor.role} />
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </>
  );
}
