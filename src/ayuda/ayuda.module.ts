import { Module } from '@nestjs/common';
import { AyudaController } from './ayuda.controller';
import { AyudaService } from './ayuda.service';
import { AgenteModule } from '../agente/agente.module';

@Module({
  imports: [AgenteModule],
  controllers: [AyudaController],
  providers: [AyudaService],
})
export class AyudaModule {}
