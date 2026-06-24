ALTER TABLE "users"
ADD COLUMN "googleId" TEXT;

ALTER TABLE "users"
ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
