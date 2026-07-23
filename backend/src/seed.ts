import { prisma } from './utils/db';
import { generateScreeningPDF } from './utils/pdfGenerator';

async function seed() {
  console.log('⏳ Starting database seeding...');

  // 1. Clean existing records
  await prisma.auditLog.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.prediction.deleteMany({});
  await prisma.faceAnalysis.deleteMany({});
  await prisma.clinicalData.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧹 Database cleared.');

  // 2. Create health worker
  const user = await prisma.user.create({
    data: {
      firebaseUid: 'mock_firebase_uid_fleming',
      provider: 'Google',
      name: 'Dr. Alexander Fleming',
      email: 'clinician@vitora.ai',
      role: 'HEALTH_WORKER',
      lastLogin: new Date()
    },
  });

  console.log(`👤 Seeded health worker account:
  Email: clinician@vitora.ai
  Provider: Google (Bypassed under offline sandbox)`);

  // 3. Mock datasets
  const mockPatients = [
    {
      name: 'Marcus Aurelius',
      ageMonths: 36,
      gender: 'MALE',
      parentContact: '+1 555-0101',
      clinical: {
        heightCm: 96.2,
        weightKg: 14.8,
        muacCm: 14.5,
        bmi: 16.0,
        heightForAgeZ: 0.05,
        weightForHeightZ: 0.12,
        clinicalScore: 0.0,
      },
      facial: {
        cheekHollowness: 0.58,
        templeDepression: 0.59,
        jawProminence: 0.60,
        cheekboneProminence: 0.62,
        templeWidth: 0.61,
        facialWidthRatio: 0.81,
        jawWidthRatio: 0.71,
        symmetryScore: 0.98,
        facialScore: 12.0,
      },
      prediction: {
        totalScore: 12.0,
        classification: 'Normal',
        confidence: 0.91,
      },
      report: {
        reportUuid: 'VIT-MARCUS01',
        nutritionalAdvice: 'Maintain an age-appropriate balanced diet containing core food groups (proteins, complex carbohydrates, lipids). Continue standard growth monitoring.',
        dietaryGuidelines: 'Incorporate locally sourced fresh fruits, green vegetables, dairy products, and complete immunization schedules.',
        followUpInstructions: 'Schedule regular quarterly developmental and weight checks at local pediatric clinics.',
      }
    },
    {
      name: 'Sophia Loren',
      ageMonths: 28,
      gender: 'FEMALE',
      parentContact: '+1 555-0202',
      clinical: {
        heightCm: 88.5,
        weightKg: 10.2,
        muacCm: 12.0, // Moderate risk
        bmi: 13.0,
        heightForAgeZ: -1.85,
        weightForHeightZ: -2.12, // Moderate risk
        clinicalScore: 50.0,
      },
      facial: {
        cheekHollowness: 0.48,
        templeDepression: 0.49,
        jawProminence: 0.51,
        cheekboneProminence: 0.55,
        templeWidth: 0.52,
        facialWidthRatio: 0.75,
        jawWidthRatio: 0.65,
        symmetryScore: 0.95,
        facialScore: 58.0,
      },
      prediction: {
        totalScore: 52.4,
        classification: 'Moderate Risk',
        confidence: 0.74,
      },
      report: {
        reportUuid: 'VIT-SOPHIA02',
        nutritionalAdvice: 'Introduce nutrient-dense local supplementary food formulas containing high protein and fat content. Administer multi-micronutrient powders.',
        dietaryGuidelines: 'Add daily servings of cooked eggs, full cream milk, mashed legumes, and energy-enriched porridge (adding 1 tsp vegetable oil or ghee per serving).',
        followUpInstructions: 'Schedule active check-in reviews in 2 weeks. Monitor MUAC arm band boundaries and weight profile twice weekly.',
      }
    },
    {
      name: 'Leo Messi',
      ageMonths: 48,
      gender: 'MALE',
      parentContact: '+1 555-0303',
      clinical: {
        heightCm: 102.5,
        weightKg: 10.5, // Severe stunting/wasting
        muacCm: 11.0, // High risk
        bmi: 10.0,
        heightForAgeZ: -3.12,
        weightForHeightZ: -3.45,
        clinicalScore: 100.0,
      },
      facial: {
        cheekHollowness: 0.35,
        templeDepression: 0.38,
        jawProminence: 0.41,
        cheekboneProminence: 0.48,
        templeWidth: 0.44,
        facialWidthRatio: 0.68,
        jawWidthRatio: 0.58,
        symmetryScore: 0.94,
        facialScore: 88.0,
      },
      prediction: {
        totalScore: 86.5,
        classification: 'High Risk',
        confidence: 0.84,
      },
      report: {
        reportUuid: 'VIT-LEOMES03',
        nutritionalAdvice: 'Immediate administration of Ready-to-Use Therapeutic Food (RUTF) like Plumpy\'Nut under strict supervision. Rehydrate using ReSoMal solution if needed.',
        dietaryGuidelines: 'Feed child in small frequent portions (every 2-3 hours, 8 times daily). Protect child from cold environments to prevent hypothermia.',
        followUpInstructions: 'CRITICAL NOTICE: Immediate referral to pediatrician or therapeutic outpatient care center. Child requires weekly clinical audits.',
      }
    }
  ];

  for (const mock of mockPatients) {
    const patient = await prisma.patient.create({
      data: {
        name: mock.name,
        ageMonths: mock.ageMonths,
        gender: mock.gender,
        parentContact: mock.parentContact,
        userId: user.id,
      },
    });

    const clinical = await prisma.clinicalData.create({
      data: {
        patientId: patient.id,
        heightCm: mock.clinical.heightCm,
        weightKg: mock.clinical.weightKg,
        muacCm: mock.clinical.muacCm,
        bmi: mock.clinical.bmi,
        heightForAgeZ: mock.clinical.heightForAgeZ,
        weightForHeightZ: mock.clinical.weightForHeightZ,
      },
    });

    await prisma.faceAnalysis.create({
      data: {
        patientId: patient.id,
        cheekHollowness: mock.facial.cheekHollowness,
        templeDepression: mock.facial.templeDepression,
        jawProminence: mock.facial.jawProminence,
        cheekboneProminence: mock.facial.cheekboneProminence,
        templeWidth: mock.facial.templeWidth,
        facialWidthRatio: mock.facial.facialWidthRatio,
        jawWidthRatio: mock.facial.jawWidthRatio,
        symmetryScore: mock.facial.symmetryScore,
      },
    });

    const prediction = await prisma.prediction.create({
      data: {
        patientId: patient.id,
        clinicalScore: mock.clinical.clinicalScore,
        facialScore: mock.facial.facialScore,
        totalScore: mock.prediction.totalScore,
        classification: mock.prediction.classification,
        confidence: mock.prediction.confidence,
      },
    });

    // Compile dynamic PDF buffer
    const pdfBuffer = await generateScreeningPDF({
      reportUuid: mock.report.reportUuid,
      date: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
      patientName: patient.name,
      ageMonths: patient.ageMonths,
      gender: patient.gender,
      heightCm: clinical.heightCm,
      weightKg: clinical.weightKg,
      muacCm: clinical.muacCm,
      bmi: clinical.bmi,
      weightForHeightZ: clinical.weightForHeightZ,
      heightForAgeZ: clinical.heightForAgeZ,
      cheekHollowness: mock.facial.cheekHollowness,
      templeDepression: mock.facial.templeDepression,
      jawProminence: mock.facial.jawProminence,
      cheekboneProminence: mock.facial.cheekboneProminence,
      symmetryScore: mock.facial.symmetryScore,
      clinicalScore: mock.clinical.clinicalScore,
      facialScore: mock.facial.facialScore,
      totalScore: mock.prediction.totalScore,
      classification: mock.prediction.classification,
      confidence: mock.prediction.confidence,
      nutritionalAdvice: mock.report.nutritionalAdvice,
      dietaryGuidelines: mock.report.dietaryGuidelines,
      followUpInstructions: mock.report.followUpInstructions,
    });

    // Save PDF locally using storage adapter mock directory path
    const reportsDir = 'reports';
    const filename = `report_${mock.report.reportUuid}.pdf`;
    const relativePath = `${reportsDir}/${filename}`;
    
    // Save buffer using our adapter API directly
    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.join(__dirname, '../', relativePath);
    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(absolutePath, pdfBuffer);

    await prisma.report.create({
      data: {
        predictionId: prediction.id,
        reportUuid: mock.report.reportUuid,
        nutritionalAdvice: mock.report.nutritionalAdvice,
        dietaryGuidelines: mock.report.dietaryGuidelines,
        followUpInstructions: mock.report.followUpInstructions,
        pdfPath: relativePath,
      },
    });

    console.log(`✅ Seeded Patient: ${mock.name} [${mock.prediction.classification}] -> PDF Written.`);
  }

  // Create registration/login audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'DATABASE_SYSTEM_SEEDED',
    },
  });

  console.log('🎉 Database seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  });
