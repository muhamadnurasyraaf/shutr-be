/*
  Warnings:

  - You are about to drop the column `url` on the `images` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `variants` table. All the data in the column will be lost.
  - Added the required column `publicId` to the `images` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicId` to the `variants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "images" DROP COLUMN "url",
ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "variants" DROP COLUMN "url",
ADD COLUMN     "publicId" TEXT NOT NULL;
