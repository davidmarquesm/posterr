import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  const usersData = [
    { username: 'johndoe' },
    { username: 'janedoe' },
    { username: 'bobsmith' },
    { username: 'alicejones' },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        joinedAt: new Date(),
      },
    });
  }

  const user1 = await prisma.user.findUnique({ where: { username: 'johndoe' } });
  const user2 = await prisma.user.findUnique({ where: { username: 'janedoe' } });

  if (user1 && user2) {
    const post1 = await prisma.post.create({
      data: {
        authorId: user1.id,
        content: 'This is the very first post on Posterr!',
        type: 'ORIGINAL',
        createdAt: new Date('2025-01-01T10:00:00Z'),
      },
    });
    console.log(`Post created for ${user1.username}`);

    await prisma.post.create({
      data: {
        authorId: user2.id,
        type: 'REPOST',
        originalPostId: post1.id,
        createdAt: new Date('2025-01-02T12:00:00Z'),
      },
    });
    console.log(`Cycles Repost created for ${user2.username}`);

    await prisma.post.create({
      data: {
        authorId: user1.id,
        content: 'Testing the daily limit logic.',
        type: 'ORIGINAL',
      },
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });