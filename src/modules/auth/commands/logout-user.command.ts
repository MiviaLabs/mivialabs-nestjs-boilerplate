export class LogoutUserCommand {
  constructor(
    public readonly refreshToken: string,
    public readonly sessionId: string | undefined,
    public readonly correlationId: string | undefined,
    public readonly causationId: string | undefined,
    public readonly ipAddress: string | undefined,
    public readonly userAgent: string | undefined,
  ) {}
}
