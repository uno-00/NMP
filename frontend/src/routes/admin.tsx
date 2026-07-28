import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BarChart3,
  ClipboardCheck,
  FilePenLine,
  FileStack,
  LayoutDashboard,
  MessageCircle,
  Ticket,
  UserCheck,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import { useMessageRealtime } from "@/hooks/use-message-realtime";
import { usePokeNotifications } from "@/hooks/use-poke-notifications";
import { api } from "@/lib/api/client";
import { adminApprovalNotifications } from "@/lib/notifications";
import { ensurePortalRole } from "@/lib/portal-guard";
import { useAdminSession } from "@/lib/use-portal-session";
import {
  ADMIN_APPROVALS,
  ADMIN_ASSIGNED,
  ADMIN_DASHBOARD,
  ADMIN_FORMS,
  ADMIN_MESSAGES,
  ADMIN_MY_FORMS,
  ADMIN_REPORTS,
  ADMIN_REQUESTS,
  isAdminRole,
} from "@/lib/navigation";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    await ensurePortalRole(isAdminRole, "admin");
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({ to: ADMIN_DASHBOARD, replace: true });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { canQuery } = useAdminSession();
  useMessageRealtime("admin");
  const pokeNotifications = usePokeNotifications("admin", canQuery);
  const messageNotifications = useMessageNotifications("admin", canQuery);
  const { data: tickets, isLoading: notificationsLoading } = useQuery({
    queryKey: ["admin-tickets-pending"],
    queryFn: () => api.listTickets({ status: "pending_approval" }, "admin"),
    enabled: canQuery,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
    staleTime: 0,
  });

  const notifications = useMemo(
    () => [
      ...messageNotifications,
      ...pokeNotifications,
      ...adminApprovalNotifications(tickets?.items ?? []),
    ],
    [messageNotifications, pokeNotifications, tickets?.items],
  );

  return (
    <DashboardShell
      portalTitle="Admin"
      notifications={notifications}
      notificationsLoading={notificationsLoading}
      notificationsViewAllTo={ADMIN_APPROVALS}
      notificationsEmptyMessage="No pending client requests"
      navSections={[
        {
          title: "MAIN",
          items: [
            { to: ADMIN_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
            { to: ADMIN_REPORTS, label: "Reports", icon: BarChart3 },
            { to: ADMIN_MESSAGES, label: "Messages", icon: MessageCircle },
          ],
        },
        {
          title: "FORMS",
          items: [
            { to: ADMIN_FORMS, label: "Form Builder", icon: FilePenLine },
            { to: ADMIN_MY_FORMS, label: "My Forms", icon: FileStack },
          ],
        },
        {
          title: "REQUESTS",
          items: [
            {
              to: ADMIN_APPROVALS,
              label: "Approvals",
              icon: ClipboardCheck,
              badge: tickets?.pendingCount ?? notifications.length,
            },
            { to: ADMIN_REQUESTS, label: "Request Management", icon: Ticket },
            { to: ADMIN_ASSIGNED, label: "My Assignments", icon: UserCheck },
          ],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}
