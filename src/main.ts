import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: permite que la app (Expo) y el demo web llamen a la API.
  app.enableCors({ origin: true, credentials: true });

  // Valida y limpia todos los DTOs de entrada automáticamente.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`A tu lado · API escuchando en http://localhost:${port}`);
}
bootstrap();
