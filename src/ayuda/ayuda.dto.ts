import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Origen del pedido de ayuda: lo pulsó la persona, o lo detectó la manilla. */
export class PedirAyudaDto {
  @IsIn(['manual', 'automatico'])
  origen: 'manual' | 'automatico';

  /** Opcional: nivel detectado si vino de la manilla. */
  @IsOptional()
  @IsIn(['calm', 'caution', 'stress'])
  nivel?: 'calm' | 'caution' | 'stress';
}

export class TurnoDto {
  @IsIn(['usuario', 'agente'])
  rol: 'usuario' | 'agente';

  @IsString()
  @MaxLength(2000)
  texto: string;
}

/** Un turno de conversación: la persona responde, el agente contesta. */
export class ResponderDto {
  @IsString()
  @MaxLength(2000)
  mensaje: string;

  /** Historial previo (para que el agente recuerde el hilo). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TurnoDto)
  historial?: TurnoDto[];
}
