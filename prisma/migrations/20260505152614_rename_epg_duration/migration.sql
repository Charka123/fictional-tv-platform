/*
  Warnings:

  - You are about to drop the column `duration` on the `EPGItem` table. All the data in the column will be lost.
  - Added the required column `durationMinutes` to the `EPGItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EPGItem" DROP COLUMN "duration",
ADD COLUMN     "durationMinutes" INTEGER NOT NULL;
