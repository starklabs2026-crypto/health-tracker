import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { findById, formatRange } from '@medical-tracker/parameter-catalog';
import { FamilyLinkStatus, RangeFlag } from '@medical-tracker/shared-types';

import { PrismaService } from '../prisma/prisma.service.js';

const FLAG_LABELS: Record<string, string> = {
  [RangeFlag.Normal]: 'Normal',
  [RangeFlag.Low]: 'Low',
  [RangeFlag.High]: 'High',
  [RangeFlag.Critical]: 'Critical',
  [RangeFlag.Unknown]: '—',
};

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async streamPdf(requesterId: string, targetId: string, res: Response): Promise<void> {
    // Authorise: self or active family member
    if (requesterId !== targetId) {
      const link = await this.prisma.familyLink.findFirst({
        where: { ownerUserId: targetId, memberUserId: requesterId, status: FamilyLinkStatus.Active },
      });
      if (!link) throw new ForbiddenException('No access to this profile');
    }

    const user = await this.prisma.user.findFirst({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');

    const ageYears = Math.floor(
      (Date.now() - user.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
    const sex = user.sex === 'male' ? 'male' : user.sex === 'female' ? 'female' : undefined;

    const readings = await this.prisma.parameterReading.findMany({
      where: { userId: targetId },
      orderBy: [{ parameterId: 'asc' }, { recordedAt: 'asc' }],
    });

    // Group by parameterId
    const byParam = new Map<string, typeof readings>();
    for (const r of readings) {
      const arr = byParam.get(r.parameterId) ?? [];
      arr.push(r);
      byParam.set(r.parameterId, arr);
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(20).fillColor('#1F4E79').text('Medical Tracker — Health Summary', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#5C6B7A').text(
      `Generated: ${new Date().toLocaleString()}`,
      { align: 'center' },
    );
    doc.moveDown(1);

    // ── Patient info ─────────────────────────────────────────────────────────
    doc.fontSize(13).fillColor('#1F4E79').text('Patient');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#1A1A1A');
    doc.text(`Name: ${user.name}`);
    doc.text(`Age: ${ageYears}y   Sex: ${user.sex}${user.bloodGroup ? `   Blood group: ${user.bloodGroup}` : ''}`);
    doc.moveDown(1);

    // ── Readings ─────────────────────────────────────────────────────────────
    if (byParam.size === 0) {
      doc.fontSize(11).fillColor('#5C6B7A').text('No readings recorded.');
    } else {
      for (const [parameterId, pts] of byParam) {
        const entry = findById(parameterId);
        if (!entry) continue;
        const rangeLabel = formatRange(entry, { sex, ageYears });

        doc.fontSize(12).fillColor('#1F4E79').text(`${entry.canonicalName} (${entry.unit})`);
        doc.fontSize(9).fillColor('#5C6B7A').text(`Reference: ${rangeLabel}`);
        doc.moveDown(0.3);

        // Table header
        const tableTop = doc.y;
        const colDate = 50;
        const colValue = 200;
        const colFlag = 330;
        const rowH = 18;

        doc.fontSize(9).fillColor('#5C6B7A');
        doc.text('Date', colDate, tableTop);
        doc.text('Value', colValue, tableTop);
        doc.text('Flag', colFlag, tableTop);
        doc.moveTo(50, tableTop + 12).lineTo(500, tableTop + 12).strokeColor('#DEE5EC').stroke();

        let rowY = tableTop + rowH;
        for (const pt of pts.slice(-10)) { // last 10 readings per parameter
          const flag = pt.rangeFlag;
          const flagColor =
            flag === RangeFlag.Critical ? '#B71C1C'
            : flag === RangeFlag.High ? '#E65100'
            : flag === RangeFlag.Low ? '#1565C0'
            : flag === RangeFlag.Normal ? '#2E7D32'
            : '#5C6B7A';

          doc.fontSize(9).fillColor('#1A1A1A');
          doc.text(new Date(pt.recordedAt).toLocaleDateString(), colDate, rowY);
          doc.text(`${Number(pt.value)} ${pt.unit}`, colValue, rowY);
          doc.fillColor(flagColor).text(FLAG_LABELS[flag] ?? flag, colFlag, rowY);
          rowY += rowH;

          // Page break guard
          if (rowY > 740) {
            doc.addPage();
            rowY = 50;
          }
        }

        doc.moveDown(1.5);
      }
    }

    doc.end();
  }
}
