import Link from "next/link";
import { requireClassPage } from "@/lib/page-auth";
import { listStudents } from "@/services/students";
import { addStudentAction, setStudentActiveAction, deleteStudentAction, linkParentAction, createParentAction, setDaycareEnrollmentAction } from "@/actions/students";
import { toISODate } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";
import { Table } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const mn = await getT();
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const isTeacher = actor.role === "TEACHER";
  const { all } = await searchParams;
  const students = await listStudents(id, all === "1");
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className={isTeacher ? "lg:col-span-2" : "lg:col-span-3"}>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">{students.length} {mn.common.student}</span>
          <Link href={all === "1" ? "?" : "?all=1"} className="link">{all === "1" ? mn.common.active : mn.student.showInactive}</Link>
        </div>
        <Table>
          <thead><tr><th>{mn.common.name}</th><th>{mn.student.parents}</th><th>{mn.student.daycare}</th><th>{mn.common.status}</th>{isTeacher && <th />}</tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className={s.isActive ? "" : "muted"}>
                <td className="font-medium">{s.name}</td>
                <td>
                  {s.parents.map((p) => (
                    <div key={p.parent.email}>{p.parent.name} <span className="text-ink-muted">{p.parent.email}</span></div>
                  ))}
                  {s.parents.length === 0 && <span className="text-ink-muted">{mn.common.none}</span>}
                  {isTeacher && (
                    <div className="mt-2 flex flex-col gap-2 text-xs">
                      <details>
                        <summary>{mn.student.linkParent}</summary>
                        <ActionForm action={linkParentAction} submitLabel={mn.common.save} className="mt-2 flex flex-wrap items-center gap-2" variant="secondary" size="sm">
                          <input type="hidden" name="classId" value={id} />
                          <input type="hidden" name="studentId" value={s.id} />
                          <input name="email" type="email" required placeholder={mn.common.email} className="input w-56" />
                        </ActionForm>
                      </details>
                      <details>
                        <summary>{mn.student.createParent}</summary>
                        <ActionForm action={createParentAction} submitLabel={mn.common.add} className="mt-2 flex flex-col gap-2" variant="secondary" size="sm">
                          <input type="hidden" name="classId" value={id} />
                          <input type="hidden" name="studentId" value={s.id} />
                          <input name="name" required placeholder={mn.common.name} className="input w-56" />
                          <input name="email" type="email" required placeholder={mn.common.email} className="input w-56" />
                          <input name="password" type="text" minLength={6} required placeholder={mn.common.tempPassword} className="input w-56" />
                        </ActionForm>
                      </details>
                    </div>
                  )}
                </td>
                <td>
                  {s.daycareFrom
                    ? <span className="num whitespace-nowrap">{toISODate(s.daycareFrom)}{s.daycareUntil ? ` – ${toISODate(s.daycareUntil)}` : " –"}</span>
                    : <span className="text-ink-muted">{mn.student.daycareNone}</span>}
                  {isTeacher && (
                    <details className="mt-2 text-xs">
                      <summary>{mn.student.daycareEdit}</summary>
                      <ActionForm action={setDaycareEnrollmentAction} submitLabel={mn.common.save} className="mt-2 flex w-56 flex-col gap-2" variant="secondary" size="sm" labels={{ from: mn.student.daycareFrom, until: mn.student.daycareUntil }}>
                        <input type="hidden" name="classId" value={id} />
                        <input type="hidden" name="studentId" value={s.id} />
                        <Field label={mn.student.daycareFrom}><input name="from" type="date" defaultValue={s.daycareFrom ? toISODate(s.daycareFrom) : ""} className="input" /></Field>
                        <Field label={mn.student.daycareUntil} hint={mn.student.daycareHint}><input name="until" type="date" defaultValue={s.daycareUntil ? toISODate(s.daycareUntil) : ""} className="input" /></Field>
                      </ActionForm>
                    </details>
                  )}
                </td>
                <td>{s.isActive ? <Badge tone="good">{mn.common.active}</Badge> : <Badge>{mn.common.inactive}</Badge>}</td>
                {isTeacher && (
                  <td className="whitespace-nowrap text-right">
                    <div className="inline-flex flex-col items-end gap-1">
                      <ActionForm action={setStudentActiveAction} submitLabel={s.isActive ? mn.common.deactivate : mn.common.activate} className="inline-flex" variant="secondary" size="sm">
                        <input type="hidden" name="classId" value={id} />
                        <input type="hidden" name="studentId" value={s.id} />
                        <input type="hidden" name="isActive" value={String(!s.isActive)} />
                      </ActionForm>
                      <ActionForm action={deleteStudentAction} submitLabel={mn.common.delete} className="inline-flex" variant="danger" size="sm">
                        <input type="hidden" name="classId" value={id} />
                        <input type="hidden" name="studentId" value={s.id} />
                      </ActionForm>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={isTeacher ? 5 : 4} className="text-ink-muted">{mn.common.empty}</td></tr>}
          </tbody>
        </Table>
      </section>
      {isTeacher && (
        <Card title={mn.student.add}>
          <ActionForm action={addStudentAction} submitLabel={mn.common.add}>
            <input type="hidden" name="classId" value={id} />
            <Field label={mn.common.name}><input name="name" required className="input" /></Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
