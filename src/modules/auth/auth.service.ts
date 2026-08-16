import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { LoginInput } from './auth.schema';
import { UnauthorizedError } from '../../common/errors/custom.error';

export class AuthService {
  private authRepo = new AuthRepository();

  async login(input: LoginInput, jwtSign: (payload: object, options?: object) => string, jwtRefreshSign: (payload: object, options?: object) => string) {
    const user = await this.authRepo.findUserByNationalCodeAndPhone(input.nationalCode, input.phone);
    if (!user) {
      throw new UnauthorizedError('کاربر با این مشخصات یافت نشد یا غیرفعال است');
    }

    // اگر password ارسال نشود، طبق معماری هش شماره موبایل به‌عنوان پسورد پیش‌فرض چک می‌شود
    const passwordToCheck = input.password ?? user.phone;
    const isPasswordValid = await bcrypt.compare(passwordToCheck, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('رمز عبور اشتباه است');
    }

    const scopes = user.secretaryScopes.map((s) => s.placeId);
    const permissions = user.secretaryPermissions.map((p) => p.permissionKey);

    const payload = {
      sub: user.id,
      userId: user.id,
      clinicId: user.clinicId,
      role: user.role,
      scopes,
      permissions,
    };

    const accessToken = jwtSign(payload);
    const refreshToken = jwtRefreshSign(payload);

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.authRepo.saveRefreshToken(user.id, tokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        nationalCode: user.nationalCode,
        phone: user.phone,
        role: user.role,
        clinicId: user.clinicId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refreshToken(refreshToken: string, jwtSign: (payload: object) => string, jwtRefreshVerify: (token: string) => any) {
    let decoded: any;
    try {
      decoded = jwtRefreshVerify(refreshToken);
    } catch (e) {
      throw new UnauthorizedError('رفرش توکن نامعتبر یا منقضی شده است');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await this.authRepo.findRefreshToken(decoded.userId, tokenHash);

    if (!storedToken) {
      throw new UnauthorizedError('رفرش توکن در سیستم یافت نشد یا باطل شده است');
    }

    const user = await this.authRepo.findUserById(decoded.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('کاربر یافت نشد یا غیرفعال است');
    }

    const scopes = user.secretaryScopes.map((s) => s.placeId);
    const permissions = user.secretaryPermissions.map((p) => p.permissionKey);
    const payload = {
      sub: user.id,
      userId: user.id,
      clinicId: user.clinicId,
      role: user.role,
      scopes,
      permissions,
    };

    const newAccessToken = jwtSign(payload);

    return {
      accessToken: newAccessToken,
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await this.authRepo.findRefreshTokenByHash(tokenHash);
    if (!storedToken) {
      return { success: true };
    }
    await this.authRepo.revokeRefreshToken(storedToken.id);
    return { success: true };
  }
}
