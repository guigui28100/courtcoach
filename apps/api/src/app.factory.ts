import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { raw } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { resolveDatabaseUrl } from "./database-url";

// Construit l'application (utilisée en local, en test et sur Vercel).
export async function createApp(): Promise<NestExpressApplication> {
  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) throw new Error("Adresse de la base de données manquante (DATABASE_URL)");
  process.env.DATABASE_URL = dbUrl;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET manquant ou trop court (32 caractères minimum)");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: process.env.NODE_ENV === "test" ? false : ["error", "warn", "log"] });
  app.setGlobalPrefix("api");
  app.set("trust proxy", 1); // derrière Vercel : la vraie adresse du visiteur est dans l'en-tête transmis
  app.use(helmet());
  app.use(cookieParser());
  app.use("/api/videos", raw({ type: "application/octet-stream", limit: 2 * 1024 * 1024 + 1024 })); // morceaux de vidéo (2 Mo maximum chacun)
  app.enableCors({ origin: process.env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  return app;
}

export type { INestApplication };
