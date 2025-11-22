import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLResolveInfo,
  Kind,
  parse,
  validate,
  execute,
} from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { createDataLoaders, type DataLoaders } from './dataloaders.js';

interface UserData {
  id: string;
  name: string;
  balance: number;
}

interface TransformedUser extends UserData {
  userSubscribedTo?: UserData[];
  subscribedToUser?: UserData[];
}

const UUIDType = new GraphQLScalarType({
  name: 'UUID',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    return null;
  },
});

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  const MemberTypeIdEnum = new GraphQLEnumType({
    name: 'MemberTypeId',
    values: {
      BASIC: { value: 'BASIC' },
      BUSINESS: { value: 'BUSINESS' },
    },
  });

  const MemberTypeType = new GraphQLObjectType({
    name: 'MemberType',
    fields: () => ({
      id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
      discount: { type: new GraphQLNonNull(GraphQLFloat) },
      postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLInt) },
    }),
  });

  const PostType = new GraphQLObjectType({
    name: 'Post',
    fields: () => ({
      id: { type: new GraphQLNonNull(UUIDType) },
      title: { type: new GraphQLNonNull(GraphQLString) },
      content: { type: new GraphQLNonNull(GraphQLString) },
    }),
  });

  const ProfileType = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: new GraphQLNonNull(UUIDType) },
      isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
      yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
      memberType: {
        type: new GraphQLNonNull(MemberTypeType),
        resolve: async (
          parent: { memberTypeId: string; memberType?: unknown },
          _args: unknown,
          context: { loaders: DataLoaders },
        ) => {
          if ('memberType' in parent) {
            return parent.memberType;
          }
          return context.loaders.memberTypeByIdLoader.load(parent.memberTypeId);
        },
      },
    }),
  });

  const UserType: GraphQLObjectType = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: new GraphQLNonNull(UUIDType) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      balance: { type: new GraphQLNonNull(GraphQLFloat) },
      profile: {
        type: ProfileType,
        resolve: async (
          parent: { id: string; profile?: unknown },
          _args: unknown,
          context: { loaders: DataLoaders },
        ) => {
          if ('profile' in parent) {
            return parent.profile;
          }
          return context.loaders.profileByUserIdLoader.load(parent.id);
        },
      },
      posts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostType))),
        resolve: async (
          parent: { id: string; posts?: unknown[] },
          _args: unknown,
          context: { loaders: DataLoaders },
        ) => {
          if ('posts' in parent) {
            return parent.posts;
          }
          return context.loaders.postsByAuthorIdLoader.load(parent.id);
        },
      },
      userSubscribedTo: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
        resolve: async (
          parent: { id: string; userSubscribedTo?: unknown[] },
          _args: unknown,
          context: { loaders: DataLoaders },
        ) => {
          if ('userSubscribedTo' in parent) {
            return parent.userSubscribedTo;
          }
          return context.loaders.usersBySubscriberIdLoader.load(parent.id);
        },
      },
      subscribedToUser: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
        resolve: async (
          parent: { id: string; subscribedToUser?: unknown[] },
          _args: unknown,
          context: { loaders: DataLoaders },
        ) => {
          if ('subscribedToUser' in parent) {
            return parent.subscribedToUser;
          }
          return context.loaders.usersByAuthorIdLoader.load(parent.id);
        },
      },
    }),
  });

  const CreateUserInput = new GraphQLInputObjectType({
    name: 'CreateUserInput',
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      balance: { type: new GraphQLNonNull(GraphQLFloat) },
    },
  });

  const CreatePostInput = new GraphQLInputObjectType({
    name: 'CreatePostInput',
    fields: {
      title: { type: new GraphQLNonNull(GraphQLString) },
      content: { type: new GraphQLNonNull(GraphQLString) },
      authorId: { type: new GraphQLNonNull(UUIDType) },
    },
  });

  const CreateProfileInput = new GraphQLInputObjectType({
    name: 'CreateProfileInput',
    fields: {
      isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
      yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
      userId: { type: new GraphQLNonNull(UUIDType) },
      memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },
    },
  });

  const ChangeUserInput = new GraphQLInputObjectType({
    name: 'ChangeUserInput',
    fields: {
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
    },
  });

  const ChangePostInput = new GraphQLInputObjectType({
    name: 'ChangePostInput',
    fields: {
      title: { type: GraphQLString },
      content: { type: GraphQLString },
    },
  });

  const ChangeProfileInput = new GraphQLInputObjectType({
    name: 'ChangeProfileInput',
    fields: {
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      memberTypeId: { type: MemberTypeIdEnum },
    },
  });

  const RootQueryType = new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      memberTypes: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(MemberTypeType))),
        resolve: async () => prisma.memberType.findMany(),
      },
      memberType: {
        type: MemberTypeType,
        args: { id: { type: new GraphQLNonNull(MemberTypeIdEnum) } },
        resolve: async (_: unknown, { id }: { id: string }) =>
          prisma.memberType.findUnique({ where: { id } }),
      },
      users: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
        resolve: async (
          _parent: unknown,
          _args: unknown,
          context: { loaders: DataLoaders },
          info: GraphQLResolveInfo,
        ) => {
          const parsedInfo = parseResolveInfo(info);
          const fields = parsedInfo?.fieldsByTypeName.User || {};

          const includeUserSubscribedTo = 'userSubscribedTo' in fields;
          const includeSubscribedToUser = 'subscribedToUser' in fields;

          if (!includeUserSubscribedTo && !includeSubscribedToUser) {
            return prisma.user.findMany();
          }

          const include: Record<string, unknown> = {};

          if (includeUserSubscribedTo) {
            include.userSubscribedTo = true;
          }

          if (includeSubscribedToUser) {
            include.subscribedToUser = true;
          }

          const users = await prisma.user.findMany({
            include,
          });

          const userMap = new Map<string, UserData>();
          for (const user of users) {
            userMap.set(user.id, {
              id: user.id,
              name: user.name,
              balance: user.balance,
            });
          }

          const transformedUsers: TransformedUser[] = [];
          for (const user of users) {
            const transformedUser: TransformedUser = {
              id: user.id,
              name: user.name,
              balance: user.balance,
            };

            if (
              includeUserSubscribedTo &&
              'userSubscribedTo' in user &&
              user.userSubscribedTo
            ) {
              const subscribedUsers: UserData[] = [];
              for (const sub of user.userSubscribedTo as Array<{ authorId: string }>) {
                const author = userMap.get(sub.authorId);
                if (author) {
                  subscribedUsers.push(author);
                }
              }
              transformedUser.userSubscribedTo = subscribedUsers;
              context.loaders.usersBySubscriberIdLoader.prime(user.id, subscribedUsers);
            }

            if (
              includeSubscribedToUser &&
              'subscribedToUser' in user &&
              user.subscribedToUser
            ) {
              const subscribers: UserData[] = [];
              for (const sub of user.subscribedToUser as Array<{
                subscriberId: string;
              }>) {
                const subscriber = userMap.get(sub.subscriberId);
                if (subscriber) {
                  subscribers.push(subscriber);
                }
              }
              transformedUser.subscribedToUser = subscribers;
              context.loaders.usersByAuthorIdLoader.prime(user.id, subscribers);
            }

            transformedUsers.push(transformedUser);
          }

          return transformedUsers;
        },
      },
      user: {
        type: UserType,
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_: unknown, { id }: { id: string }) =>
          prisma.user.findUnique({ where: { id } }),
      },
      posts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostType))),
        resolve: async () => prisma.post.findMany(),
      },
      post: {
        type: PostType,
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_: unknown, { id }: { id: string }) =>
          prisma.post.findUnique({ where: { id } }),
      },
      profiles: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ProfileType))),
        resolve: async () => prisma.profile.findMany(),
      },
      profile: {
        type: ProfileType,
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_: unknown, { id }: { id: string }) =>
          prisma.profile.findUnique({ where: { id } }),
      },
    },
  });

  const MutationsType = new GraphQLObjectType({
    name: 'Mutations',
    fields: {
      createUser: {
        type: new GraphQLNonNull(UserType),
        args: { dto: { type: new GraphQLNonNull(CreateUserInput) } },
        resolve: async (
          _: unknown,
          { dto }: { dto: { name: string; balance: number } },
        ) => prisma.user.create({ data: dto }),
      },
      createProfile: {
        type: new GraphQLNonNull(ProfileType),
        args: { dto: { type: new GraphQLNonNull(CreateProfileInput) } },
        resolve: async (
          _: unknown,
          {
            dto,
          }: {
            dto: {
              isMale: boolean;
              yearOfBirth: number;
              userId: string;
              memberTypeId: string;
            };
          },
        ) => prisma.profile.create({ data: dto }),
      },
      createPost: {
        type: new GraphQLNonNull(PostType),
        args: { dto: { type: new GraphQLNonNull(CreatePostInput) } },
        resolve: async (
          _: unknown,
          { dto }: { dto: { title: string; content: string; authorId: string } },
        ) => prisma.post.create({ data: dto }),
      },
      changePost: {
        type: new GraphQLNonNull(PostType),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangePostInput) },
        },
        resolve: async (
          _: unknown,
          { id, dto }: { id: string; dto: { title?: string; content?: string } },
        ) => prisma.post.update({ where: { id }, data: dto }),
      },
      changeProfile: {
        type: new GraphQLNonNull(ProfileType),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangeProfileInput) },
        },
        resolve: async (
          _: unknown,
          {
            id,
            dto,
          }: {
            id: string;
            dto: { isMale?: boolean; yearOfBirth?: number; memberTypeId?: string };
          },
        ) => prisma.profile.update({ where: { id }, data: dto }),
      },
      changeUser: {
        type: new GraphQLNonNull(UserType),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangeUserInput) },
        },
        resolve: async (
          _: unknown,
          { id, dto }: { id: string; dto: { name?: string; balance?: number } },
        ) => prisma.user.update({ where: { id }, data: dto }),
      },
      deleteUser: {
        type: new GraphQLNonNull(GraphQLString),
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_: unknown, { id }: { id: string }) => {
          await prisma.user.delete({ where: { id } });
          return 'User deleted';
        },
      },
      deletePost: {
        type: new GraphQLNonNull(GraphQLString),
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_: unknown, { id }: { id: string }) => {
          await prisma.post.delete({ where: { id } });
          return 'Post deleted';
        },
      },
      deleteProfile: {
        type: new GraphQLNonNull(GraphQLString),
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_: unknown, { id }: { id: string }) => {
          await prisma.profile.delete({ where: { id } });
          return 'Profile deleted';
        },
      },
      subscribeTo: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          userId: { type: new GraphQLNonNull(UUIDType) },
          authorId: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (
          _: unknown,
          { userId, authorId }: { userId: string; authorId: string },
        ) => {
          await prisma.subscribersOnAuthors.create({
            data: { subscriberId: userId, authorId },
          });
          return 'Subscribed';
        },
      },
      unsubscribeFrom: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          userId: { type: new GraphQLNonNull(UUIDType) },
          authorId: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (
          _: unknown,
          { userId, authorId }: { userId: string; authorId: string },
        ) => {
          await prisma.subscribersOnAuthors.delete({
            where: {
              subscriberId_authorId: { subscriberId: userId, authorId },
            },
          });
          return 'Unsubscribed';
        },
      },
    },
  });

  const schema = new GraphQLSchema({
    query: RootQueryType,
    mutation: MutationsType,
  });

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const { query, variables } = req.body;

      try {
        const document = parse(query);
        const validationErrors = validate(schema, document, [depthLimit(5)]);

        if (validationErrors.length > 0) {
          return {
            errors: validationErrors,
          };
        }

        const loaders = createDataLoaders(prisma);

        const result = await execute({
          schema,
          document,
          variableValues: variables,
          contextValue: { loaders },
        });

        return result;
      } catch (error) {
        return {
          errors: [error],
        };
      }
    },
  });
};

export default plugin;
