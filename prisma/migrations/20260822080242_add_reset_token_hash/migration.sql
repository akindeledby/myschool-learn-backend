/*
  Warnings:

  - You are about to drop the `Feature` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FeatureUsage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubscriptionPlanFeature` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SubscriptionPlanFeature" DROP CONSTRAINT "SubscriptionPlanFeature_featureId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionPlanFeature" DROP CONSTRAINT "SubscriptionPlanFeature_planId_fkey";

-- AlterTable
ALTER TABLE "PasswordReset" ADD COLUMN     "resetTokenHash" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "explanation" TEXT;

-- DropTable
DROP TABLE "Feature";

-- DropTable
DROP TABLE "FeatureUsage";

-- DropTable
DROP TABLE "SubscriptionPlanFeature";
