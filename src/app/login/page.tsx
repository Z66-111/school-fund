import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";
import { loginAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { Field } from "@/components/ui/Field";
import { mn } from "@/lib/i18n/mn";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homeFor(actor.role));
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-5">
      <div className="mb-8 border-l-2 border-teal pl-4">
        <p className="text-sm text-ink-muted">{mn.login.tagline}</p>
        <h1 className="text-teal">{mn.app}</h1>
      </div>
      <div className="panel">
        <h2 className="mb-4">{mn.login.title}</h2>
        <ActionForm action={loginAction} submitLabel={mn.login.submit}>
          <Field label={mn.login.email}>
            <input name="email" type="email" required autoComplete="username" className="input" />
          </Field>
          <Field label={mn.login.password}>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </Field>
        </ActionForm>
      </div>
    </main>
  );
}
