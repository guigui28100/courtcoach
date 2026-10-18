-- Les gestes « maintenant » deviennent des gestes de fin de trimestre : ceux déjà marqués passent en T1
UPDATE "Video" SET "mark" = 'T1' WHERE "mark" = 'MAINTENANT';
