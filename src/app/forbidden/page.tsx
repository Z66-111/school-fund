import Link from "next/link";
import { mn } from "@/lib/i18n/mn";
export default function Forbidden() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">{mn.errors.forbidden}</h1>
      <Link href="/" className="underline">{mn.app}</Link>
    </main>
  );
}
