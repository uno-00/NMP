export const LOGIN = "/login";

export const ADMIN_DASHBOARD = "/admin/dashboard";
export const ADMIN_FORMS = "/admin/forms";
export const ADMIN_MY_FORMS = "/admin/my-forms";
export const ADMIN_APPROVALS = "/admin/approvals";
export const ADMIN_REQUESTS = "/admin/requests";
export const ADMIN_ASSIGNED = "/admin/assigned";
export const ADMIN_REPORTS = "/admin/reports";
export const ADMIN_MESSAGES = "/admin/messages";
export const ADMIN_SETTINGS = "/admin/settings";

export const RECORDS_DASHBOARD = "/records/dashboard";
export const RECORDS_PENDING = "/records/pending";
export const RECORDS_PUBLISHED = "/records/published";
export const RECORDS_ACTIVITY = "/records/activity";
export const RECORDS_MESSAGES = "/records/messages";
export const RECORDS_SETTINGS = "/records/settings";

export const CLIENT_DASHBOARD = "/client/dashboard";
export const CLIENT_SUBMIT = "/client/submit";
export const CLIENT_REQUESTS = "/client/requests";
export const CLIENT_FEEDBACK = "/client/feedback";
export const CLIENT_MESSAGES = "/client/messages";
export const CLIENT_SETTINGS = "/client/settings";

export function settingsPathForSlot(slot: "admin" | "records" | "client" | null | undefined) {
  if (slot === "admin") return ADMIN_SETTINGS;
  if (slot === "records") return RECORDS_SETTINGS;
  if (slot === "client") return CLIENT_SETTINGS;
  return LOGIN;
}

export function isAdminRole(role: string | undefined) {
  return role === "admin";
}
export function isClientRole(role: string | undefined) {
  return role === "user";
}
export function isRecordsRole(role: string | undefined) {
  return role === "record_management";
}

/** After unified login, redirect by role */
export function dashboardForRole(role: string): string {
  if (isAdminRole(role)) return ADMIN_DASHBOARD;
  if (isRecordsRole(role)) return RECORDS_DASHBOARD;
  if (isClientRole(role)) return CLIENT_DASHBOARD;
  return LOGIN;
}
