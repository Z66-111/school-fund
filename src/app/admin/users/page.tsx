import { requirePage } from "@/lib/page-auth";
import { listUsers } from "@/services/users";
import { createUserAction, resetPasswordAction } from "@/actions/users";
import { ActionForm } from "@/components/ActionForm";
import { ROLES } from "@/lib/roles";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  await requirePage("ADMIN");
  const users = await listUsers();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.nav.users}</h1>
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.name}</th><th>{mn.common.email}</th><th>{mn.common.role}</th><th>{mn.user.resetPassword}</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.name}</td>
                <td>{u.email}</td>
                <td className="text-center">{mn.roles[u.role as keyof typeof mn.roles]}</td>
                <td className="p-1">
                  <ActionForm action={resetPasswordAction} submitLabel={mn.user.resetPassword} className="flex gap-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <input name="password" type="text" minLength={6} placeholder={mn.user.newPassword} className="w-32 rounded border p-1" />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.user.create}</h2>
        <ActionForm action={createUserAction} submitLabel={mn.common.add}>
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.email}<input name="email" type="email" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.password}<input name="password" type="text" minLength={6} required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.role}
            <select name="role" className="w-full rounded border p-1">
              {ROLES.map((r) => <option key={r} value={r}>{mn.roles[r]}</option>)}
            </select>
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
