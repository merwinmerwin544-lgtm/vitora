import PDFDocument from 'pdfkit';

interface PDFReportData {
  reportUuid: string;
  date: string;
  patientName: string;
  ageMonths: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  muacCm: number;
  bmi: number;
  weightForHeightZ: number;
  heightForAgeZ: number;
  cheekHollowness: number;
  templeDepression: number;
  jawProminence: number;
  cheekboneProminence: number;
  symmetryScore: number;
  clinicalScore: number;
  facialScore: number;
  totalScore: number;
  classification: string;
  confidence: number;
  nutritionalAdvice: string;
  dietaryGuidelines: string;
  followUpInstructions: string;
}

export function generateScreeningPDF(data: PDFReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Colors
      const primaryColor = '#22C55E';
      const secondaryColor = '#10B981';
      const darkColor = '#1F2937';
      const lightBg = '#F3F4F6';
      const textMuted = '#4B5563';
      const dangerColor = '#EF4444';
      const warningColor = '#F59E0B';
      const successColor = '#10B981';

      // --- HEADER ---
      // Top header banner
      doc.rect(40, 40, 515, 60).fill(primaryColor);
      
      doc.fillColor('#FFFFFF')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text('VITORA HEALTHCARE', 55, 52, { align: 'left' });
      
      doc.fontSize(10)
         .font('Helvetica')
         .text('Early Malnutrition Screening Report', 55, 78);

      // Report Info
      doc.fillColor(textMuted)
         .fontSize(9)
         .text(`Report ID: ${data.reportUuid}`, 350, 52, { align: 'right', width: 190 })
         .text(`Date: ${data.date}`, 350, 68, { align: 'right', width: 190 })
         .text(`Status: Official AI Screening`, 350, 84, { align: 'right', width: 190 });

      doc.moveDown(4);

      // --- PATIENT INFO ---
      const patientY = 120;
      doc.fillColor(darkColor)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('Patient Demographics', 40, patientY);

      doc.strokeColor(primaryColor).lineWidth(1).moveTo(40, patientY + 18).lineTo(555, patientY + 18).stroke();

      doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(10);
      
      // Patient table grid
      const col1X = 50;
      const col2X = 300;
      let gridY = patientY + 28;

      doc.text('Patient Name:', col1X, gridY).font('Helvetica').text(data.patientName, col1X + 80, gridY);
      doc.font('Helvetica-Bold').text('Gender:', col2X, gridY).font('Helvetica').text(data.gender, col2X + 80, gridY);
      
      gridY += 18;
      const ageStr = `${data.ageMonths} months (${(data.ageMonths / 12).toFixed(1)} years)`;
      doc.font('Helvetica-Bold').text('Age (Months):', col1X, gridY).font('Helvetica').text(ageStr, col1X + 80, gridY);
      doc.font('Helvetica-Bold').text('Assessor:', col2X, gridY).font('Helvetica').text('Health Worker Admin', col2X + 80, gridY);

      doc.moveDown(2.5);

      // --- SCREENING RESULT SUMMARY ---
      const resultY = doc.y;
      doc.fillColor(darkColor)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('Screening Risk Assessment', 40, resultY);

      doc.strokeColor(primaryColor).lineWidth(1).moveTo(40, resultY + 18).lineTo(555, resultY + 18).stroke();

      // Large colored risk box
      const boxY = resultY + 28;
      const statusColor = data.classification === 'High Risk' 
        ? dangerColor 
        : data.classification === 'Moderate Risk' 
          ? warningColor 
          : successColor;

      doc.rect(40, boxY, 515, 65).fill(lightBg);
      
      // Risk level text
      doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(12).text('Risk Classification:', 60, boxY + 15);
      doc.fillColor(statusColor).fontSize(20).font('Helvetica-Bold').text(data.classification.toUpperCase(), 60, boxY + 30);

      // Score details
      doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('Overall Score:', 280, boxY + 15);
      doc.fontSize(22).fillColor(statusColor).text(`${data.totalScore.toFixed(1)} / 100`, 280, boxY + 28);
      
      // Confidence score
      doc.fillColor(textMuted).font('Helvetica').fontSize(9).text(`Prediction Confidence: ${(data.confidence * 100).toFixed(1)}%`, 420, boxY + 20);
      doc.text('Clinical Weight: 70%', 420, boxY + 32);
      doc.text('Facial AI Weight: 30%', 420, boxY + 44);

      // Draw horizontal visual gauge bar
      const gaugeY = boxY + 80;
      doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(10).text('Risk Indicator Visual Scale:', 40, gaugeY);
      
      // Draw background bar segments
      const barX = 40;
      const barY = gaugeY + 15;
      const segmentWidth = 515 / 3;
      
      // Normal segment (0 - 33)
      doc.rect(barX, barY, segmentWidth, 10).fill('#A7F3D0');
      // Moderate segment (33 - 66)
      doc.rect(barX + segmentWidth, barY, segmentWidth, 10).fill('#FDE68A');
      // High segment (66 - 100)
      doc.rect(barX + 2 * segmentWidth, barY, segmentWidth, 10).fill('#FCA5A5');

      // Draw pointer based on score
      const pointerX = barX + (data.totalScore / 100.0) * 515;
      doc.polygon([pointerX, barY - 4], [pointerX - 4, barY - 10], [pointerX + 4, barY - 10]).fill(statusColor);
      doc.rect(pointerX - 1, barY, 2, 10).fill(statusColor);

      // Labels below gauge bar
      doc.fillColor(textMuted).fontSize(8).font('Helvetica');
      doc.text('Normal (0-33)', barX, barY + 14, { width: segmentWidth, align: 'center' });
      doc.text('Moderate Risk (33-66)', barX + segmentWidth, barY + 14, { width: segmentWidth, align: 'center' });
      doc.text('High Risk (66-100)', barX + 2 * segmentWidth, barY + 14, { width: segmentWidth, align: 'center' });

      doc.moveDown(5);

      // --- MEASUREMENTS TABLE ---
      const tablesY = doc.y;
      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Clinical Anthropometric Data', 40, tablesY);

      doc.strokeColor(primaryColor).lineWidth(1).moveTo(40, tablesY + 14).lineTo(280, tablesY + 14).stroke();

      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Facial AI Morphometrics', 315, tablesY);

      doc.strokeColor(primaryColor).lineWidth(1).moveTo(315, tablesY + 14).lineTo(555, tablesY + 14).stroke();

      // Render columns
      let rowY = tablesY + 22;
      doc.fontSize(9).font('Helvetica');

      // Sub-function to draw key-value table row
      const drawRow = (y: number, key: string, val: string, xStart: number, width: number) => {
        doc.fillColor(darkColor).font('Helvetica-Bold').text(key, xStart, y);
        doc.fillColor(textMuted).font('Helvetica').text(val, xStart + width, y, { align: 'right', width: 90 });
        doc.strokeColor('#E5E7EB').lineWidth(0.5).moveTo(xStart, y + 12).lineTo(xStart + width + 90, y + 12).stroke();
      };

      // Clinical Data table
      drawRow(rowY, 'Height (cm):', `${data.heightCm} cm`, 40, 150);
      drawRow(rowY, 'Cheek Hollowness Index:', data.cheekHollowness.toFixed(3), 315, 150);
      
      rowY += 16;
      drawRow(rowY, 'Weight (kg):', `${data.weightKg} kg`, 40, 150);
      drawRow(rowY, 'Temple Depression Score:', data.templeDepression.toFixed(3), 315, 150);
      
      rowY += 16;
      drawRow(rowY, 'BMI (kg/m²):', `${data.bmi} kg/m²`, 40, 150);
      drawRow(rowY, 'Jaw Prominence Ratio:', data.jawProminence.toFixed(3), 315, 150);
      
      rowY += 16;
      drawRow(rowY, 'MUAC (cm):', `${data.muacCm} cm`, 40, 150);
      drawRow(rowY, 'Cheekbone Prominence:', data.cheekboneProminence.toFixed(3), 315, 150);
      
      rowY += 16;
      drawRow(rowY, 'Weight-for-Height Z-score:', `${data.weightForHeightZ >= 0 ? '+' : ''}${data.weightForHeightZ}`, 40, 150);
      drawRow(rowY, 'Facial Symmetry Score:', `${(data.symmetryScore * 100).toFixed(1)}%`, 315, 150);

      rowY += 16;
      drawRow(rowY, 'Height-for-Age Z-score:', `${data.heightForAgeZ >= 0 ? '+' : ''}${data.heightForAgeZ}`, 40, 150);
      doc.fillColor(darkColor).font('Helvetica-Bold').text('Facial Clinical Weight:', 315, rowY);
      doc.fillColor(textMuted).font('Helvetica').text('30% of total', 315 + 150, rowY, { align: 'right', width: 90 });

      doc.moveDown(4);

      // --- NUTRITIONAL ACTION PLAN ---
      const adviceY = doc.y;
      
      // High-risk warning notice
      if (data.classification === 'High Risk') {
        doc.rect(40, adviceY, 515, 30).fill('#FEE2E2');
        doc.fillColor('#991B1B').font('Helvetica-Bold').fontSize(9)
           .text('CRITICAL NOTICE: Immediate clinical evaluation is strongly recommended.', 50, adviceY + 10);
        doc.moveDown(2);
      }

      const planY = doc.y;
      doc.fillColor(darkColor)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('Suggested Nutritional Action Plan', 40, planY);

      doc.strokeColor(primaryColor).lineWidth(1).moveTo(40, planY + 18).lineTo(555, planY + 18).stroke();

      let planTextY = planY + 28;
      doc.fontSize(9.5).fillColor(darkColor);

      doc.font('Helvetica-Bold').text('Recommended Diet:', 40, planTextY);
      doc.font('Helvetica').text(data.nutritionalAdvice, 160, planTextY, { width: 395 });
      
      // Calculate height of wrapped text dynamically
      const dietHeight = doc.heightOfString(data.nutritionalAdvice, { width: 395 });
      planTextY += Math.max(dietHeight + 10, 25);

      doc.font('Helvetica-Bold').text('Lifestyle Advice:', 40, planTextY);
      doc.font('Helvetica').text(data.dietaryGuidelines, 160, planTextY, { width: 395 });
      
      const lifestyleHeight = doc.heightOfString(data.dietaryGuidelines, { width: 395 });
      planTextY += Math.max(lifestyleHeight + 10, 25);

      doc.font('Helvetica-Bold').text('Follow-up Protocols:', 40, planTextY);
      doc.font('Helvetica').text(data.followUpInstructions, 160, planTextY, { width: 395 });

      doc.moveDown(4.5);

      // --- LEGAL DISCLAIMER & FOOTER ---
      const footerY = 720;
      doc.strokeColor('#E5E7EB').lineWidth(0.5).moveTo(40, footerY - 10).lineTo(555, footerY - 10).stroke();

      doc.fillColor(textMuted)
         .fontSize(7.5)
         .font('Helvetica-Bold')
         .text('DISCLAIMER & LIMITATION OF LIABILITY:', 40, footerY)
         .font('Helvetica')
         .text(
           'This application is an AI-assisted screening tool and is NOT a medical diagnosis. The prediction is intended for early screening and triage assistance only. All high-risk cases and borderline results must be evaluated directly by qualified healthcare professionals. Vitora is not liable for clinical decisions made based on this automated screening utility.',
           40, footerY + 10, { width: 515, align: 'justify' }
         );

      doc.fontSize(8)
         .fillColor(textMuted)
         .text('Vitora Inc. | Support: support@vitora.ai | Confidential Pediatric Record', 40, footerY + 45, { align: 'center', width: 515 });

      // End PDF stream
      doc.end();

      // PDF generation completes and resolves inside doc.on('end') handler above

    } catch (err) {
      reject(err);
    }
  });
}
