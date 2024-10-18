import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { encryptPassword } from '../utils/encryption';
import { users } from '@prisma/client';


/**
 * Get user by id
 * @param {ObjectId} id
 * @param {Array<Key>} keys
 * @returns {Promise<Pick<users, Key> | null>}
 */
const getUserById = async <Key extends keyof users>(
  id: number,
): Promise<Pick<users, Key> | null> => {
  return prisma.users.findUnique({
    where: { id },
  }) as Promise<Pick<users, Key> | null>;
};

/**
 * Get user by email
 * @param {string} email
 * @param {Array<Key>} keys
 * @returns {Promise<Pick<User, Key> | null>}
 */
const getUserByEmail = async <Key extends keyof users>(
  email: string,
): Promise<Pick<users, Key> | null> => {
  return prisma.users.findUnique({
    where: { email },
  }) as Promise<Pick<users, Key> | null>;
};



export default {
  getUserById,
  getUserByEmail,
};
