-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startLabel" TEXT NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLabel" TEXT,
    "endLat" DOUBLE PRECISION,
    "endLng" DOUBLE PRECISION,
    "loopRide" BOOLEAN NOT NULL DEFAULT false,
    "vehicleType" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteOption" (
    "id" TEXT NOT NULL,
    "routeRequestId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "durationMin" DOUBLE PRECISION NOT NULL,
    "surfaceMix" JSONB NOT NULL,
    "twistinessScore" DOUBLE PRECISION NOT NULL,
    "difficultyScore" DOUBLE PRECISION NOT NULL,
    "score" JSONB NOT NULL,
    "geometry" JSONB NOT NULL,
    "providerMeta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RouteOption_routeRequestId_rank_idx" ON "RouteOption"("routeRequestId", "rank");

-- AddForeignKey
ALTER TABLE "RouteRequest" ADD CONSTRAINT "RouteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteOption" ADD CONSTRAINT "RouteOption_routeRequestId_fkey" FOREIGN KEY ("routeRequestId") REFERENCES "RouteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
