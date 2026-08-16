import { prisma } from '../../common/prisma/prisma.client';

export class SmsService {
  async getTemplate(clinicId: string, eventKey: string) {
    const template = await prisma.smsTemplate.findUnique({
      where: {
        clinicId_eventKey: { clinicId, eventKey },
      },
    });
    return template ? template.patternCode : null;
  }

  async updateTemplate(clinicId: string, eventKey: string, patternCode: string) {
    return prisma.smsTemplate.upsert({
      where: {
        clinicId_eventKey: { clinicId, eventKey },
      },
      update: { patternCode },
      create: { clinicId, eventKey, patternCode },
    });
  }

  async sendSms(phone: string, patternCode: string, params: Record<string, string>) {
    // Provider agnostic adapter simulation (Kavenegar / MelliPayamak)
    console.log(`[SMS ADAPTER] Sending SMS to ${phone} using pattern ${patternCode} with params:`, params);
    return true;
  }
}

export const smsService = new SmsService();
