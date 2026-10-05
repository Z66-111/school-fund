import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";
import { loginAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homeFor(actor.role));
  return (
    <main className="mx-auto mt-24 max-w-sm rounded border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">{mn.login.title}</h1>
      <ActionForm action={loginAction} submitLabel={mn.login.submit}>
        <label className="flex flex-col text-sm">
          {mn.login.email}
          <input name="email" type="email" required className="rounded border p-1" />
        </label>
        <label className="flex flex-col text-sm">
          {mn.login.password}
          <input name="password" type="password" required className="rounded border p-1" />
        </label>
      </ActionForm>
    </main>
  );
}
