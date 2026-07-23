import { Router, Response } from 'express';
import { prisma } from '../utils/db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { storage } from '../utils/storage';

const router = Router();

// Get History of past reports with optional search by patient name
router.get('/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { search } = req.query;

  if (!userId) {
    return res.status(401).json({ error: 'User context not found' });
  }

  try {
    const patients = await prisma.patient.findMany({
      where: {
        userId,
        name: search ? { contains: String(search) } : undefined,
      },
      include: {
        predictions: {
          orderBy: { predictedAt: 'desc' },
          include: {
            reports: true,
          },
        },
        clinicalData: {
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as any;

    // Format results to a clean list of screenings
    const historyList = patients.flatMap((patient: any) => {
      return patient.predictions.flatMap((pred: any) => {
        const report = pred.reports[0];
        const matchingClinical = patient.clinicalData.find(
          (c: any) => Math.abs(c.recordedAt.getTime() - pred.predictedAt.getTime()) < 5000
        ) || patient.clinicalData[0];

        return {
          predictionId: pred.id,
          reportId: report?.id || null,
          reportUuid: report?.reportUuid || null,
          patientId: patient.id,
          patientName: patient.name,
          ageMonths: patient.ageMonths,
          gender: patient.gender,
          date: pred.predictedAt,
          overallScore: pred.totalScore,
          classification: pred.classification,
          confidence: pred.confidence,
          muac: matchingClinical?.muacCm || null,
          bmi: matchingClinical?.bmi || null,
        };
      });
    });

    // Sort by date descending
    historyList.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

    return res.json(historyList);
  } catch (error) {
    console.error('Fetch history error:', error);
    return res.status(500).json({ error: 'Internal server error retrieving history logs' });
  }
});

// Serve compiled PDF Report
router.get('/:uuid/pdf', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { uuid } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'User context not found' });
  }

  try {
    const report = await prisma.report.findUnique({
      where: { reportUuid: uuid },
      include: {
        prediction: {
          include: {
            patient: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Security check: ensure this health worker user is the owner of the patient
    if (report.prediction.patient.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this patient report' });
    }

    if (!report.pdfPath) {
      return res.status(404).json({ error: 'PDF file path not recorded for this report' });
    }

    try {
      const fileSource = await storage.getFileStream(report.pdfPath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Vitora_Report_${uuid}.pdf`);
      
      if (Buffer.isBuffer(fileSource)) {
        res.send(fileSource);
      } else {
        (fileSource as any).pipe(res);
      }
    } catch (fileError) {
      console.error('File retrieval error:', fileError);
      return res.status(404).json({ error: 'PDF report file could not be retrieved from storage' });
    }

  } catch (error) {
    console.error('Fetch PDF error:', error);
    return res.status(500).json({ error: 'Internal server error retrieving report PDF document' });
  }
});

export default router;
