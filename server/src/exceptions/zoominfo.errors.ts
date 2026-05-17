import { BadRequestError } from '@/exceptions/error';

export class ZoomInfoInsufficientScopesError extends BadRequestError {
  readonly grantedScopes: string[];

  readonly requiredScopes: string[];

  constructor(requiredScopes: string[], grantedScopes: string[]) {
    super(
      `ZoomInfo access token is missing required scopes. Required: ${requiredScopes.join(
        ', '
      )}. Granted: ${grantedScopes.length ? grantedScopes.join(', ') : '(none reported)'}`
    );
    this.requiredScopes = requiredScopes;
    this.grantedScopes = grantedScopes;
  }
}

export class ZoomInfoApiError extends Error {
  readonly httpStatus: number;

  statusCode: number;

  readonly detail?: string;

  constructor(httpStatus: number, message: string, detail?: string) {
    super(message);
    this.name = 'ZoomInfoApiError';
    this.httpStatus = httpStatus;
    this.statusCode = httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500;
    this.detail = detail;
  }
}
