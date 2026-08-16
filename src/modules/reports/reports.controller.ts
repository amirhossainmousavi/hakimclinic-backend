import { FastifyReply, FastifyRequest } from 'fastify';
import { ReportsRepository } from './reports.repository';
import { getRevenueQuerySchema } from './reports.schema';
import { UserPayload } from '../../common/types';

export class ReportsController {
  private reportsRepo = new ReportsRepository();

  revenue = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const query = getRevenueQuerySchema.parse(request.query);

    const report = await this.reportsRepo.revenue(clinicId, query);
    return reply.send({ success: true, data: report });
  };
}
