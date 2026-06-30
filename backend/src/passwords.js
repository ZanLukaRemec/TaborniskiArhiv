const argon2 = require('@node-rs/argon2');

const HASH_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

function hashPassword(password) {
  return argon2.hash(password, HASH_OPTIONS);
}

function verifyPassword(hash, password) {
  return argon2.verify(hash, password);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
