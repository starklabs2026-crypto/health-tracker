/**
 * Database seed (playbook §0.1.9). Run via `npm run db:seed`.
 *  1. Upserts every catalog parameter (source of truth = parameter-catalog pkg).
 *  2. In development only, creates two demo users + a pending family link.
 *
 * Requires the DB to be up and migrated. Loads the root .env via dotenv-cli.
 */
import { PARAMETER_SEED } from '@medical-tracker/parameter-catalog';
import { logger } from '@medical-tracker/phi-scrubber';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCatalog(): Promise<number> {
  for (const entry of PARAMETER_SEED) {
    const data = {
      id: entry.id,
      canonicalName: entry.canonicalName,
      aliases: entry.aliases,
      unit: entry.unit,
      panel: entry.panel,
      rangeDefault: entry.rangeDefault as unknown as Prisma.InputJsonValue,
      criticalLow: entry.criticalLow,
      criticalHigh: entry.criticalHigh,
    };
    await prisma.parameterCatalog.upsert({
      where: { canonicalName: entry.canonicalName },
      create: data,
      update: data,
    });
  }
  return prisma.parameterCatalog.count();
}

async function seedDemoUsers(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    logger.info('Skipping demo users (NODE_ENV != development)');
    return;
  }

  const alice = await prisma.user.upsert({
    where: { email: 'alice@test.local' },
    update: {},
    create: {
      email: 'alice@test.local',
      phone: '+15550001',
      name: 'Alice Demo',
      dob: new Date('1986-04-12'),
      sex: 'female',
      unitsPreference: 'metric',
      bloodGroup: 'O+',
      residencyRegion: 'US',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@test.local' },
    update: {},
    create: {
      email: 'bob@test.local',
      phone: '+15550002',
      name: 'Bob Demo',
      dob: new Date('1979-11-03'),
      sex: 'male',
      unitsPreference: 'imperial',
      bloodGroup: 'A+',
      residencyRegion: 'US',
    },
  });

  // A pending family link from Alice (owner) to Bob (member) for easy testing.
  const existing = await prisma.familyLink.findFirst({
    where: { ownerUserId: alice.id, memberUserId: bob.id },
  });
  if (!existing) {
    await prisma.familyLink.create({
      data: {
        ownerUserId: alice.id,
        memberUserId: bob.id,
        role: 'viewer',
        permissions: { docTypes: [] } as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
    });
  }
  logger.info('Demo users + pending family link ready');
}

async function main(): Promise<void> {
  const count = await seedCatalog();
  logger.info('Parameter catalog seeded', { count });
  await seedDemoUsers();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logger.error('Seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
