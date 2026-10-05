import { z } from "zod";
import { ValidationError } from "@/lib/errors";

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fe: Record<string, string[]> = {};
    for (const issue of r.error.issues) {
      const key = issue.path.join(".") || "_";
      (fe[key] ??= []).push(issue.message);
    }
    throw new ValidationError(fe);
  }
  return r.data;
}

/** FormData -> plain object (first value per key). */
export function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  return o;
}
