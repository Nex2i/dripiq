import jwt from 'jsonwebtoken';

type Payload = Record<string, any>;

/**
 * Creates a signed JWT using the provided GUID as the secret key.
 * @param guid - A string used as the signing key (HMAC).
 * @param data - The payload to include in the JWT.
 * @returns A signed JWT string.
 */
const DEFAULT_EXPIRES_IN = 60 * 60 * 24; // 1 day
export function createSignedJwt(
  guid: string,
  data: Payload = {},
  expiresIn: number = DEFAULT_EXPIRES_IN
): string {
  if (!guid || typeof guid !== 'string') {
    throw new Error('Invalid GUID');
  }

  const token = jwt.sign(data, guid, {
    algorithm: 'HS256',
    expiresIn: expiresIn,
  });

  return token;
}

/**
 * Verifies a signed JWT using the provided GUID as the secret key.
 * @param token - The JWT token to verify.
 * @param guid - The secret key used to sign the JWT.
 * @returns The decoded payload if verification succeeds.
 * @throws Error if verification fails.
 */
export function verifySignedJwt(token: string, guid: string): Payload {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token');
  }

  if (!guid || typeof guid !== 'string') {
    throw new Error('Invalid GUID');
  }

  try {
    const decoded = jwt.verify(token, guid, {
      algorithms: ['HS256'],
    }) as Payload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}
