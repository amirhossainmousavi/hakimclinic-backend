import { prisma } from '../../common/prisma/prisma.client';
import { CreateInvoiceInput, GetInvoicesQuery } from './invoices.schema';

// Flatten nested items for the frontend
function flattenInvoiceItems(items: any[]) {
  return items.map(({ service, tariff, ...rest }) => ({
    ...rest,
    serviceName: service?.treatmentProcess ?? null,
    tariffId: tariff?.id ?? null,
    tariffName: tariff?.itemDescription ?? null,
  }));
}

export class InvoicesRepository {
  async create(clinicId: string, userId: string, data: CreateInvoiceInput) {
    const { items, ...invoiceData } = data;

    // Calculate total amount from items
    const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity - item.discountAmount), 0) - (data.discountTotal || 0) - (data.prepaidAmount || 0);

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          ...invoiceData,
          clinicId,
          createdByUserId: userId,
          totalAmount: totalAmount > 0 ? totalAmount : 0,
        },
      });

      const invoiceItems = items.map((item) => ({
        ...item,
        invoiceId: invoice.id,
        lineTotal: item.unitPrice * item.quantity - item.discountAmount,
      }));

      await tx.invoiceItem.createMany({
        data: invoiceItems,
      });

      const created = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          items: {
            include: { service: true, tariff: true },
          },
          patient: { select: { fullName: true, fileNumber: true } },
        },
      });
      if (!created) return null;
      const { items: createdItems, patient, ...invoiceRest } = created;
      return {
        ...invoiceRest,
        patientName: patient?.fullName ?? null,
        items: flattenInvoiceItems(createdItems),
      };
    });
  }

  async findById(clinicId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        items: {
          include: { service: true, tariff: true },
        },
        patient: { select: { fullName: true, fileNumber: true } },
        createdBy: { select: { id: true, fullName: true } },
        clinic: true,
      },
    });
    if (!invoice) return null;

    const { items, patient, ...rest } = invoice;
    return {
      ...rest,
      patientName: patient?.fullName ?? null,
      items: flattenInvoiceItems(items),
    };
  }

  // Compute pro-forma invoice without saving — enrich service/tariff names
  async computeProForma(clinicId: string, data: CreateInvoiceInput) {
    const items = data.items;
    const serviceIds = items.map((i) => i.serviceId);
    const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, clinicId } });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    const tariffCandidates = items.map((i) => i.tariffId).filter((t): t is string => !!t);
    const tariffs = tariffCandidates.length > 0
      ? await prisma.tariff.findMany({ where: { id: { in: tariffCandidates } } })
      : [];
    const tariffMap = new Map(tariffs.map((t) => [t.id, t]));

    const lineItems = items.map((item) => {
      const service = serviceMap.get(item.serviceId);
      const tariff = item.tariffId ? tariffMap.get(item.tariffId) : undefined;
      return {
        id: `pf-${item.serviceId}`,
        serviceId: item.serviceId,
        serviceName: service?.treatmentProcess ?? null,
        tariffId: item.tariffId ?? null,
        tariffName: tariff?.itemDescription ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount ?? 0,
        lineTotal: item.unitPrice * item.quantity - (item.discountAmount ?? 0),
      };
    });

    const itemTotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);
    const totalAmount = Math.max(0, itemTotal - (data.discountTotal ?? 0) - (data.prepaidAmount ?? 0));

    return {
      invoiceType: data.invoiceType,
      totalAmount,
      discountTotal: data.discountTotal ?? 0,
      items: lineItems,
    };
  }

  // For PDF rendering we need full nested (relation) data
  async findByIdForPdf(clinicId: string, id: string) {
    return prisma.invoice.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        items: { include: { service: true, tariff: true } },
        patient: true,
        clinic: true,
      },
    });
  }

  async findAll(clinicId: string, query: GetInvoicesQuery) {
    const { search, patientId, invoiceType, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { clinicId, deletedAt: null };
    if (search) where.invoiceNumber = { contains: search, mode: 'insensitive' };
    if (patientId) where.patientId = patientId;
    if (invoiceType) where.invoiceType = invoiceType;

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { fullName: true, fileNumber: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    const flatItems = items.map(({ patient, ...rest }) => ({
      ...rest,
      patientName: patient?.fullName ?? null,
    }));

    return { items: flatItems, total };
  }

  async delete(clinicId: string, id: string) {
    return prisma.invoice.updateMany({
      where: { id, clinicId },
      data: { deletedAt: new Date() },
    });
  }
}
