import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { 
  Download, 
  ArrowRight, 
  ShieldAlert, 
  Calendar, 
  Apple, 
  Heart, 
  CornerDownRight
} from 'lucide-react';

const Report: React.FC = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  // If page accessed directly, retrieve report. (For robustness, check state first)
  const reportData = state?.report;

  if (!reportData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel p-8 rounded-glass max-w-sm space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-vitora-text">No Report Data Cached</h2>
          <p className="text-xs text-vitora-text/60 leading-relaxed font-semibold">
            Please run a new malnutrition screening workflow to generate diagnostic values.
          </p>
          <button 
            onClick={() => navigate('/screening')}
            className="w-full py-2.5 rounded-2xl glass-button text-xs font-bold"
          >
            Start New Screening
          </button>
        </div>
      </div>
    );
  }

  const {
    reportUuid,
    overallScore,
    classification,
    confidence,
    clinicalScore,
    facialScore,
    recommendations,
    patient,
    clinicalData,
    facialFeatures
  } = reportData;

  // Colors mapping
  const isHigh = classification === 'High Risk';
  const isMod = classification === 'Moderate Risk';
  
  const statusColor = isHigh 
    ? 'text-red-500' 
    : isMod 
      ? 'text-amber-500' 
      : 'text-emerald-500';
  
  const statusBg = isHigh 
    ? 'bg-red-500/10 border-red-500/20' 
    : isMod 
      ? 'bg-amber-500/10 border-amber-500/20' 
      : 'bg-emerald-500/10 border-emerald-500/20';

  // SVG Circular Gauge variables
  const radius = 60;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  // Download PDF file
  const downloadPDF = async () => {
    try {
      const response = await api.get(`/reports/${reportUuid}/pdf`, {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `Vitora_Report_${reportUuid}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Error fetching compiled report PDF file.');
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      
      {/* Header section */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 glass-panel px-6 py-5 rounded-3xl shadow-md border-white/50">
        <div>
          <span className="text-3xs font-black text-vitora-secondary tracking-widest block uppercase">Screening Result Summary</span>
          <h1 className="text-2xl font-black text-vitora-text mt-0.5">Official Health Record</h1>
          <p className="text-4xs text-vitora-text/40 font-bold uppercase tracking-wider mt-0.5">Report ID: {reportUuid}</p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={downloadPDF}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-button text-xs font-bold shadow-md"
          >
            <Download className="w-4.5 h-4.5" /> Download PDF Report
          </button>
          
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-button-secondary text-xs font-bold border border-vitora-border/60"
          >
            Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Immediate critical notification for high risk */}
      {isHigh && (
        <motion.div 
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 bg-red-500/10 border-2 border-red-500/30 text-red-800 rounded-2xl flex items-center gap-3.5"
        >
          <ShieldAlert className="w-6 h-6 flex-shrink-0 text-red-500" />
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider">CRITICAL MEDICAL WARNING</h4>
            <p className="text-2xs font-semibold mt-0.5 leading-relaxed">
              Immediate clinical evaluation is strongly recommended. The child exhibits anatomical and morphometric indices indicative of severe malnutrition.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Core Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Risk Gauge & Clinical Probability */}
        <div className="space-y-6">
          
          {/* Animated Circular Gauge */}
          <div className="glass-panel p-6 rounded-glass shadow-md text-center flex flex-col items-center justify-center border-white/50">
            <h3 className="text-xs font-black text-vitora-text/50 uppercase tracking-widest mb-4">Risk Evaluation Score</h3>
            
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                {/* Gray back circle */}
                <circle
                  stroke="rgba(0,0,0,0.06)"
                  fill="transparent"
                  strokeWidth={stroke}
                  r={normalizedRadius}
                  cx={radius + 12}
                  cy={radius + 12}
                />
                {/* Active animated circle */}
                <motion.circle
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  stroke={isHigh ? '#EF4444' : isMod ? '#F59E0B' : '#10B981'}
                  fill="transparent"
                  strokeWidth={stroke}
                  strokeDasharray={circumference + ' ' + circumference}
                  r={normalizedRadius}
                  cx={radius + 12}
                  cy={radius + 12}
                  strokeLinecap="round"
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-vitora-text leading-none">{overallScore}%</span>
                <span className="text-[10px] font-extrabold text-vitora-text/45 uppercase tracking-widest mt-1">Severity</span>
              </div>
            </div>

            <div className={`mt-5 px-4.5 py-1.5 rounded-full border text-3xs font-extrabold uppercase tracking-widest ${statusBg} ${statusColor}`}>
              {classification}
            </div>

            <p className="text-3xs text-vitora-text/50 font-bold uppercase tracking-wider mt-4">
              AI Confidence: {(confidence * 100).toFixed(1)}%
            </p>
          </div>

          {/* Probability Distribution */}
          <div className="glass-panel p-5 rounded-glass shadow-md border-white/50 space-y-4">
            <h3 className="text-xs font-black text-vitora-text/50 uppercase tracking-widest">Diagnostic Weights</h3>
            
            <div className="space-y-3 font-semibold text-2xs">
              <div>
                <div className="flex justify-between text-vitora-text/70 mb-1">
                  <span>Clinical Questionnaire (70%)</span>
                  <span>{clinicalScore.toFixed(0)} / 100</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-vitora-primary rounded-full" style={{ width: `${clinicalScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-vitora-text/70 mb-1">
                  <span>AI Facial Morphometrics (30%)</span>
                  <span>{facialScore.toFixed(0)} / 100</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-vitora-secondary rounded-full" style={{ width: `${facialScore}%` }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Demographics, Clinical & Facial Details */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Patient Info & Clinical Data */}
          <div className="glass-panel p-6 rounded-glass shadow-md border-white/50 space-y-5">
            <div className="flex items-center justify-between border-b border-vitora-text/10 pb-3">
              <div>
                <h3 className="text-md font-bold text-vitora-text">{patient.name}</h3>
                <p className="text-3xs text-vitora-text/45 font-bold uppercase tracking-wider mt-0.5">
                  {patient.gender} | {patient.ageMonths} Months ({ (patient.ageMonths / 12).toFixed(1) } Years)
                </p>
              </div>
              <div className="flex items-center gap-1 text-4xs text-vitora-text/40 font-bold uppercase">
                <Calendar className="w-3.5 h-3.5" /> Checked Just Now
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              
              <div className="p-3 bg-white/40 border border-white/50 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold text-vitora-text/40 uppercase tracking-wide">Height</span>
                <p className="text-md font-black text-vitora-text mt-0.5">{clinicalData.heightCm} cm</p>
              </div>

              <div className="p-3 bg-white/40 border border-white/50 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold text-vitora-text/40 uppercase tracking-wide">Weight</span>
                <p className="text-md font-black text-vitora-text mt-0.5">{clinicalData.weightKg} kg</p>
              </div>

              <div className="p-3 bg-white/40 border border-white/50 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold text-vitora-text/40 uppercase tracking-wide">MUAC</span>
                <p className="text-md font-black text-vitora-text mt-0.5">{clinicalData.muacCm} cm</p>
              </div>

              <div className="p-3 bg-white/40 border border-white/50 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold text-vitora-text/40 uppercase tracking-wide">BMI</span>
                <p className="text-md font-black text-vitora-text mt-0.5">{clinicalData.bmi} kg/m²</p>
              </div>

              <div className="p-3 bg-white/40 border border-white/50 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold text-vitora-text/40 uppercase tracking-wide">Weight-for-Height Z</span>
                <p className={`text-md font-black mt-0.5 ${clinicalData.weightForHeightZ < -2.0 ? 'text-red-500' : 'text-vitora-text'}`}>
                  {clinicalData.weightForHeightZ}
                </p>
              </div>

              <div className="p-3 bg-white/40 border border-white/50 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold text-vitora-text/40 uppercase tracking-wide">Height-for-Age Z</span>
                <p className={`text-md font-black mt-0.5 ${clinicalData.heightForAgeZ < -2.0 ? 'text-red-500' : 'text-vitora-text'}`}>
                  {clinicalData.heightForAgeZ}
                </p>
              </div>

            </div>
          </div>

          {/* Morphometric features list */}
          <div className="glass-panel p-6 rounded-glass shadow-md border-white/50 space-y-4">
            <h3 className="text-xs font-black text-vitora-text/50 uppercase tracking-widest border-b border-vitora-text/10 pb-2">
              Extracted Morphometric Facial Features
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 font-semibold text-2xs text-vitora-text/75">
              <div className="flex justify-between py-1.5 border-b border-vitora-text/5">
                <span>Cheek Hollowness Index</span>
                <span className="font-bold text-vitora-text">{facialFeatures.cheek_hollowness.toFixed(3)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-vitora-text/5">
                <span>Temple Depression Score</span>
                <span className="font-bold text-vitora-text">{facialFeatures.temple_depression.toFixed(3)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-vitora-text/5">
                <span>Jaw Prominence Ratio</span>
                <span className="font-bold text-vitora-text">{facialFeatures.jaw_prominence.toFixed(3)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-vitora-text/5">
                <span>Cheekbone Prominence</span>
                <span className="font-bold text-vitora-text">{facialFeatures.cheekbone_prominence.toFixed(3)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-vitora-text/5">
                <span>Temple Width Ratio</span>
                <span className="font-bold text-vitora-text">{facialFeatures.temple_width.toFixed(3)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-vitora-text/5">
                <span>Facial Symmetry Score</span>
                <span className="font-bold text-vitora-text">{(facialFeatures.facial_symmetry * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Action Recommendations */}
          <div className="glass-panel p-6 rounded-glass shadow-md border-white/50 space-y-4">
            <h3 className="text-xs font-black text-vitora-text/50 uppercase tracking-widest border-b border-vitora-text/10 pb-2">
              Clinician Action Plan
            </h3>

            <div className="space-y-4">
              <div className="flex gap-3">
                <Apple className="w-5 h-5 text-vitora-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-2xs font-extrabold text-vitora-text uppercase tracking-wide">Suggested Dietary Adjustments</h4>
                  <p className="text-2xs font-medium text-vitora-text/70 mt-1 leading-relaxed">{recommendations.nutritionalAdvice}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Heart className="w-5 h-5 text-vitora-secondary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-2xs font-extrabold text-vitora-text uppercase tracking-wide">Lifestyle & Caregiver Advice</h4>
                  <p className="text-2xs font-medium text-vitora-text/70 mt-1 leading-relaxed">{recommendations.dietaryGuidelines}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <CornerDownRight className="w-5 h-5 text-vitora-text/50 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-2xs font-extrabold text-vitora-text uppercase tracking-wide">Monitoring & Follow-up Recommendation</h4>
                  <p className="text-2xs font-medium text-vitora-text/70 mt-1 leading-relaxed">{recommendations.followUpInstructions}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Warning disclaimer */}
          <div className="p-4 bg-slate-100/60 border border-slate-200 rounded-2xl text-[10px] text-vitora-text/50 leading-relaxed font-semibold">
            <span className="font-extrabold block mb-1">CLINICAL DISCLAIMER</span>
            This application is an AI-assisted screening tool and is NOT a medical diagnosis. The prediction is intended for early screening only. High-risk cases should always be evaluated by qualified healthcare professionals.
          </div>

        </div>

      </div>

    </div>
  );
};

export default Report;
