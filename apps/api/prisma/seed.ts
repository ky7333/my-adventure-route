import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/adventure_route';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_LOCAL_DATABASE_URL;
  console.warn(
    `[seed] DATABASE_URL not set. Falling back to local default: ${DEFAULT_LOCAL_DATABASE_URL}`
  );
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = 'demo@adventureroute.dev';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash
    }
  });

  console.log(`Seeded user ${email} with password password123`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
