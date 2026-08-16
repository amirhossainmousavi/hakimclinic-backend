import { FastifyReply, FastifyRequest } from 'fastify';
import { FilesService } from './files.service';
import { ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES, MAX_FILE_SIZE } from './files.schema';
import { UserPayload } from '../../common/types';
import { ValidationError } from '../../common/errors/custom.error';

export class FilesController {
  private filesService = new FilesService();

  upload = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { patientId } = request.params as { patientId: string };

    let buffer: Buffer | null = null;
    let mimeType = '';
    let fileName = '';
    let size = 0;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.mimetype !== undefined && part.mimetype !== null) {
          mimeType = String(part.mimetype);
        }
        fileName = String(part.filename ?? 'file');
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
        size = buffer.length;
      }
    }

    if (!buffer) {
      throw new ValidationError('فایلی ارسال نشده است');
    }

    const allowed = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES];
    if (!allowed.includes(mimeType)) {
      throw new ValidationError('فرمت فایل مجاز نیست. فقط تصویر (JPG/PNG/WebP) یا فیلم (MP4/MOV/WebM)');
    }
    if (size > MAX_FILE_SIZE) {
      throw new ValidationError('حجم فایل بیش از حد مجاز است (حداکثر ۵۰ مگابایت)');
    }

    const file = await this.filesService.upload(
      {
        clinicId,
        patientId,
        buffer,
        mimeType,
        fileName,
        size,
      },
      role,
      scopes
    );

    return reply.status(201).send({ success: true, data: file });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { patientId } = request.params as { patientId: string };

    const files = await this.filesService.list(clinicId, patientId, role, scopes);
    return reply.send({ success: true, data: files });
  };

  remove = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    await this.filesService.remove(clinicId, id, role, scopes);
    return reply.send({ success: true, data: { message: 'فایل حذف شد' } });
  };
}
