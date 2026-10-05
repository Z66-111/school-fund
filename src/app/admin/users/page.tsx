import { requirePage } from "@/lib/page-auth";
import { listUsers } from "@/services/users";
import { createUserAction, resetPasswordAction } from "@/actions/users";
import { ActionForm } from "@/components/ActionForm";
import { Table } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ROLES } from "@/lib/roles";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  await requirePage("ADMIN");
  const users = await listUsers();
  return (
    <div>
      <PageHeader title={mn.nav.users} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <thead><tr><th>{mn.common.name}</th><th>{mn.common.email}</th><th>{mn.common.role}</th><th>{mn.user.resetPassword}</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td className="text-ink-muted">{u.email}</td>
                  <td><Badge tone={u.role === "ADMIN" ? "teal" : "neutral"}>{mn.roles[u.role as keyof typeof mn.roles]}</Badge></td>
                  <td>
                    <ActionForm action={resetPasswordAction} submitLabel={mn.user.resetPassword} className="flex items-center gap-2" variant="secondary" size="sm">
                      <input type="hidden" name="userId" value={u.id} />
                      <input name="password" type="text" minLength={6} required placeholder={mn.user.newPassword} className="input w-36" />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card title={mn.user.create}>
          <ActionForm action={createUserAction} submitLabel={mn.common.add}>
            <Field label={mn.common.name}><input name="name" required className="input" /></Field>
            <Field label={mn.common.email}><input name="email" type="email" required className="input" /></Field>
            <Field label={mn.common.tempPassword}><input name="password" type="text" minLength={6} required className="input" /></Field>
            <Field label={mn.common.role}>
              <select name="role" className="input">
                {ROLES.map((r) => <option key={r} value={r}>{mn.roles[r]}</option>)}
              </select>
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
