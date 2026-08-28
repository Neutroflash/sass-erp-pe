import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export const PasswordHasher = {
  hash: (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS),
  verify: (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash),
};
