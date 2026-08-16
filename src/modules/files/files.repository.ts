import { prisma } from '../../common/prisma/prisma.client';
import { PatientFileType } from '@prisma/client';

export interface SaveFileInput {
  clinicId: string;
  patientId: string;
  type: PatientFileType;
  mimeType: string;
  fileName: string;
  fileSize: number;
  url: string;
}

export class FilesRepository {
  create(data: SaveFileInput) {
    return prisma.patientFile.create({ data });
  }

  findByPatient(clinicId: string, patientId: string) {
    return prisma.patientFile.findMany({
      where: { patientId, clinicId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(clinicId: string, id: string) {
    return prisma.patientFile.findFirst({
      where: { id, clinicId },
    });
  }

  delete(clinicId: string, id: string) {
    return prisma.patientFile.deleteMany({
      where: { id, clinicId },
    });
  }
}
