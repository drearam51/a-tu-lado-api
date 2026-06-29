import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Dos formas de hablar con Supabase, según la arquitectura:
 *
 *  - forUser(token): cliente que actúa COMO el usuario. La BD aplica
 *    Row-Level Security, así que solo ve sus propias filas. Para
 *    lecturas/escrituras normales del usuario.
 *
 *  - admin(): cliente con service-role. Salta RLS de forma controlada.
 *    Solo para operaciones del backend (insertar eventos del sistema,
 *    workers). NUNCA se expone al cliente; la key vive solo aquí.
 */
@Injectable()
export class SupabaseService {
  private readonly url = process.env.SUPABASE_URL as string;
  private readonly anonKey = process.env.SUPABASE_ANON_KEY as string;
  private readonly serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  /** Cliente en nombre del usuario: respeta RLS. */
  forUser(accessToken: string): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Cliente del backend: service-role, salta RLS. Usar con cuidado. */
  admin(): SupabaseClient {
    return createClient(this.url, this.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}
