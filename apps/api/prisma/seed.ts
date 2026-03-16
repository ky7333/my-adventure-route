import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/adventure_route';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_LOCAL_DATABASE_URL;
  console.warn('[seed] DATABASE_URL not set. Falling back to a local development default.');
}

const prisma = new PrismaClient();

function resolveDemoPassword(): string {
  const configuredPassword = process.env.SEED_DEMO_PASSWORD?.trim();
  if (configuredPassword) {
    return configuredPassword;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('[seed] SEED_DEMO_PASSWORD is required when NODE_ENV=production.');
  }

  return randomBytes(24).toString('base64url');
}

async function main(): Promise<void> {
  const email = 'demo@adventureroute.dev';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(resolveDemoPassword(), 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash
    }
  });

  console.log(`[seed] Seeded demo user ${email}. Password is sourced from env or generated locally.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
