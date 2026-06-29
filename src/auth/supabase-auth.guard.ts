import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createRemoteJWKSet,
  jwtVerify,
  decodeProtectedHeader,
} from 'jose';

/**
 * Verifica el JWT que emite Supabase Auth.
 *
 * Soporta los DOS sistemas de firma de Supabase:
 *   - ES256 (nuevo, asimétrico): se verifica con la clave pública (JWKS).
 *   - HS256 (legacy, secreto compartido): se verifica con SUPABASE_JWT_SECRET.
 *
 * Detecta automáticamente cuál usa el token leyendo su cabecera 'alg',
 * así funciona sin importar la configuración del proyecto.
 *
 * Adjunta req.user = { id, email }. El aislamiento real lo aplica RLS.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  // Para tokens ES256 (nuevos): clave pública desde el endpoint JWKS.
  private readonly jwks = createRemoteJWKSet(
    new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
  );

  // Para tokens HS256 (legacy): el secreto JWT del proyecto.
  private readonly hsSecret = process.env.SUPABASE_JWT_SECRET
    ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
    : undefined;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: 'Falta el token de autenticación',
        code: 'AUTH_MISSING',
      });
    }

    const token = header.slice(7);

    try {
      // Mirar el algoritmo del token para elegir cómo verificarlo.
      const { alg } = decodeProtectedHeader(token);
      let payload: any;

      if (alg === 'HS256') {
        // Token legacy: verificar con el secreto compartido.
        if (!this.hsSecret) {
          throw new Error(
            'El token usa HS256 pero falta SUPABASE_JWT_SECRET en el .env',
          );
        }
        ({ payload } = await jwtVerify(token, this.hsSecret));
      } else {
        // Token nuevo (ES256/RS256): verificar con la clave pública.
        ({ payload } = await jwtVerify(token, this.jwks));
      }

      req.user = { id: payload.sub as string, email: payload.email as string };
      req.accessToken = token;
      return true;
    } catch (err) {
      throw new UnauthorizedException({
        error: 'Token inválido o expirado',
        code: 'AUTH_INVALID',
      });
    }
  }
}
