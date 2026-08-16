import { FastifyReply, FastifyRequest } from 'fastify';
import { InvoicesRepository } from './invoices.repository';
import { createInvoiceSchema, getInvoicesQuerySchema } from './invoices.schema';
import { buildInvoiceHtml, buildPdfFilename, mapInvoiceToPdf, renderPdf } from './invoice-pdf.service';
import { UserPayload } from '../../common/types';
import { NotFoundError } from '../../common/errors/custom.error';

export class InvoicesController {
  private invoicesRepo = new InvoicesRepository();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId } = request.user as UserPayload;
    const body = createInvoiceSchema.parse(request.body);

    const invoice = await this.invoicesRepo.create(clinicId, userId, body);
    return reply.status(201).send({ success: true, data: invoice });
  };

  proForma = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const body = createInvoiceSchema.parse(request.body);

    const result = await this.invoicesRepo.computeProForma(clinicId, body);
    return reply.send({ success: true, data: result });
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const invoice = await this.invoicesRepo.findById(clinicId, id);
    if (!invoice) throw new NotFoundError('فاکتور مورد نظر یافت نشد');

    return reply.send({ success: true, data: invoice });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const query = getInvoicesQuerySchema.parse(request.query);

    const result = await this.invoicesRepo.findAll(clinicId, query);
    return reply.send({
      success: true,
      data: result.items,
      meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const deleted = await this.invoicesRepo.delete(clinicId, id);
    if (deleted.count === 0) throw new NotFoundError('فاکتور مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'فاکتور با موفقیت حذف شد' } });
  };

  getPdf = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const invoice = await this.invoicesRepo.findByIdForPdf(clinicId, id);
    if (!invoice) throw new NotFoundError('فاکتور مورد نظر یافت نشد');

    const html = buildInvoiceHtml(mapInvoiceToPdf(invoice));
    const pdf = await renderPdf(html);

    const { filename, filenameEncoded } = buildPdfFilename(mapInvoiceToPdf(invoice));
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="invoice.pdf"; filename*=UTF-8''${filenameEncoded}`)
      .send(pdf);
  };
}
