-- Images annotées modifiables : on garde l'image d'origine (sans dessin) et les tracés
ALTER TABLE "VideoImage" ADD COLUMN "source" BYTEA, ADD COLUMN "sourceBytes" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "edit" JSONB, ADD COLUMN "editable" BOOLEAN NOT NULL DEFAULT false;
