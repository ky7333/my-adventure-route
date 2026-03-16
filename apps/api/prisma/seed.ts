import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/adventure_route';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_LOCAL_DATABASE_URL;
  console.warn('[seed] DATABASE_URL not set. Falling back to a local development default.');
}

const prisma = new PrismaClient();

type ResolvedDemoPassword = {
  value: string;
  source: 'env' | 'generated';
};

function resolveDemoPassword(): ResolvedDemoPassword {
  const configuredPassword = process.env.SEED_DEMO_PASSWORD?.trim();
  if (configuredPassword) {
    return {
      value: configuredPassword,
      source: 'env'
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('[seed] SEED_DEMO_PASSWORD is required when NODE_ENV=production.');
  }

  return {
    value: randomBytes(24).toString('base64url'),
    source: 'generated'
  };
}

async function main(): Promise<void> {
  const email = 'demo@adventureroute.dev';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed user already exists: ${email}`);
    return;
  }

  const demoPassword = resolveDemoPassword();
  const passwordHash = await bcrypt.hash(demoPassword.value, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash
    }
  });

  if (process.env.NODE_ENV !== 'production' && demoPassword.source === 'generated') {
    console.log(`[seed] Seeded demo user ${email}. Generated password: ${demoPassword.value}`);
    return;
  }

  console.log(`[seed] Seeded demo user ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
