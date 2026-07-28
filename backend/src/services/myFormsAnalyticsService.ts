import { Types } from "mongoose";
import type { AuthUser } from "../middleware/auth.js";
import { Form } from "../models/Form.js";
import { Ticket } from "../models/Ticket.js";

export type NamedCount = {
  name: string;
  count: number;
  percent: number;
};

export type MyFormsAnalytics = {
  rangeLabel: string;
  summary: {
    totalRequests: number;
    totalRequestsChangePct: number | null;
    totalDivisions: number;
    divisionsChangePct: number | null;
    mostRequestedService: string;
    mostRequestedCount: number;
    mostRequestedPercent: number;
    requestsThisMonth: number;
    requestsThisMonthChangePct: number | null;
  };
  byDivision: NamedCount[];
  byService: NamedCount[];
  monthlyTrend: Array<{ month: string; monthKey: string; count: number }>;
  insights: {
    mostActiveDivision: string;
    mostRequestedService: string;
    fastestGrowing: string;
    topSharePercent: number;
    averagePerDay: number;
  };
  topDivisions: NamedCount[];
  forms: Array<{
    _id: string;
    title: string;
    refNumber: string;
    status: string;
    requestCount: number;
    lastSubmissionAt: string | null;
    updatedAt: string;
    reviewRemarks?: string;
  }>;
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function monthBuckets(months = 12) {
  const buckets: Array<{ monthKey: string; month: string; start: Date }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      month: start.toLocaleString("en-US", { month: "short" }),
      start,
    });
  }
  return buckets;
}

function toNamedCounts(
  rows: Array<{ _id: string; count: number }>,
  total: number,
  limit = 8,
): NamedCount[] {
  return rows.slice(0, limit).map((row) => ({
    name: row._id?.trim() || "Unspecified",
    count: row.count,
    percent: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
  }));
}

export async function getMyFormsAnalytics(user: AuthUser): Promise<MyFormsAnalytics> {
  const forms = await Form.find({ createdBy: user.id }).sort({ updatedAt: -1 }).lean();
  const formIds = forms.map((f) => f._id as Types.ObjectId);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const buckets = monthBuckets(12);
  const rangeStart = buckets[0]!.start;

  const ticketMatch =
    formIds.length > 0 ? { formId: { $in: formIds } } : { formId: { $in: [] } };

  const [
    totalRequests,
    thisMonthCount,
    lastMonthCount,
    divisionRows,
    serviceRows,
    monthlyRows,
    thisMonthDivCount,
    lastMonthDivCount,
    ticketsByForm,
    lastSubmissions,
    thisMonthServices,
    lastMonthServices,
  ] = await Promise.all([
    Ticket.countDocuments(ticketMatch),
    Ticket.countDocuments({ ...ticketMatch, createdAt: { $gte: thisMonthStart } }),
    Ticket.countDocuments({
      ...ticketMatch,
      createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
    }),
    Ticket.aggregate<{ _id: string; count: number }>([
      { $match: ticketMatch },
      { $group: { _id: { $ifNull: ["$division", "Unspecified"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Ticket.aggregate<{ _id: string; count: number }>([
      { $match: ticketMatch },
      { $group: { _id: { $ifNull: ["$formTitle", "Other"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Ticket.aggregate<{ _id: { year: number; month: number }; count: number }>([
      { $match: { ...ticketMatch, createdAt: { $gte: rangeStart } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
    Ticket.aggregate<{ count: number }>([
      { $match: { ...ticketMatch, createdAt: { $gte: thisMonthStart } } },
      { $group: { _id: { $ifNull: ["$division", "Unspecified"] } } },
      { $count: "count" },
    ]),
    Ticket.aggregate<{ count: number }>([
      {
        $match: {
          ...ticketMatch,
          createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
        },
      },
      { $group: { _id: { $ifNull: ["$division", "Unspecified"] } } },
      { $count: "count" },
    ]),
    Ticket.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: ticketMatch },
      { $group: { _id: "$formId", count: { $sum: 1 } } },
    ]),
    Ticket.aggregate<{ _id: Types.ObjectId; lastAt: Date }>([
      { $match: ticketMatch },
      { $group: { _id: "$formId", lastAt: { $max: "$createdAt" } } },
    ]),
    Ticket.aggregate<{ _id: string; count: number }>([
      { $match: { ...ticketMatch, createdAt: { $gte: thisMonthStart } } },
      { $group: { _id: { $ifNull: ["$formTitle", "Other"] }, count: { $sum: 1 } } },
    ]),
    Ticket.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          ...ticketMatch,
          createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
        },
      },
      { $group: { _id: { $ifNull: ["$formTitle", "Other"] }, count: { $sum: 1 } } },
    ]),
  ]);

  const byDivision = toNamedCounts(divisionRows, totalRequests, 8);
  const byService = toNamedCounts(serviceRows, totalRequests, 6);
  const topDivisions = toNamedCounts(divisionRows, totalRequests, 5);

  const monthlyMap = new Map(
    monthlyRows.map((row) => [
      `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
      row.count,
    ]),
  );
  const monthlyTrend = buckets.map((b) => ({
    month: b.month,
    monthKey: b.monthKey,
    count: monthlyMap.get(b.monthKey) ?? 0,
  }));

  const countByForm = new Map(ticketsByForm.map((r) => [String(r._id), r.count]));
  const lastByForm = new Map(lastSubmissions.map((r) => [String(r._id), r.lastAt]));

  const topService = byService[0];
  const topDivision = byDivision[0];
  const daysInMonth = Math.max(1, now.getDate());
  const averagePerDay = Math.round((thisMonthCount / daysInMonth) * 10) / 10;

  const lastMap = new Map(lastMonthServices.map((r) => [r._id, r.count]));
  let fastestGrowing = topService?.name ?? "—";
  let bestGrowth = -Infinity;
  for (const row of thisMonthServices) {
    const prev = lastMap.get(row._id) ?? 0;
    const growth = row.count - prev;
    if (growth > bestGrowth) {
      bestGrowth = growth;
      fastestGrowing = row._id || "—";
    }
  }

  const rangeLabel = `${thisMonthStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} – ${now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return {
    rangeLabel,
    summary: {
      totalRequests,
      totalRequestsChangePct: pctChange(thisMonthCount, lastMonthCount),
      totalDivisions: divisionRows.length,
      divisionsChangePct: pctChange(
        thisMonthDivCount[0]?.count ?? 0,
        lastMonthDivCount[0]?.count ?? 0,
      ),
      mostRequestedService: topService?.name ?? "—",
      mostRequestedCount: topService?.count ?? 0,
      mostRequestedPercent: topService?.percent ?? 0,
      requestsThisMonth: thisMonthCount,
      requestsThisMonthChangePct: pctChange(thisMonthCount, lastMonthCount),
    },
    byDivision,
    byService,
    monthlyTrend,
    insights: {
      mostActiveDivision: topDivision?.name ?? "—",
      mostRequestedService: topService?.name ?? "—",
      fastestGrowing,
      topSharePercent: topService?.percent ?? 0,
      averagePerDay,
    },
    topDivisions,
    forms: forms.map((f) => ({
      _id: String(f._id),
      title: f.title,
      refNumber: f.refNumber,
      status: f.status,
      requestCount: countByForm.get(String(f._id)) ?? 0,
      lastSubmissionAt: lastByForm.get(String(f._id))?.toISOString() ?? null,
      updatedAt: (f.updatedAt as Date).toISOString(),
      reviewRemarks: f.reviewRemarks || undefined,
    })),
  };
}
