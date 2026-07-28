import type {
  ActivityRecord,
  ApiUser,
  ConversationMessageRecord,
  ConversationRecord,
  FormRecord,
  FormReviewDecision,
  MentionRecord,
  MessageableUser,
  MyFormsAnalytics,
  PokeRecord,
  TicketRecord,
  TicketStatus,
} from "./types";
import { getTokenForSlot, pathToSlot, type PortalSlot } from "@/lib/sessions";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, slot?: PortalSlot): Promise<T> {
  const resolvedSlot =
    slot ?? (typeof window !== "undefined" ? pathToSlot(window.location.pathname) : null);
  const token = resolvedSlot ? getTokenForSlot(resolvedSlot) : null;

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiFetchBlob(
  path: string,
  init?: RequestInit,
  slot?: PortalSlot,
): Promise<Blob> {
  const resolvedSlot =
    slot ?? (typeof window !== "undefined" ? pathToSlot(window.location.pathname) : null);
  const token = resolvedSlot ? getTokenForSlot(resolvedSlot) : null;

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.blob();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: ApiUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (slot: PortalSlot) => apiFetch<{ user: ApiUser }>("/api/auth/me", undefined, slot),

  updateProfile: (body: { name: string; division: string }) =>
    apiFetch<{ user: ApiUser }>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Forms (Admin)
  createForm: (body: object) =>
    apiFetch<{ form: FormRecord }>("/api/forms", { method: "POST", body: JSON.stringify(body) }),
  myForms: () => apiFetch<{ items: FormRecord[] }>("/api/forms/mine"),
  myFormsAnalytics: () => apiFetch<MyFormsAnalytics>("/api/forms/mine/analytics"),
  submitFormForReview: (id: string) =>
    apiFetch<{ form: FormRecord }>(`/api/forms/${id}/submit-for-review`, { method: "POST" }),
  createAndSubmitForm: (body: object) =>
    apiFetch<{ form: FormRecord }>("/api/forms/submit-to-records", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Published forms (Client)
  publishedForms: () => apiFetch<{ items: FormRecord[] }>("/api/forms/published"),
  getPublishedForm: (id: string) => apiFetch<{ form: FormRecord }>(`/api/forms/published/${id}`),
  getPublishedFormDocument: (id: string) => apiFetchBlob(`/api/forms/published/${id}/document.pdf`),

  // Records — form review
  recordsDashboard: () =>
    apiFetch<{
      pendingCount: number;
      publishedCount: number;
      recentPending: FormRecord[];
      recentPublished: FormRecord[];
      activities: ActivityRecord[];
    }>("/api/records/dashboard"),
  recordsForms: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<{ items: FormRecord[]; total: number; pendingCount: number }>(
      `/api/records/forms${q ? `?${q}` : ""}`,
    );
  },
  getRecordsForm: (id: string) => apiFetch<{ form: FormRecord }>(`/api/records/forms/${id}`),
  getRecordsFormDocument: (id: string) => apiFetchBlob(`/api/records/forms/${id}/document.pdf`),
  reviewForm: (id: string, body: { decision: FormReviewDecision; remarks?: string }) =>
    apiFetch<{ form: FormRecord }>(`/api/records/forms/${id}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  recordsActivity: () => apiFetch<{ items: ActivityRecord[] }>("/api/records/activity"),

  // Tickets
  createTicket: (body: object) =>
    apiFetch<{ ticket: TicketRecord }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  myTickets: () => apiFetch<{ items: TicketRecord[] }>("/api/tickets/mine"),
  listTickets: (params?: Record<string, string>, slot?: PortalSlot) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<{ items: TicketRecord[]; total: number; pendingCount: number }>(
      `/api/tickets${q ? `?${q}` : ""}`,
      undefined,
      slot,
    );
  },
  getTicket: (id: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}`, undefined, slot),
  getTicketDocument: (id: string, slot?: PortalSlot) =>
    apiFetchBlob(`/api/tickets/${id}/document.pdf`, undefined, slot),
  approveTicket: (id: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/approve`, { method: "POST" }, slot),
  rejectTicket: (id: string, reason: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(
      `/api/tickets/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
      slot,
    ),
  assignTicket: (id: string, assigneeIds: string[], slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(
      `/api/tickets/${id}/assign`,
      {
        method: "POST",
        body: JSON.stringify({ assigneeIds }),
      },
      slot,
    ),
  listAssignedTickets: (slot?: PortalSlot) =>
    apiFetch<{ items: TicketRecord[] }>(`/api/tickets/assigned/mine`, undefined, slot),
  completeTicketService: (id: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/complete`, { method: "POST" }, slot),
  updateTicketStatus: (id: string, status: TicketStatus, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(
      `/api/tickets/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
      slot,
    ),
  confirmTicket: (id: string, satisfied: boolean) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ satisfied }),
    }),
  submitFeedback: (id: string, body: { rating?: number; comment?: string }) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAssignees: () =>
    apiFetch<{ users: Array<{ _id: string; name: string; email: string; division: string }> }>(
      "/api/tickets/assignees",
      undefined,
      "admin",
    ),

  listMessageableUsers: (slot?: PortalSlot) =>
    apiFetch<{ users: MessageableUser[] }>("/api/messages/users", undefined, slot),
  listConversations: (slot?: PortalSlot) =>
    apiFetch<{ items: ConversationRecord[] }>("/api/messages/conversations", undefined, slot),
  getTicketConversation: (ticketId: string, slot?: PortalSlot) =>
    apiFetch<{ conversation: ConversationRecord }>(
      `/api/messages/conversations/ticket/${ticketId}`,
      undefined,
      slot,
    ),
  listMentionableUsers: (conversationId: string, slot?: PortalSlot) =>
    apiFetch<{ users: MessageableUser[] }>(
      `/api/messages/conversations/${conversationId}/mentionable`,
      undefined,
      slot,
    ),
  startDirectConversation: (userId: string, slot?: PortalSlot) =>
    apiFetch<{ conversation: ConversationRecord }>(
      "/api/messages/conversations/direct",
      { method: "POST", body: JSON.stringify({ userId }) },
      slot,
    ),
  listConversationMessages: (conversationId: string, slot?: PortalSlot) =>
    apiFetch<{ items: ConversationMessageRecord[] }>(
      `/api/messages/conversations/${conversationId}/messages`,
      undefined,
      slot,
    ),
  postConversationMessage: (
    conversationId: string,
    body: string,
    slot?: PortalSlot,
    mentionIds?: string[],
  ) =>
    apiFetch<{ message: ConversationMessageRecord }>(
      `/api/messages/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body, mentionIds: mentionIds ?? [] }),
      },
      slot,
    ),
  pokeUser: (userId: string, slot?: PortalSlot) =>
    apiFetch<{ poke: PokeRecord }>(
      "/api/messages/poke",
      { method: "POST", body: JSON.stringify({ userId }) },
      slot,
    ),
  listRecentPokes: (slot?: PortalSlot) =>
    apiFetch<{ items: PokeRecord[] }>("/api/messages/pokes/recent", undefined, slot),

  uploadFile: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch<{
      file: { url: string; originalName: string; mimeType: string; size: number };
    }>("/api/uploads", { method: "POST", body: fd });
  },
};
