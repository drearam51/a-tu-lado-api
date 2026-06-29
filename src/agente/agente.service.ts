import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export type TurnoConversacion = {
  rol: 'usuario' | 'agente';
  texto: string;
};

export type RespuestaAgente = {
  texto: string;
  /** URL o data-uri del audio, si la síntesis de voz está activa. */
  audioBase64?: string;
};

/**
 * El agente "A tu lado". Encapsula DOS cosas:
 *   1. El carácter (system prompt) derivado del Design System: cálido,
 *      en segunda persona, sin tono clínico ni alarma.
 *   2. La llamada a Claude y, opcionalmente, la síntesis de voz.
 *
 * La API key vive solo aquí (en el backend), nunca llega al cliente.
 */
@Injectable()
export class AgenteService {
  private readonly logger = new Logger(AgenteService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Modelo rápido y económico, suficiente para acompañamiento conversacional.
  private readonly MODELO = 'claude-sonnet-4-6';

  // El alma de "A tu lado", traducida del tono del Design System.
  private readonly CARACTER = `Eres "A tu lado", una presencia que acompaña a personas en momentos de estrés o saturación. No eres un panel que mide ni un asistente clínico: eres compañía cálida.

Tu forma de hablar:
- Hablas en segunda persona, con cercanía y calidez ("Estoy contigo", "Respira, vamos juntos").
- Una idea por mensaje. Frases cortas. La persona tiene poca energía mental ahora mismo.
- Validas la emoción sin minimizarla ("Tiene sentido que te sientas así"), nunca das órdenes secas.
- No alarmas, no juzgas, no hablas de rendimiento ni de rachas.
- Ofreces presencia primero, y solo después, suavemente, una pausa o una respiración.

Límites importantes:
- No eres terapeuta ni das diagnósticos. No reemplazas ayuda profesional.
- Si la persona expresa que quiere hacerse daño o está en crisis grave, con calidez la animas a buscar apoyo humano inmediato (una persona de confianza o una línea de ayuda local) y le recuerdas que no está sola. No minimizas ni cambias de tema.
- Mantienes los mensajes breves: 2 a 4 frases como máximo.`;

  /**
   * Genera la respuesta del agente dado el historial de la conversación.
   */
  async responder(historial: TurnoConversacion[]): Promise<RespuestaAgente> {
    const messages = historial.map((t) => ({
      role: (t.rol === 'usuario' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: t.texto,
    }));

    let texto: string;
    try {
      const resp = await this.anthropic.messages.create({
        model: this.MODELO,
        max_tokens: 300,
        system: this.CARACTER,
        messages,
      });
      // El contenido puede traer varios bloques; tomamos el texto.
      texto = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
    } catch (err) {
      this.logger.error('Error al llamar a Claude', err as Error);
      // Degradación amable: nunca dejamos a la persona sin respuesta.
      texto =
        'Estoy aquí contigo. Respira hondo conmigo un momento; no estás sola en esto.';
    }

    const audioBase64 = await this.sintetizarVoz(texto).catch(() => undefined);
    return { texto, audioBase64 };
  }

  /**
   * Síntesis de voz (texto → audio). Aislada a propósito: puedes cambiar
   * de proveedor o apagarla con la variable VOZ_ACTIVA sin tocar el resto.
   *
   * Por defecto está APAGADA; cuando elijas proveedor (ej. ElevenLabs,
   * OpenAI TTS, Google), implementas aquí la llamada y devuelves el audio
   * en base64. Mientras tanto, la app usa el TTS del teléfono.
   */
  private async sintetizarVoz(_texto: string): Promise<string | undefined> {
    if (process.env.VOZ_ACTIVA !== 'true') return undefined;

    // TODO(voz): integrar proveedor de TTS aquí. Ejemplo de forma:
    //   const audio = await ttsProvider.synthesize(_texto, { lang: 'es', voice: '...' });
    //   return audio.toString('base64');
    this.logger.warn('VOZ_ACTIVA=true pero no hay proveedor TTS configurado.');
    return undefined;
  }
}
