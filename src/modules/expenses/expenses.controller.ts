import { FastifyReply, FastifyRequest } from 'fastify';
import { ExpensesRepository } from './expenses.repository';
import {
  createDailyExpenseSchema,
  createCompanyExpenseSchema,
  getExpensesQuerySchema,
  getMonthlyChartQuerySchema,
  getUnifiedExpensesQuerySchema,
} from './expenses.schema';
import { UserPayload } from '../../common/types';

export class ExpensesController {
  private expensesRepo = new ExpensesRepository();

  createDaily = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId } = request.user as UserPayload;
    const body = createDailyExpenseSchema.parse(request.body);
    const expense = await this.expensesRepo.createDaily(clinicId, userId, body);
    return reply.status(201).send({ success: true, data: expense });
  };

  createCompany = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId } = request.user as UserPayload;
    const body = createCompanyExpenseSchema.parse(request.body);
    const expense = await this.expensesRepo.createCompany(clinicId, userId, body);
    return reply.status(201).send({ success: true, data: expense });
  };

  listDaily = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const query = getExpensesQuerySchema.parse(request.query);
    const items = await this.expensesRepo.getDailyExpenses(clinicId, query, role === 'manager' ? undefined : scopes);
    return reply.send({ success: true, data: items });
  };

  monthlyChart = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const query = getMonthlyChartQuerySchema.parse(request.query);
    const chart = await this.expensesRepo.getMonthlyChart(clinicId, query, role === 'manager' ? undefined : scopes);
    return reply.send({ success: true, data: chart });
  };

  listCompany = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const query = getExpensesQuerySchema.parse(request.query);
    const items = await this.expensesRepo.getCompanyExpenses(clinicId, query);
    return reply.send({ success: true, data: items });
  };

  listUnified = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const query = getUnifiedExpensesQuerySchema.parse(request.query);
    const result = await this.expensesRepo.getUnifiedExpenses(
      clinicId,
      query,
      role === 'manager' ? undefined : scopes
    );
    return reply.send({ success: true, data: result.items, meta: result.meta });
  };

  monthlyComparison = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const entries = await this.expensesRepo.getMonthlyComparison(clinicId);
    return reply.send({ success: true, data: entries });
  };
}
