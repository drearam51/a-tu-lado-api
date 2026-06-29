import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AyudaService } from './ayuda.service';
import { PedirAyudaDto, ResponderDto } from './ayuda.dto';

/**
 * Rutas del flujo de ayuda, bajo /api (convención de la arquitectura).
 * Todas requieren JWT de Supabase (verificado por el guard).
 */
@Controller('api/ayuda')
@UseGuards(SupabaseAuthGuard)
export class AyudaController {
  constructor(private readonly ayuda: AyudaService) {}

  /** La persona pide ayuda, o la manilla la dispara. */
  @Post()
  pedir(@Req() req: any, @Body() dto: PedirAyudaDto) {
    return this.ayuda.pedirAyuda(req.user, req.accessToken, dto);
  }

  /** Un turno más de conversación con el agente. */
  @Post('responder')
  responder(@Req() req: any, @Body() dto: ResponderDto) {
    return this.ayuda.responder(req.user, dto);
  }

  /** Registra cómo terminó la intervención. */
  @Patch('intervencion/:id')
  resultado(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { estado: 'aceptada' | 'pospuesta' | 'descartada' },
  ) {
    return this.ayuda.registrarResultado(
      req.user,
      req.accessToken,
      id,
      body.estado,
    );
  }
}
