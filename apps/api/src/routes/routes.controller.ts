import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { planRouteRequestSchema } from '@adventure/contracts';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoutesService } from './routes.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(@Inject(RoutesService) private readonly routesService: RoutesService) {}

  @Post('plan')
  async planRoute(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = planRouteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.routesService.planRoute(req.user.userId, parsed.data);
  }

  @Get(':id')
  async getRouteById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.routesService.getRouteById(req.user.userId, id);
  }
}
