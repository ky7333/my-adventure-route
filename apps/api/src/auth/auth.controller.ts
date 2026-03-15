import { BadRequestException, Body, Controller, Inject, Post } from '@nestjs/common';
import { authLoginSchema, authRegisterSchema } from '@adventure/contracts';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = authRegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.authService.register(parsed.data);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.authService.login(parsed.data);
  }
}
