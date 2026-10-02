import { resolveDatabaseUrl, resolveMigrationUrl } from "../src/database-url";

describe("Adresse de la base de données", () => {
  it("accepte plusieurs noms de réglage", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgresql://a/b" } as any)).toBe("postgresql://a/b");
    expect(resolveDatabaseUrl({ POSTGRES_URL: "postgresql://c/d" } as any)).toBe("postgresql://c/d");
    expect(resolveDatabaseUrl({} as any)).toBeUndefined();
  });
  it("ajoute le réglage nécessaire pour l'adresse poolée de Neon", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require" } as any)).toContain("pgbouncer=true");
  });
  it("préfère l'adresse directe pour créer les tables", () => {
    expect(resolveMigrationUrl({ DATABASE_URL: "postgresql://pooler", DATABASE_URL_UNPOOLED: "postgresql://direct" } as any)).toBe("postgresql://direct");
  });
});
