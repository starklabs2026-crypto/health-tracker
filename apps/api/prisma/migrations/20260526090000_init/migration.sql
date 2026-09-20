-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "sex" TEXT NOT NULL,
    "unitsPreference" TEXT NOT NULL,
    "bloodGroup" TEXT,
    "residencyRegion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "knownConditions" TEXT[],
    "allergies" TEXT[],
    "currentMedications" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptsRemaining" INTEGER NOT NULL DEFAULT 3,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "biometricEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyLink" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "inviteToken" TEXT,

    CONSTRAINT "FamilyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileType" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "labName" TEXT,
    "orderingPhysician" TEXT,
    "notes" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending_upload',
    "ocrAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterCatalog" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[],
    "unit" TEXT NOT NULL,
    "panel" TEXT NOT NULL,
    "rangeDefault" JSONB NOT NULL,
    "criticalLow" DOUBLE PRECISION,
    "criticalHigh" DOUBLE PRECISION,

    CONSTRAINT "ParameterCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "parameterId" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isUserVerified" BOOLEAN NOT NULL DEFAULT false,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rangeFlag" TEXT NOT NULL DEFAULT 'unknown',
    "sourceRegion" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEditedAt" TIMESTAMP(3),

    CONSTRAINT "ParameterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorShare" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "parameterSet" JSONB NOT NULL,
    "includeDocuments" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "singleUse" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "customNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorShareAccess" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipCity" TEXT,
    "ipCountry" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "DoctorShareAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "HealthProfile_userId_key" ON "HealthProfile"("userId");

-- CreateIndex
CREATE INDEX "OtpCode_identifier_expiresAt_idx" ON "OtpCode"("identifier", "expiresAt");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyLink_inviteToken_key" ON "FamilyLink"("inviteToken");

-- CreateIndex
CREATE INDEX "FamilyLink_ownerUserId_status_idx" ON "FamilyLink"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "FamilyLink_memberUserId_status_idx" ON "FamilyLink"("memberUserId", "status");

-- CreateIndex
CREATE INDEX "Document_ownerUserId_sourceDate_idx" ON "Document"("ownerUserId", "sourceDate" DESC);

-- CreateIndex
CREATE INDEX "Document_ocrStatus_idx" ON "Document"("ocrStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterCatalog_canonicalName_key" ON "ParameterCatalog"("canonicalName");

-- CreateIndex
CREATE INDEX "ParameterReading_userId_parameterId_recordedAt_idx" ON "ParameterReading"("userId", "parameterId", "recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorShare_shareToken_key" ON "DoctorShare"("shareToken");

-- CreateIndex
CREATE INDEX "DoctorShare_ownerUserId_revokedAt_idx" ON "DoctorShare"("ownerUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "DoctorShareAccess_shareId_idx" ON "DoctorShareAccess"("shareId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_timestamp_idx" ON "AuditLog"("actorUserId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_timestamp_idx" ON "AuditLog"("targetUserId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Export_userId_idx" ON "Export"("userId");

-- AddForeignKey
ALTER TABLE "HealthProfile" ADD CONSTRAINT "HealthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterReading" ADD CONSTRAINT "ParameterReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterReading" ADD CONSTRAINT "ParameterReading_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterReading" ADD CONSTRAINT "ParameterReading_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterReading" ADD CONSTRAINT "ParameterReading_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "ParameterCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorShare" ADD CONSTRAINT "DoctorShare_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorShareAccess" ADD CONSTRAINT "DoctorShareAccess_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "DoctorShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
