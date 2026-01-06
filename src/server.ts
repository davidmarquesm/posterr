import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { createPostSchema, listPostsSchema, PostController } from './controllers/post.controller';
import { UserController } from './controllers/user.controller';
import { z } from 'zod';
import { prisma } from './lib/prisma';

const postController = new PostController();
const userController = new UserController();

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.get('/health', async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return reply.status(200).send({ status: 'ok', db: 'connected', timestamp: new Date() });
  } catch (error) {
    app.log.error(error);
    return reply.status(503).send({ status: 'error', db: 'disconnected' });
  }
});

app.withTypeProvider<ZodTypeProvider>().post(
  '/posts',
  {
    schema: {
      body: createPostSchema,
      response: {
        201: z.object({
            id: z.string(),
            content: z.string().nullable(),
            type: z.string(),
            createdAt: z.date()
        }),
      },
    },
  },
  postController.create
);

app.withTypeProvider<ZodTypeProvider>().get(
  '/posts',
  {
    schema: {
      querystring: listPostsSchema,
    },
  },
  postController.list
);

app.withTypeProvider<ZodTypeProvider>().get(
  '/users/:username',
  {
    schema: {
      params: z.object({
        username: z.string(),
      }),
    },
  },
  userController.getProfile
);

async function bootstrap() {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Server running on http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const shutdown = async () => {
  console.log('Shutting down server...');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();