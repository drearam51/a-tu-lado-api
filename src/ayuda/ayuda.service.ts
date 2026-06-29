import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AgenteService,
  TurnoConversacion,
} from '../agente/agente.service';
import { PedirAyudaDto, ResponderDto } from './ayuda.dto';

type Usuario = { id: string; email: string };

/**
 * Orquesta el flujo de "pedir ayuda", encajando con las tablas de la
 * arquitectura (eventos_estres + intervenciones).
 *
 * Decisión de la usuaria: conversar + guardar + (a futuro) avisar a un
 * contacto. El gancho de "avisar a contacto" queda marcado y desactivado,
 * listo para activar sin reescribir el flujo.
 */
@Injectable()
export class AyudaService {
  private readonly logger = new Logger(AyudaService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly agente: AgenteService,
  ) {}

  /**
   * Paso 1: la persona pide ayuda (botón) o la manilla la dispara.
   * Crea el evento + la intervención, y devuelve el primer mensaje del agente.
   */
  async pedirAyuda(
    usuario: Usuario,
    accessToken: string,
    dto: PedirAyudaDto,
  ) {
    const db = this.supabase.forUser(accessToken); // respeta RLS

    // 1. Registrar el evento de estrés (origen manual o automático).
    const { data: evento, error: e1 } = await db
      .from('eventos_estres')
      .insert({
        usuario_id: usuario.id,
        detectado_en: new Date().toISOString(),
        nivel: dto.nivel ?? 'stress',
        // si lo pidió la persona, el "score" no viene de sensor:
        score: dto.origen === 'manual' ? null : undefined,
      })
      .select()
      .single();

    if (e1) throw this.fail('No se pudo registrar el evento', e1);

    // 2. Crear la intervención (Modo Abrazo) ligada al evento.
    const { data: intervencion, error: e2 } = await db
      .from('intervenciones')
      .insert({
        evento_estres_id: evento.id,
        usuario_id: usuario.id,
        tipo: 'modo_abrazo',
        estado: 'disparada',
      })
      .select()
      .single();

    if (e2) throw this.fail('No se pudo crear la intervención', e2);

    // 3. Primer turno del agente: saludo de acompañamiento.
    const saludo: TurnoConversacion[] = [
      {
        rol: 'usuario',
        texto:
          dto.origen === 'manual'
            ? 'Pulsé el botón porque necesito un momento de calma.'
            : 'La manilla detectó que mi estrés subió.',
      },
    ];
    const respuesta = await this.agente.responder(saludo);

    // 4. Gancho futuro: avisar a un contacto de confianza.
    //    Desactivado hasta definir el modelo de contactos y el consentimiento.
    // if (process.env.AVISAR_CONTACTO === 'true' && dto.nivel === 'stress') {
    //   await this.avisarContacto(usuario, evento.id);
    // }

    return {
      eventoId: evento.id,
      intervencionId: intervencion.id,
      mensaje: respuesta.texto,
      audioBase64: respuesta.audioBase64,
    };
  }

  /**
   * Paso 2: un turno de conversación. La persona responde, el agente contesta.
   */
  async responder(usuario: Usuario, dto: ResponderDto) {
    const historial: TurnoConversacion[] = [
      ...(dto.historial ?? []).map((t) => ({ rol: t.rol, texto: t.texto })),
      { rol: 'usuario' as const, texto: dto.mensaje },
    ];

    const respuesta = await this.agente.responder(historial);
    return { mensaje: respuesta.texto, audioBase64: respuesta.audioBase64 };
  }

  /**
   * Registra el desenlace de la intervención (aceptada/pospuesta/descartada),
   * tal como pide el verbo del PRD "Registrar resultado de la intervención".
   */
  async registrarResultado(
    usuario: Usuario,
    accessToken: string,
    intervencionId: string,
    estado: 'aceptada' | 'pospuesta' | 'descartada',
  ) {
    const db = this.supabase.forUser(accessToken);
    const { error } = await db
      .from('intervenciones')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', intervencionId)
      .eq('usuario_id', usuario.id); // defensa extra además de RLS

    if (error) throw this.fail('No se pudo actualizar la intervención', error);
    return { ok: true };
  }

  private fail(msg: string, err: unknown) {
    this.logger.error(msg, err as Error);
    return { error: msg, code: 'AYUDA_DB_ERROR' };
  }
}
