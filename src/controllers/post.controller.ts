import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PostService } from '../services/post.service';

const postService = new PostService();

export const createPostSchema = z.object({
  username: z.string().max(14),
  content: z.string().max(777).optional(),
  type: z.enum(['ORIGINAL', 'REPOST', 'QUOTE']),
  originalPostId: z.string().uuid().optional(),
});

export const listPostsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  filterByAuthor: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

type CreatePostInput = z.infer<typeof createPostSchema>;

export class PostController {
  async create(request: FastifyRequest<{ Body: CreatePostInput }>, reply: FastifyReply) {
    const { username, content, type, originalPostId } = request.body;

    try {
      const post = await postService.create({
        username,
        content,
        type,
        originalPostId,
      });

      return reply.status(201).send(post);
    } catch (error: any) {
      if (error.message === 'User not found') {
        return reply.status(404).send({ error: error.message });
      }
      if (error.message.includes('limit reached')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(400).send({ error: error.message || 'Internal Server Error' });
    }
  }

  async list(request: FastifyRequest<{ Querystring: z.infer<typeof listPostsSchema> }>, reply: FastifyReply) {
    const { page, filterByAuthor, startDate, endDate } = request.query;

    const result = await postService.list({
      page,
      filterByAuthor,
      startDate,
      endDate,
    });

    return reply.status(200).send(result);
  }
}