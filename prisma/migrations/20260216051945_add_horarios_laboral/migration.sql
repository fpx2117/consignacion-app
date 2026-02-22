-- CreateTable
CREATE TABLE "HorarioLaboral" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HorarioLaboral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HorarioLaboral_usuarioId_diaSemana_key" ON "HorarioLaboral"("usuarioId", "diaSemana");

-- AddForeignKey
ALTER TABLE "HorarioLaboral" ADD CONSTRAINT "HorarioLaboral_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
