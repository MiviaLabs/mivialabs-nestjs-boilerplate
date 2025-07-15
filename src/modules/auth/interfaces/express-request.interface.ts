import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  sessionID?: string;
  headers: Request['headers'] & {
    'x-session-id'?: string;
    'x-correlation-id'?: string;
    'x-causation-id'?: string;
    'x-forwarded-for'?: string;
    'user-agent'?: string;
  };
}
