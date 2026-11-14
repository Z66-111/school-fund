import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";
import { loginAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { Field } from "@/components/ui/Field";
import { Brand } from "@/components/ui/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const mn = await getT();
  const actor = await getActor();
  if (actor) redirect(homeFor(actor.role));
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-5">
      <div className="mb-6 flex justify-end"><LanguageSwitch /></div>
      <div className="mb-8 flex flex-col items-center text-center">
        <Brand size="lg" />
        <h1 className="sr-only">{mn.app}</h1>
        <p className="mt-3 text-sm text-ink-muted">{mn.login.tagline}</p>
      </div>
      <div className="panel relative overflow-hidden">
        <span aria-hidden className="ribbon absolute inset-x-0 top-0 h-[3px]" />
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
