import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authResponseSchema, type AuthLoginRequest, type AuthRegisterRequest } from '@adventure/contracts';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService
  ) {}

  async register(input: AuthRegisterRequest) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash
      }
    });

    return authResponseSchema.parse({
      accessToken: await this.signToken(user.id, user.email),
      user: {
        id: user.id,
        email: user.email
      }
    });
  }

  async login(input: AuthLoginRequest) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return authResponseSchema.parse({
      accessToken: await this.signToken(user.id, user.email),
      user: {
        id: user.id,
        email: user.email
      }
    });
  }

  private async signToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, email });
  }
}
