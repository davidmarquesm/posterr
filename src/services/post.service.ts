import { prisma } from '../lib/prisma';
import { PostType } from '@prisma/client';

interface CreatePostDTO {
  username: string;
  content?: string;
  type: PostType;
  originalPostId?: string;
}

interface PostFilterDTO {
  page: number;
  limit?: number;
  filterByAuthor?: string;
  startDate?: string;
  endDate?: string;
}

export class PostService {
  async create(data: CreatePostDTO) {
    const user = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const postsToday = await prisma.post.count({
      where: {
        authorId: user.id,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (postsToday >= 5) {
      throw new Error('Daily post limit reached (max 5)');
    }

    if (data.type === 'REPOST' || data.type === 'QUOTE') {
        if (!data.originalPostId) {
            throw new Error('Original post ID is required for Reposts/Quotes');
        }
        
        const originalPost = await prisma.post.findUnique({
             where: { id: data.originalPostId } 
        });

        if (!originalPost) throw new Error('Original post not found');

        if (data.type === 'REPOST' && originalPost.type === 'REPOST') {
             throw new Error('Cannot repost a repost');
        }
        if (data.type === 'QUOTE' && originalPost.type === 'QUOTE') {
             throw new Error('Cannot quote-post a quote-post');
        }
    }

    return prisma.post.create({
      data: {
        content: data.content,
        type: data.type,
        authorId: user.id,
        originalPostId: data.originalPostId,
      },
    });
  }

  async list(filters: PostFilterDTO) {
    const take = filters.limit || 10;
    const skip = (filters.page - 1) * take;

    const whereClause: any = {};

    if (filters.filterByAuthor) {
      const user = await prisma.user.findUnique({
        where: { username: filters.filterByAuthor },
      });
      
      if (user) {
        whereClause.authorId = user.id;
      } else {
        return { data: [], total: 0, page: filters.page };
      }
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        take,
        skip,
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { username: true, joinedAt: true },
          },
          originalPost: {
            include: {
              author: { select: { username: true } },
            },
          },
        },
      }),
      prisma.post.count({ where: whereClause }),
    ]);

    return {
      data: posts,
      total,
      page: filters.page,
      totalPages: Math.ceil(total / take),
    };
  }
}