import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/app.config';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  configureApp(app);
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port, config.host);
}

void bootstrap().catch(() => {
  process.stderr.write(
    'API startup failed. Check local demo configuration and port availability.\n',
  );
  process.exitCode = 1;
});
