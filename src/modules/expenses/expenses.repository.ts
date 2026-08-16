import { prisma } from '../../common/prisma/prisma.client';
import {
  CreateDailyExpenseInput,
  CreateCompanyExpenseInput,
  GetExpensesQuery,
  GetMonthlyChartQuery,
  GetUnifiedExpensesQuery,
} from './expenses.schema';
import {
  getJalaliMonthLength,
  jalaliDayKey,
  shiftMonth,
  toGregorian,
  toJalali,
} from '../../common/utils/jalali';

/** Bounds of the current and previous solar months for the two-line chart */
function jalaliMonthBounds(now: Date): {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
} {
  const startOfDay = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86400000);

  const j = toJalali(now);
  const currentStart = toGregorian({ year: j.year, month: j.month, day: 1 });
  const currentLen = getJalaliMonthLength(j.year, j.month);
  const currentEnd = addDays(currentStart, currentLen - 1);

  const prev = shiftMonth(j.year, j.month, -1);
  const previousStart = toGregorian({ year: prev.year, month: prev.month, day: 1 });
  const previousLen = getJalaliMonthLength(prev.year, prev.month);
  const previousEnd = addDays(previousStart, previousLen - 1);

  const cap = startOfDay(now);
  return {
    currentStart: startOfDay(currentStart),
    currentEnd: currentEnd <= cap ? currentEnd : cap,
    previousStart: startOfDay(previousStart),
    previousEnd: previousEnd <= cap ? previousEnd : cap,
  };
}

export class ExpensesRepository {
  async createDaily(clinicId: string, userId: string, data: CreateDailyExpenseInput) {
    return prisma.dailyExpense.create({
      data: {
        title: data.title,
        amount: data.amount,
        expenseDate: data.expenseDate,
        admissionPlaceId: data.admissionPlaceId ?? null,
        description: data.description ?? null,
        clinicId,
        createdByUserId: userId,
      },
    });
  }

  async createCompany(clinicId: string, userId: string, data: CreateCompanyExpenseInput) {
    return prisma.companyInvoice.create({
      data: {
        ...data,
        // Frontend sends these fields optionally; the database is NOT NULL
        partName: data.partName ?? '',
        quantity: data.quantity ?? 1,
        unitAmount: data.unitAmount ?? 0,
        clinicId,
        createdByUserId: userId,
      },
    });
  }

