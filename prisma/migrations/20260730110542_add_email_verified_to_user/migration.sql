-- DropIndex
DROP INDEX "snippet_code_trgm";

-- DropIndex
DROP INDEX "snippet_title_trgm";

-- DropIndex
DROP INDEX "tag_name_trgm";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3);
