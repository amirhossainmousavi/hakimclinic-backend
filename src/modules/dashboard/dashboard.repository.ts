import { prisma } from '../../common/prisma/prisma.client';

export class DashboardRepository {
  async getSummary(clinicId: string) {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfToday = new Date(startOfToday.getTime() + 86400000);
    const startOfTomorrow = new Date(endOfToday.getTime());
    const endOfTomorrow = new Date(startOfTomorrow.getTime() + 86400000);

    // Last 30 days for the revenue chart (the same window the frontend compares)
    const dayMs = 86400000;
    const todayOffset = Math.floor((startOfToday.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / dayMs);
    const endIdx = todayOffset + 1; // end of today
    const startIdx = endIdx - 30;

    const [
      todayRevenueAgg,
      todayAdmissions,
      todayAppointments,
      readyForDelivery,
      revenueRows,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: {
          clinicId,
          deletedAt: null,
          invoiceType: 'final',
          createdAt: { gte: startOfToday, lt: endOfToday },
        },
      }),
      prisma.patient.count({
        where: { clinicId, deletedAt: null, createdAt: { gte: startOfToday, lt: endOfToday } },
      }),
      prisma.appointment.count({
        where: { clinicId, appointmentDate: { gte: startOfToday, lt: endOfTomorrow } },
      }),
      prisma.patient.count({
        where: { clinicId, deletedAt: null, status: 'ready_for_delivery' },
      }),
      prisma.invoice.findMany({
        where: {
          clinicId,
          deletedAt: null,
          invoiceType: 'final',
        },
        select: { totalAmount: true, createdAt: true },
      }),
    ]);

    // Daily revenue for the last 30 days — ISO YYYY-MM-DD date (frontend parses with new Date(``T00:00:00``))
    const buckets = new Map<string, number>();
    for (let i = startIdx; i < endIdx; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), 0, 1) + i * dayMs);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }
    for (const r of revenueRows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) {
        buckets.set(key, buckets.get(key)! + Number(r.totalAmount ?? 0));
      }
    }

    const revenue30d = Array.from(buckets.entries()).map(([date, total]) => ({ date, total }));

    // Growth percentage compared to the previous 30 days
    const prevRows = await prisma.invoice.findMany({
      where: {
        clinicId,
        deletedAt: null,
        invoiceType: 'final',
        createdAt: { gte: new Date(startOfToday.getTime() - 30 * dayMs), lt: startOfToday },
      },
      select: { totalAmount: true },
    });
    const currentTotal = Array.from(buckets.values()).reduce((s, v) => s + v, 0);
    const previousTotal = prevRows.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0);
    const revenueGrowthPercent =
      previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null;

    // Alerts: patients "waiting for insurance approval" admitted more than 2 days ago
    const overdue = await prisma.patient.count({
      where: {
        clinicId,
        deletedAt: null,
        status: 'pending_insurance_approval',
        createdAt: { lt: new Date(startOfToday.getTime() - 2 * dayMs) },
      },
    });

    return {
      todayRevenue: todayRevenueAgg._sum.totalAmount ?? 0,
      todayAdmissions,
      todayAppointments,
      readyForDelivery,
      revenue30d,
      revenueGrowthPercent,
      alerts: overdue > 0 ? [{ type: 'insurance_overdue' as const, count: overdue }] : [],
    };
  }
}
