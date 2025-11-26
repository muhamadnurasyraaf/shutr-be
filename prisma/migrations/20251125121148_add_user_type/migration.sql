-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('Creator', 'Customer');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "type" "UserType" NOT NULL DEFAULT 'Customer';
