import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('registers a new user and returns token', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'user_1',
          email: 'rider@example.com',
          passwordHash: 'hashed'
        })
      }
    };

    const jwtService = { signAsync: vi.fn().mockResolvedValue('token_123') } as unknown as JwtService;
    const service = new AuthService(prisma as any, jwtService);

    const result = await service.register({
      email: 'rider@example.com',
      password: 'password123'
    });

    expect(result.accessToken).toBe('token_123');
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('rejects duplicate registrations', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user_1', email: 'rider@example.com' })
      }
    };

    const service = new AuthService(prisma as any, { signAsync: vi.fn() } as unknown as JwtService);

    await expect(
      service.register({
        email: 'rider@example.com',
        password: 'password123'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };

    const service = new AuthService(prisma as any, { signAsync: vi.fn() } as unknown as JwtService);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'password123'
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