  async getDailyExpenses(clinicId: string, query: GetExpensesQuery, scopes?: string[]) {
    const { dateFrom, dateTo, admissionPlaceId } = query;
    const where: any = { clinicId };
    if (dateFrom || dateTo) {
      where.expenseDate = {};
      if (dateFrom) where.expenseDate.gte = dateFrom;
      if (dateTo) where.expenseDate.lte = dateTo;
    }
    if (scopes && scopes.length > 0) {
      where.admissionPlaceId = { in: scopes };
    } else if (admissionPlaceId) {
      where.admissionPlaceId = admissionPlaceId;
    }

    return prisma.dailyExpense.findMany({
      where,
      include: {
        admissionPlace: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async getCompanyExpenses(clinicId: string, query: GetExpensesQuery) {
    const { dateFrom, dateTo } = query;
    const where: any = { clinicId };
    if (dateFrom || dateTo) {
      where.invoiceDate = {};
      if (dateFrom) where.invoiceDate.gte = dateFrom;
      if (dateTo) where.invoiceDate.lte = dateTo;
    }
    return prisma.companyInvoice.findMany({ where, orderBy: { invoiceDate: 'desc' } });
  }

  // Unified list: daily expenses + purchase invoices with a type discriminator
  async getUnifiedExpenses(clinicId: string, query: GetUnifiedExpensesQuery, scopes?: string[]) {
    const { search, type, from, to, admissionPlaceId, page, limit } = query;
    const skip = (page - 1) * limit;

    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    const dailyWhere: any = { clinicId };
    const companyWhere: any = { clinicId };
    if (search) {
      dailyWhere.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
      companyWhere.OR = [
        { title: { contains: search } },
        { companyName: { contains: search } },
        { partName: { contains: search } },
      ];
    }
    if (from || to) {
      dailyWhere.expenseDate = dateFilter;
      companyWhere.invoiceDate = dateFilter;
    }
    if (scopes && scopes.length > 0) {
      dailyWhere.admissionPlaceId = { in: scopes };
    } else if (admissionPlaceId) {
      dailyWhere.admissionPlaceId = admissionPlaceId;
    }

    const [daily, company, dailyTotal, companyTotal] = await Promise.all([
      prisma.dailyExpense.findMany({
        where: dailyWhere,
        include: { admissionPlace: { select: { id: true, name: true } } },
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.companyInvoice.findMany({
        where: companyWhere,
        orderBy: { invoiceDate: 'desc' },
      }),
      prisma.dailyExpense.count({ where: dailyWhere }),
      prisma.companyInvoice.count({ where: companyWhere }),
    ]);

    const all: any[] = [
      ...daily.map(({ admissionPlace, ...rest }) => ({
        ...rest,
        type: 'daily' as const,
        admissionPlaceName: admissionPlace?.name ?? null,
      })),
      ...company.map((c) => ({ ...c, type: 'company' as const })),
    ];

    // Unified sorting: newest expenseDate/invoiceDate first
    const sorted = all.sort((a, b) => {
      const ta = a.expenseDate ?? a.invoiceDate;
      const tb = b.expenseDate ?? b.invoiceDate;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    const filtered = type ? sorted.filter((e) => e.type === type) : sorted;
    const total = type === 'daily' ? dailyTotal : type === 'company' ? companyTotal : dailyTotal + companyTotal;

    return {
      items: filtered.slice(skip, skip + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Monthly comparison of daily expenses vs. purchase invoices (last 6 solar months)
  async getMonthlyComparison(clinicId: string) {
    const now = new Date();
    const months: { month: string; start: Date; end: Date }[] = [];
    const monthLabel = (year: number, month: number) => {
      const n = String(month + 1).padStart(2, '0');
      return `${year}/${n}`;
    };

    let j = toJalali(now);
    for (let i = 5; i >= 0; i--) {
      const shifted = shiftMonth(j.year, j.month, -i);
      const start = toGregorian({ year: shifted.year, month: shifted.month, day: 1 });
      const len = getJalaliMonthLength(shifted.year, shifted.month);
      const end = new Date(start.getTime() + (len - 1) * 86400000);
      const cap = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      months.push({
        month: monthLabel(shifted.year, shifted.month),
        start,
        end: end <= cap ? end : cap,
      });
    }

    const dailyRows = await prisma.dailyExpense.findMany({
      where: { clinicId },
      select: { amount: true, expenseDate: true },
    });
    const companyRows = await prisma.companyInvoice.findMany({
      where: { clinicId },
      select: { amount: true, invoiceDate: true },
    });

    const inMonth = (date: Date, start: Date, end: Date) => date >= start && date <= end;
    return months.map((m) => ({
      month: m.month,
      dailyTotal: dailyRows
        .filter((r) => inMonth(r.expenseDate, m.start, m.end))
        .reduce((s, r) => s + Number(r.amount ?? 0), 0),
      companyTotal: companyRows
        .filter((r) => inMonth(r.invoiceDate, m.start, m.end))
        .reduce((s, r) => s + Number(r.amount ?? 0), 0),
    }));
  }

  async getMonthlyChart(clinicId: string, query: GetMonthlyChartQuery, scopes?: string[]) {
    const { admissionPlaceId } = query;
    const baseWhere: any = { clinicId };
    if (scopes && scopes.length > 0) {
      baseWhere.admissionPlaceId = { in: scopes };
    } else if (admissionPlaceId) {
      baseWhere.admissionPlaceId = admissionPlaceId;
    }

    const bounds = jalaliMonthBounds(new Date());

    const bucketize = async (from: Date, to: Date) => {
      if (from > to) return new Map<string, number>();
      const rows = await prisma.dailyExpense.findMany({
        where: { ...baseWhere, expenseDate: { gte: from, lte: to } },
        select: { expenseDate: true, amount: true },
      });
      const map = new Map<string, number>();
      for (const r of rows) {
        const key = jalaliDayKey(r.expenseDate);
        map.set(key, (map.get(key) ?? 0) + Number(r.amount ?? 0));
      }
      return map;
    };

    const [current, previous] = await Promise.all([
      bucketize(bounds.currentStart, bounds.currentEnd),
      bucketize(bounds.previousStart, bounds.previousEnd),
    ]);

    const days = Math.max(current.size, previous.size);
    const chart = Array.from({ length: days }, (_, i) => {
      const date = new Date(bounds.currentStart.getTime() + i * 86400000);
      const key = jalaliDayKey(date);
      return {
        date: key,
        current: current.get(key) ?? 0,
        previous: previous.get(key) ?? 0,
      };
    });
    return chart;
  }
}
