import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PostService } from './post.service';
import { prisma } from '../lib/prisma';

describe('PostService Integration Tests', () => {
  const postService = new PostService();

  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createUser(username: string) {
    return prisma.user.create({ data: { username } });
  }

  it('should create an original post successfully', async () => {
    await createUser('tester');

    const post = await postService.create({
      username: 'tester',
      type: 'ORIGINAL',
      content: 'Hello World',
    });

    expect(post.id).toBeDefined();
    expect(post.content).toBe('Hello World');
    expect(post.type).toBe('ORIGINAL');
  });

  it('should BLOCK the 6th post in the same day (Daily Limit)', async () => {
    await createUser('spammer');

    for (let i = 0; i < 5; i++) {
      await postService.create({
        username: 'spammer',
        type: 'ORIGINAL',
        content: `Post ${i}`,
      });
    }

    await expect(
      postService.create({
        username: 'spammer',
        type: 'ORIGINAL',
        content: 'This is the 6th post',
      })
    ).rejects.toThrow('Daily post limit reached');
  });

  it('should NOT allow reposting a repost', async () => {
    const user = await createUser('user_a');
    
    const original = await postService.create({
      username: 'user_a',
      type: 'ORIGINAL',
      content: 'Original Content',
    });

    const repost = await postService.create({
      username: 'user_a',
      type: 'REPOST',
      originalPostId: original.id,
    });

    await expect(
      postService.create({
        username: 'user_a',
        type: 'REPOST',
        originalPostId: repost.id,
      })
    ).rejects.toThrow('Cannot repost a repost');
  });

  it('should NOT allow quoting a quote-post', async () => {
    await createUser('user_b');
    
    const original = await postService.create({
      username: 'user_b',
      type: 'ORIGINAL',
      content: 'Original Content',
    });

    const quote = await postService.create({
      username: 'user_b',
      type: 'QUOTE',
      originalPostId: original.id,
      content: 'My commentary',
    });

    await expect(
      postService.create({
        username: 'user_b',
        type: 'QUOTE',
        originalPostId: quote.id,
        content: 'Commentary on commentary',
      })
    ).rejects.toThrow('Cannot quote-post a quote-post');
  });

  it('should allow quoting a repost', async () => {
    await createUser('user_c');
    
    const original = await postService.create({
      username: 'user_c',
      type: 'ORIGINAL',
      content: 'Original',
    });

    const repost = await postService.create({
      username: 'user_c',
      type: 'REPOST',
      originalPostId: original.id,
    });

    const quote = await postService.create({
      username: 'user_c',
      type: 'QUOTE',
      originalPostId: repost.id,
      content: 'Nice repost',
    });

    expect(quote.id).toBeDefined();
    expect(quote.type).toBe('QUOTE');
  });
});