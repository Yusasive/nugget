import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { AuthTokens, LoginResponse } from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt-payload.type';

const REFRESH_TOKEN_BYTES = 48;

interface TokenSubject {
  staffId: string;
  role: JwtPayload['role'];
  branchId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { role: true, branch: true },
    });

    // Same generic failure for "no such staff" and "wrong password" — don't
    // let the response shape reveal which one it was.
    if (
      !staff ||
      !staff.isActive ||
      !(await argon2.verify(staff.passwordHash, password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Milestone 11's login activity log, extending the existing audit log
    // rather than a dedicated table (TRD's "login activity log per staff
    // member" is just a filtered view over AuditLog entityType=Staff,
    // action=auth.login). Written in the same transaction as lastLoginAt so
    // the two can't drift.
    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id: staff.id },
        data: { lastLoginAt: new Date() },
      });
      await this.audit.record(tx, {
        staffId: staff.id,
        branchId: staff.branchId,
        action: 'auth.login',
        entityType: 'Staff',
        entityId: staff.id,
      });
    });

    const tokens = await this.issueTokens({
      staffId: staff.id,
      role: staff.role.name as JwtPayload['role'],
      branchId: staff.branchId,
    });

    return {
      ...tokens,
      staff: {
        id: staff.id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role.name as JwtPayload['role'],
        branchId: staff.branchId,
        branchName: staff.branch.name,
        departmentId: staff.departmentId,
      },
    };
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { staff: { include: { role: true } } },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      !stored.staff.isActive
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens({
      staffId: stored.staff.id,
      role: stored.staff.role.name as JwtPayload['role'],
      branchId: stored.staff.branchId,
    });
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    // Idempotent by design: revoking a token that's unknown or already
    // revoked is not an error the caller needs to know about.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    staffId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
    });

    if (!(await argon2.verify(staff.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({ where: { id: staffId }, data: { passwordHash } });
      // Every other session gets signed out on the next refresh — the
      // access token behind *this* request stays valid until it naturally
      // expires, so the user isn't kicked out mid-request.
      await tx.refreshToken.updateMany({
        where: { staffId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, {
        staffId,
        branchId: staff.branchId,
        action: 'auth.change-password',
        entityType: 'Staff',
        entityId: staffId,
      });
    });
  }

  private async issueTokens(subject: TokenSubject): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: subject.staffId,
      role: subject.role,
      branchId: subject.branchId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const rawRefreshToken =
      randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const refreshTtlDays =
      this.configService.get<number>('JWT_REFRESH_TTL_DAYS') ?? 7;
    const expiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        staffId: subject.staffId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
