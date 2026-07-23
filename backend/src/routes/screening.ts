import { Router, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
  calculateBMI,
  calculateHeightForAgeZ,
  calculateWeightForHeightZ,
  evaluateClinicalRiskScore
} from '../utils/growth';
import { generateScreeningPDF } from '../utils/pdfGenerator';
import { storage } from '../utils/storage';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Step 1: Submit Clinical Information
router.post('/clinical', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, ageMonths, gender, parentContact, heightCm, weightKg, muacCm } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User context not found' });
  }

  if (!name || !ageMonths || !gender || !heightCm || !weightKg || !muacCm) {
    return res.status(400).json({ error: 'All clinical and patient demographic fields are required' });
  }

  try {
    const age = parseInt(ageMonths);
    const height = parseFloat(heightCm);
    const weight = parseFloat(weightKg);
    const muac = parseFloat(muacCm);

    // Compute Clinical parameters
    const bmi = calculateBMI(weight, height);
    const haz = calculateHeightForAgeZ(age, height, gender);
    const wzh = calculateWeightForHeightZ(height, weight, gender);
    const clinicalEval = evaluateClinicalRiskScore(bmi, muac, wzh, haz);

    // Transaction to create patient and clinical record
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create/Find Patient
      const patient = await tx.patient.create({
        data: {
          name,
          ageMonths: age,
          gender,
          parentContact,
          userId,
        },
      });

      // 2. Save Clinical Data
      const clinicalRecord = await tx.clinicalData.create({
        data: {
          patientId: patient.id,
          heightCm: height,
          weightKg: weight,
          muacCm: muac,
          bmi,
          heightForAgeZ: haz,
          weightForHeightZ: wzh,
        },
      });

      return { patient, clinicalRecord };
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: `SUBMITTED_CLINICAL_DATA_PATIENT_${result.patient.id}`,
        ipAddress: req.ip,
      },
    });

    return res.status(201).json({
      patientId: result.patient.id,
      patient: result.patient,
      clinicalData: result.clinicalRecord,
      clinicalScore: clinicalEval.score,
      clinicalDetails: clinicalEval.details,
    });
  } catch (error) {
    console.error('Clinical submission error:', error);
    return res.status(500).json({ error: 'Internal server error processing clinical parameters' });
  }
});

