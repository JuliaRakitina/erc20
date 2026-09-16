import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorFilter } from './common/api-error.filter';
import { validationError } from './common/api-error';
import { ReadBodyGuard } from './common/read-body.guard';

export function configureApp(
  app: NestExpressApplication,
  withDocs = true,
): void {
  app.useBodyParser('json', { limit: '16kb' });
  app.useGlobalGuards(new ReadBodyGuard());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
      exceptionFactory: () => validationError(),
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();

  if (withDocs) {
    const definition = new DocumentBuilder()
      .setTitle('ERC-20 Local Demo API')
      .setDescription(
        'Local custodial demonstration. All writes use one configured unlocked Hardhat account. Amounts are positive integer strings in token base units. Never use real keys or funds.',
      )
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, definition);
    SwaggerModule.setup('api/docs', app, document);
  }
}
