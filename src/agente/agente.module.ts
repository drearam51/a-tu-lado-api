import { Module } from '@nestjs/common';
import { AgenteService } from './agente.service';

@Module({
  providers: [AgenteService],
  exports: [AgenteService],
})
export class AgenteModule {}