// Step 2 & 3: Submit Image for Face Analysis & Fusion Prediction
router.post('/face-scan', authMiddleware, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { patientId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'User context not found' });
  }

  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Screening image file is required' });
  }

  try {
    const pId = parseInt(patientId);

    // Verify patient and clinical data exist
    const patient = await prisma.patient.findUnique({
      where: { id: pId },
      include: { clinicalData: { orderBy: { recordedAt: 'desc' }, take: 1 } },
    });

    if (!patient || patient.clinicalData.length === 0) {
      return res.status(404).json({ error: 'Patient or matching clinical records not found' });
    }

    const clinicalRecord = patient.clinicalData[0];

    // Compute Clinical evaluation score (70%)
    const clinicalEval = evaluateClinicalRiskScore(
      clinicalRecord.bmi,
      clinicalRecord.muacCm,
      clinicalRecord.weightForHeightZ,
      clinicalRecord.heightForAgeZ
    );

    // Call Python FastAPI prediction service
    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
    
    // Natively construct multipart form upload using Node global Blob/FormData
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    // Append the file field matching fastapi UploadFile parameter name: 'file'
    formData.append('file', blob, req.file.originalname);

    let aiResult;
    try {
      const response = await axios.post(`${AI_URL}/predict`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      aiResult = response.data;
    } catch (aiError: any) {
      console.error('AI pipeline connection failed:', aiError.response?.data || aiError.message);
      return res.status(aiError.response?.status || 502).json({
        error: aiError.response?.data?.detail || 'AI predictive service is offline or returned an error. Please verify the Python service is running.',
      });
    }

    const { classification: facialClass, confidence: aiConfidence, facial_risk_score: facialScore, facial_features: features } = aiResult;

    // Combine Scores: 70% Clinical + 30% Facial AI
    const totalScore = parseFloat((clinicalEval.score * 0.7 + facialScore * 0.3).toFixed(2));

    // Determine final fusion classification
    let finalClassification = 'Normal';
    if (totalScore >= 66.0) {
      finalClassification = 'High Risk';
    } else if (totalScore >= 33.0) {
      finalClassification = 'Moderate Risk';
    }

    // Generate nutrition recommendations based on the overall risk
    let nutritionalAdvice = '';
    let dietaryGuidelines = '';
    let followUpInstructions = '';

    if (finalClassification === 'High Risk') {
      nutritionalAdvice = 'High-Energy Therapeutic Foods (RUTF/Plumpy\'Nut) must be administered under supervision. Rehydrate with specialized oral solutions (ReSoMal) if dehydrated. Avoid feeding standard high-volume low-energy local foods initially.';
      dietaryGuidelines = 'Feed in small frequent intervals (every 2-3 hours, 8 times daily). Ensure trace elements and mineral additions (Zinc, Vitamin A, Folic acid). Maintain warmth to prevent hypothermia.';
      followUpInstructions = 'CRITICAL: Immediate referral to a pediatrician or specialized outpatient therapeutic center. Patient must undergo weekly growth screening, hydration checks, and medical complications auditing.';
    } else if (finalClassification === 'Moderate Risk') {
      nutritionalAdvice = 'Introduce nutrient-dense local diets containing high protein and fat content. Supplement with multi-nutrient powders, iron, and vitamin complexes. Support continued, frequent breastfeeding if applicable.';
      dietaryGuidelines = 'Incorporate daily servings of eggs, milk, pulverized seeds/nuts, legumes, and orange-fleshed vegetables. Feed 5-6 times daily with energy-enriched porridge (adding oil or butter).';
      followUpInstructions = 'Schedule an active clinical review in 2 weeks. Monitor arm circumference (MUAC) and weight twice weekly. Train caregivers on sanitization and clean feeding practices.';
    } else {
      nutritionalAdvice = 'Maintain an age-appropriate balanced diet containing core food groups (proteins, carbohydrates, healthy lipids, vitamins). Encourage continued breastfeeding up to 2 years and beyond.';
      dietaryGuidelines = 'Focus on locally sourced vegetables, fresh fruits, whole grains, and clean protein items. Ensure child receives complete standard immunization schedule and vitamin A distributions.';
      followUpInstructions = 'Conduct routine weight and stature tracking during standard monthly/quarterly vaccination and pediatric appointments. Re-screen if the caregiver reports lethargy or loss of appetite.';
    }

    const reportUuid = `VIT-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Transaction to write AI features, predictions, reports
    const reportData = await prisma.$transaction(async (tx) => {
      // 1. Save Face Analysis ratios
      await tx.faceAnalysis.create({
        data: {
          patientId: pId,
          cheekHollowness: features.cheek_hollowness,
          templeDepression: features.temple_depression,
          jawProminence: features.jaw_prominence,
          cheekboneProminence: features.cheekbone_prominence,
          templeWidth: features.temple_width,
          facialWidthRatio: features.facial_width_ratio,
          jawWidthRatio: features.jaw_width_ratio,
          symmetryScore: features.facial_symmetry,
        },
      });

      // 2. Save Prediction Results
      const prediction = await tx.prediction.create({
        data: {
          patientId: pId,
          clinicalScore: clinicalEval.score,
          facialScore: parseFloat(facialScore.toFixed(2)),
          totalScore,
          classification: finalClassification,
          confidence: aiConfidence,
        },
      });

      // 3. Create Report Details
      const report = await tx.report.create({
        data: {
          predictionId: prediction.id,
          reportUuid,
          nutritionalAdvice,
          dietaryGuidelines,
          followUpInstructions,
        },
      });

      return { prediction, report };
    });

    // Compile the Hospital-Grade PDF report
    const pdfBuffer = await generateScreeningPDF({
      reportUuid,
      date: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
      patientName: patient.name,
      ageMonths: patient.ageMonths,
      gender: patient.gender,
      heightCm: clinicalRecord.heightCm,
      weightKg: clinicalRecord.weightKg,
      muacCm: clinicalRecord.muacCm,
      bmi: clinicalRecord.bmi,
      weightForHeightZ: clinicalRecord.weightForHeightZ,
      heightForAgeZ: clinicalRecord.heightForAgeZ,
      cheekHollowness: features.cheek_hollowness,
      templeDepression: features.temple_depression,
      jawProminence: features.jaw_prominence,
      cheekboneProminence: features.cheekbone_prominence,
      symmetryScore: features.facial_symmetry,
      clinicalScore: clinicalEval.score,
      facialScore: parseFloat(facialScore.toFixed(2)),
      totalScore,
      classification: finalClassification,
      confidence: aiConfidence,
      nutritionalAdvice,
      dietaryGuidelines,
      followUpInstructions,
    });

    const storagePathOrUrl = await storage.uploadFile(`reports/report_${reportUuid}.pdf`, pdfBuffer, 'application/pdf');

    // Update pdfPath in report table
    await prisma.report.update({
      where: { id: reportData.report.id },
      data: { pdfPath: storagePathOrUrl },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: `GENERATED_REPORT_${reportUuid}_PATIENT_${pId}`,
        ipAddress: req.ip,
      },
    });

    return res.status(201).json({
      reportId: reportData.report.id,
      reportUuid,
      overallScore: totalScore,
      classification: finalClassification,
      confidence: aiConfidence,
      clinicalScore: clinicalEval.score,
      facialScore: parseFloat(facialScore.toFixed(2)),
      recommendations: {
        nutritionalAdvice,
        dietaryGuidelines,
        followUpInstructions,
      },
      patient,
      clinicalData: clinicalRecord,
      facialFeatures: features,
    });

  } catch (error) {
    console.error('Face scan submission error:', error);
    return res.status(500).json({ error: 'Internal server error processing face scan and AI pipeline' });
  }
});

export default router;
