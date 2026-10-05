import { requireClassPage } from "@/lib/page-auth";
import { listStudents } from "@/services/students";
import { addStudentAction, setStudentActiveAction, deleteStudentAction, linkParentAction, createParentAction } from "@/actions/students";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const isTeacher = actor.role === "TEACHER";
  const { all } = await searchParams;
  const students = await listStudents(id, all === "1");
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className={isTeacher ? "md:col-span-2" : "md:col-span-3"}>
        <a href={all === "1" ? "?" : "?all=1"} className="text-sm underline">{mn.student.showInactive}</a>
        <table className="mt-2 w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.name}</th><th>{mn.student.parents}</th><th>{mn.common.status}</th>{isTeacher && <th>{mn.common.actions}</th>}</tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t align-top">
                <td className="p-2">{s.name}</td>
                <td className="p-2">
                  {s.parents.map((p) => <div key={p.parent.email}>{p.parent.name} ({p.parent.email})</div>)}
                  {isTeacher && (<>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-blue-700">{mn.student.linkParent}</summary>
                    <ActionForm action={linkParentAction} submitLabel={mn.common.save} className="flex gap-1">
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="studentId" value={s.id} />
                      <input name="email" type="email" required className="rounded border p-1" />
                    </ActionForm>
                  </details>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-blue-700">{mn.student.createParent}</summary>
                    <ActionForm action={createParentAction} submitLabel={mn.common.add}>
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="studentId" value={s.id} />
                      <input name="name" required placeholder={mn.common.name} className="rounded border p-1" />
                      <input name="email" type="email" required placeholder={mn.common.email} className="rounded border p-1" />
                      <input name="password" type="text" minLength={6} required placeholder={mn.common.tempPassword} className="rounded border p-1" />
                    </ActionForm>
                  </details>
                  </>)}
                </td>
                <td className="p-2 text-center">{s.isActive ? mn.common.active : mn.common.inactive}</td>
                {isTeacher && <td className="p-2">
                  <ActionForm action={setStudentActiveAction} submitLabel={s.isActive ? mn.common.deactivate : mn.common.activate} className="inline">
                    <input type="hidden" name="classId" value={id} />
                    <input type="hidden" name="studentId" value={s.id} />
                    <input type="hidden" name="isActive" value={String(!s.isActive)} />
                  </ActionForm>{" "}
                  <ActionForm action={deleteStudentAction} submitLabel={mn.common.delete} className="inline">
                    <input type="hidden" name="classId" value={id} />
                    <input type="hidden" name="studentId" value={s.id} />
                  </ActionForm>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {isTeacher && <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.student.add}</h2>
        <ActionForm action={addStudentAction} submitLabel={mn.common.add}>
          <input type="hidden" name="classId" value={id} />
          <input name="name" required placeholder={mn.common.name} className="rounded border p-1" />
        </ActionForm>
      </section>}
    </div>
  );
}
