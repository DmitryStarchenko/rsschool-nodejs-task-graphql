import { Type } from '@fastify/type-provider-typebox';

export const gqlResponseSchema = Type.Partial(
  Type.Object({
    data: Type.Any(),
    errors: Type.Any(),
  }),
);

export const createGqlResponseSchema = {
  body: Type.Object(
    {
      query: Type.String(),
      variables: Type.Optional(Type.Record(Type.String(), Type.Any())),
    },
    {
      additionalProperties: false,
    },
  ),
};

export const typeDefs = `
  schema {
    query: RootQueryType
    mutation: Mutations
  }

  scalar UUID

  enum MemberTypeId {
    BASIC
    BUSINESS
  }

  type User {
    id: UUID!
    name: String!
    balance: Float!
    profile: Profile
    posts: [Post!]!
    userSubscribedTo: [User!]!
    subscribedToUser: [User!]!
  }

  type Post {
    id: UUID!
    title: String!
    content: String!
  }

  type Profile {
    id: UUID!
    isMale: Boolean!
    yearOfBirth: Int!
    memberType: MemberType!
  }

  type MemberType {
    id: MemberTypeId!
    discount: Float!
    postsLimitPerMonth: Int!
  }

  input CreateUserInput {
    name: String!
    balance: Float!
  }

  input CreatePostInput {
    title: String!
    content: String!
    authorId: UUID!
  }

  input CreateProfileInput {
    isMale: Boolean!
    yearOfBirth: Int!
    userId: UUID!
    memberTypeId: MemberTypeId!
  }

  input ChangeUserInput {
    name: String
    balance: Float
  }

  input ChangePostInput {
    title: String
    content: String
  }

  input ChangeProfileInput {
    isMale: Boolean
    yearOfBirth: Int
    memberTypeId: MemberTypeId
  }

  type RootQueryType {
    memberTypes: [MemberType!]!
    memberType(id: MemberTypeId!): MemberType
    users: [User!]!
    user(id: UUID!): User
    posts: [Post!]!
    post(id: UUID!): Post
    profiles: [Profile!]!
    profile(id: UUID!): Profile
  }

  type Mutations {
    createUser(dto: CreateUserInput!): User!
    createProfile(dto: CreateProfileInput!): Profile!
    createPost(dto: CreatePostInput!): Post!
    changePost(id: UUID!, dto: ChangePostInput!): Post!
    changeProfile(id: UUID!, dto: ChangeProfileInput!): Profile!
    changeUser(id: UUID!, dto: ChangeUserInput!): User!
    deleteUser(id: UUID!): String!
    deletePost(id: UUID!): String!
    deleteProfile(id: UUID!): String!
    subscribeTo(userId: UUID!, authorId: UUID!): String!
    unsubscribeFrom(userId: UUID!, authorId: UUID!): String!
  }
`;
