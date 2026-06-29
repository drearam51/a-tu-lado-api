import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AyudaModule } from './ayuda/ayuda.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga .env
    SupabaseModule,
    AyudaModule,
  ],
})
export class AppModule {}
