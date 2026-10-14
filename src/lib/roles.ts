export const ROLES = ["ADMIN", "TEACHER", "ACCOUNTANT", "PARENT"] as const;
export type Role = (typeof ROLES)[number];
export type Actor = { userId: string; role: Role };

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "SICK"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PAYMENT_KINDS = ["FOOD", "DAYCARE", "ANNUAL_FUND"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
