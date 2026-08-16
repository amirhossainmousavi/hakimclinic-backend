import { prisma } from '../../common/prisma/prisma.client';
import { GetRevenueQuery } from './reports.schema';

export class ReportsRepository {
  async revenue(clinicId: string, query: GetRevenueQuery) {
    const { from, to, paymentType, admissionPlaceId } = query;

    const where: any = { clinicId, deletedAt: null, invoiceType: 'final' };
    if (from) where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(from) };
    if (to) where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(to) };
    if (paymentType) where.paymentType = paymentType;
    if (admissionPlaceId) {
      where.patient = { admissionPlaceId };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true, admissionPlaceId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalAmount = invoices.reduce((s, iv) => s + Number(iv.totalAmount ?? 0), 0);
    const finalCount = invoices.length;

    const proFormaCount = await prisma.invoice.count({
      where: {
        clinicId,
        deletedAt: null,
        invoiceType: 'pro_forma',
        ...(admissionPlaceId ? { patient: { admissionPlaceId } } : {}),
      },
    });

    const byPaymentType: Record<string, { count: number; total: number }> = {
      card_to_card: { count: 0, total: 0 },
      pos: { count: 0, total: 0 },
      bank_transfer: { count: 0, total: 0 },
    };
    for (const iv of invoices) {
      const key = iv.paymentType;
      if (key in byPaymentType) {
        byPaymentType[key].count += 1;
        byPaymentType[key].total += Number(iv.totalAmount ?? 0);
      }
    }

    const byDay = new Map<string, number>();
    for (const iv of invoices) {
      const day = iv.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(iv.totalAmount ?? 0));
    }
    const chart = [...byDay.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      summary: { totalAmount, count: finalCount, proFormaCount, finalCount, byPaymentType },
      chart,
    };
  }
}
