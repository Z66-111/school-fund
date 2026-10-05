import { requirePage } from "@/lib/page-auth";
import { Nav } from "@/components/Nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePage("PARENT");
  return (
    <>
      <Nav role="PARENT" />
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </>
  );
}
