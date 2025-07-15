import { LoginDto } from '../dto/login.dto';

export class LoginUserCommand {
  constructor(
    public readonly loginDto: LoginDto,
    public readonly sessionId: string | undefined,
    public readonly correlationId: string | undefined,
    public readonly causationId: string | undefined,
    public readonly ipAddress: string | undefined,
    public readonly userAgent: string | undefined,
  ) {}
}
