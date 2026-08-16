import { FastifyReply, FastifyRequest } from 'fastify';
import { DashboardRepository } from './dashboard.repository';
import { UserPayload } from '../../common/types';

export class DashboardController {
  private dashboardRepo = new DashboardRepository();

  summary = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const summary = await this.dashboardRepo.getSummary(clinicId);
    return reply.send({ success: true, data: summary });
  };
}
