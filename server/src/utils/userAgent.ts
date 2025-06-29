import { FastifyRequest } from 'fastify';

export interface UserAgent {
  deviceType: string;
  operatingSystem: string;
  sessionIpAddress: string;
}

export function getUserAgentFromRequest(request: FastifyRequest): UserAgent {
  const userAgent = request.headers['user-agent'] || '';
  const sessionIpAddress = request.ip;

  let deviceType = 'Unknown';
  let operatingSystem = 'Unknown';

  if (/mobile/i.test(userAgent)) {
    deviceType = 'Mobile';
  } else if (/tablet/i.test(userAgent)) {
    deviceType = 'Tablet';
  } else {
    deviceType = 'Desktop';
  }

  if (/windows/i.test(userAgent)) {
    operatingSystem = 'Windows';
  } else if (/mac os|macos/i.test(userAgent)) {
    operatingSystem = 'MacOS';
  } else if (/android/i.test(userAgent)) {
    operatingSystem = 'Android';
  } else if (/linux/i.test(userAgent)) {
    operatingSystem = 'Linux';
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    operatingSystem = 'iOS';
  }

  return {
    deviceType,
    operatingSystem,
    sessionIpAddress,
  };
}
