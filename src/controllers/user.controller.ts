import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';

export class UserController {
  async getProfile(
    request: FastifyRequest<{ Params: { username: string } }>,
    reply: FastifyReply
  ) {
    const { username } = request.params;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const postCount = await prisma.post.count({
      where: { authorId: user.id },
    });

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(user.joinedAt);

    return reply.status(200).send({
      username: user.username,
      dateJoined: formattedDate,
      postCount: postCount,
    });
  }
}