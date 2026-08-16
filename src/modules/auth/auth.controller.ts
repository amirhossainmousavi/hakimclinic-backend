import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { loginSchema, refreshTokenSchema } from './auth.schema';

export class AuthController {
  private authService = new AuthService();

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);

    const result = await this.authService.login(
      body,
      (payload) => request.server.jwt.sign(payload as never, { expiresIn: '15m' }),
      (payload) => request.server.jwt.sign(payload as never, { expiresIn: '7d' })
    );

    return reply.send({
      success: true,
      data: result,
    });
  };

  refreshToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshTokenSchema.parse(request.body);

    const result = await this.authService.refreshToken(
      body.refreshToken,
      (payload) => request.server.jwt.sign(payload as never, { expiresIn: '15m' }),
      (token) => request.server.jwt.verify(token)
    );

    return reply.send({
      success: true,
      data: result,
    });
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshTokenSchema.parse(request.body);
    await this.authService.logout(body.refreshToken);

    return reply.send({
      success: true,
      data: { message: 'با موفقیت خارج شدید' },
    });
  };
}
