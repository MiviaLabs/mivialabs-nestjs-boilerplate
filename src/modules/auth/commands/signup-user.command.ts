import { SignupDto } from '../dto/signup.dto';

export class SignupUserCommand {
  constructor(
    public readonly signupDto: SignupDto,
    public readonly sessionId: string | undefined,
    public readonly correlationId: string | undefined,
    public readonly causationId: string | undefined,
    public readonly ipAddress: string | undefined,
    public readonly userAgent: string | undefined,
  ) {}
}
