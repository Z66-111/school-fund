import Link from "next/link";
import { mn } from "@/lib/i18n/mn";
export default function Forbidden() {
  return (
    <main className="mx-auto max-w-sm px-5 py-24">
      <div className="border-l-2 border-absent pl-4">
        <h1>{mn.errors.forbidden}</h1>
        <Link href="/" className="link mt-3 inline-block text-sm">{mn.common.backHome}</Link>
      </div>
    </main>
  );
}
