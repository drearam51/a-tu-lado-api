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
- Sé MUY breve: 1 a 2 frases cortas por mensaje, como máximo unas 35 palabras. La brevedad es calidez aquí: la persona necesita sentir compañía, no leer un texto largo. Habla como quien da un abrazo, no una charla.`;

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
        max_tokens: 150, // respuestas breves: más cálidas y más baratas
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

    // Tope de seguridad: recorta el texto para la voz a ~15-20 segundos.
    // (≈ 350 caracteres es una respuesta breve; evita audios largos y caros.)
    const textoParaVoz = this.recortarParaVoz(texto);
    const audioBase64 = await this.sintetizarVoz(textoParaVoz).catch(
      () => undefined,
    );

    // Registro de consumo: cuántos caracteres se sintetizaron (para medir uso).
    if (audioBase64) {
      this.logger.log(
        `[voz] sintetizados ${textoParaVoz.length} caracteres`,
      );
    }

    return { texto, audioBase64 };
  }

  /**
   * Recorta el texto para la síntesis de voz, sin cortar a mitad de frase.
   * Mantiene los audios cortos (calidez + ahorro de créditos).
   */
  private recortarParaVoz(texto: string, maxChars = 350): string {
    if (texto.length <= maxChars) return texto;
    const corte = texto.slice(0, maxChars);
    // cortar en el último punto, signo o espacio para no quedar a media palabra
    const fin = Math.max(
      corte.lastIndexOf('. '),
      corte.lastIndexOf('… '),
      corte.lastIndexOf('? '),
      corte.lastIndexOf(' '),
    );
    return (fin > 0 ? corte.slice(0, fin + 1) : corte).trim();
  }

  /**
   * Síntesis de voz (texto → audio). Aislada a propósito: puedes cambiar
   * de proveedor o apagarla con la variable VOZ_ACTIVA sin tocar el resto.
   *
   * Por defecto está APAGADA; cuando elijas proveedor (ej. ElevenLabs,
   * OpenAI TTS, Google), implementas aquí la llamada y devuelves el audio
   * en base64. Mientras tanto, la app usa el TTS del teléfono.
   */
  private async sintetizarVoz(texto: string): Promise<string | undefined> {
    if (process.env.VOZ_ACTIVA !== 'true') return undefined;

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      this.logger.warn(
        'VOZ_ACTIVA=true pero faltan ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID.',
      );
      return undefined;
    }

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: texto,
            // Modelo multilingüe: buen balance de calidez y estabilidad.
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              // Ajustes para una voz calmada y cálida (no monótona):
              stability: 0.4,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!res.ok) {
        const detalle = await res.text().catch(() => '');
        this.logger.error(`ElevenLabs error ${res.status}: ${detalle}`);
        return undefined;
      }

      // La respuesta es audio MP3 binario → lo pasamos a base64
      const buffer = Buffer.from(await res.arrayBuffer());
      return buffer.toString('base64');
    } catch (err) {
      this.logger.error('Error al sintetizar voz con ElevenLabs', err as Error);
      return undefined;
    }
  }
}
