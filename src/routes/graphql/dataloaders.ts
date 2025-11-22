import DataLoader from 'dataloader';
import { PrismaClient, Post, Profile, MemberType, User } from '@prisma/client';

export const createDataLoaders = (prisma: PrismaClient) => {
  const postsByAuthorIdLoader = new DataLoader<string, Post[]>(async (authorIds) => {
    const posts = await prisma.post.findMany({
      where: {
        authorId: {
          in: [...authorIds],
        },
      },
    });

    const postsByAuthorId = new Map<string, Post[]>();
    for (const authorId of authorIds) {
      postsByAuthorId.set(authorId, []);
    }

    for (const post of posts) {
      const authorPosts = postsByAuthorId.get(post.authorId) || [];
      authorPosts.push(post);
      postsByAuthorId.set(post.authorId, authorPosts);
    }

    return authorIds.map((authorId) => postsByAuthorId.get(authorId) || []);
  });

  const profileByUserIdLoader = new DataLoader<string, Profile | null>(
    async (userIds) => {
      const profiles = await prisma.profile.findMany({
        where: {
          userId: {
            in: [...userIds],
          },
        },
      });

      const profileByUserId = new Map<string, Profile>();
      for (const profile of profiles) {
        profileByUserId.set(profile.userId, profile);
      }

      return userIds.map((userId) => profileByUserId.get(userId) || null);
    },
  );

  const memberTypeByIdLoader = new DataLoader<string, MemberType | null>(async (ids) => {
    const memberTypes = await prisma.memberType.findMany({
      where: {
        id: {
          in: [...ids],
        },
      },
    });

    const memberTypeById = new Map<string, MemberType>();
    for (const memberType of memberTypes) {
      memberTypeById.set(memberType.id, memberType);
    }

    return ids.map((id) => memberTypeById.get(id) || null);
  });

  const usersBySubscriberIdLoader = new DataLoader<string, User[]>(
    async (subscriberIds) => {
      const subscriptions = await prisma.subscribersOnAuthors.findMany({
        where: {
          subscriberId: {
            in: [...subscriberIds],
          },
        },
        include: {
          author: true,
        },
      });

      const usersBySubscriberId = new Map<string, User[]>();
      for (const subscriberId of subscriberIds) {
        usersBySubscriberId.set(subscriberId, []);
      }

      for (const subscription of subscriptions) {
        const users = usersBySubscriberId.get(subscription.subscriberId) || [];
        users.push(subscription.author);
        usersBySubscriberId.set(subscription.subscriberId, users);
      }

      return subscriberIds.map(
        (subscriberId) => usersBySubscriberId.get(subscriberId) || [],
      );
    },
  );

  const usersByAuthorIdLoader = new DataLoader<string, User[]>(async (authorIds) => {
    const subscriptions = await prisma.subscribersOnAuthors.findMany({
      where: {
        authorId: {
          in: [...authorIds],
        },
      },
      include: {
        subscriber: true,
      },
    });

    const usersByAuthorId = new Map<string, User[]>();
    for (const authorId of authorIds) {
      usersByAuthorId.set(authorId, []);
    }

    for (const subscription of subscriptions) {
      const users = usersByAuthorId.get(subscription.authorId) || [];
      users.push(subscription.subscriber);
      usersByAuthorId.set(subscription.authorId, users);
    }

    return authorIds.map((authorId) => usersByAuthorId.get(authorId) || []);
  });

  return {
    postsByAuthorIdLoader,
    profileByUserIdLoader,
    memberTypeByIdLoader,
    usersBySubscriberIdLoader,
    usersByAuthorIdLoader,
  };
};

export type DataLoaders = ReturnType<typeof createDataLoaders>;
