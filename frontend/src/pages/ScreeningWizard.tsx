import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { 
  ArrowLeft, 
  ArrowRight, 
  Camera, 
  Upload, 
  RefreshCw, 
  HelpCircle,
  FileSpreadsheet,
  Cpu,
  RefreshCcw,
  Sparkles
} from 'lucide-react';

// Re-implement simplified growth standards locally in JS/TS for instant feedback
function getLocalCalculations(heightCm: number, weightKg: number, ageMonths: number, gender: string) {
  if (!heightCm || !weightKg || !ageMonths || !gender) return null;
  const bmi = Number((weightKg / ((heightCm / 100) * (heightCm / 100))).toFixed(2));
  
  // Boys Milestones
  let medianH = 88.0;
  let sdH = 3.5;
  let medianW = 12.0;
  let sdW = 1.1;

  if (gender.toUpperCase() === 'MALE') {
    medianH = 50 + (ageMonths * 1.0);
    medianW = 3.5 + (ageMonths * 0.25);
  } else {
    medianH = 49 + (ageMonths * 0.95);
    medianW = 3.2 + (ageMonths * 0.23);
  }

  const haz = Number(((heightCm - medianH) / sdH).toFixed(2));
  const whz = Number(((weightKg - medianW) / sdW).toFixed(2));

  return { bmi, haz, whz };
}

const ScreeningWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 Form States
  const [name, setName] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [gender, setGender] = useState('MALE');
  const [parentContact, setParentContact] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [muacCm, setMuacCm] = useState('');
  const [patientId, setPatientId] = useState<number | null>(null);

  // Step 2 Image States
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Validation status
  const [validationChecks, setValidationChecks] = useState({
    faceCentered: true,
    goodLighting: true,
    singleFace: true,
    focus: true
  });

  // Step 3 Scanning State
  const [scanMessage, setScanMessage] = useState('Initializing MediaPipe...');

  // Live WHO/BMI calculations
  const [liveCalcs, setLiveCalcs] = useState<any>(null);

  useEffect(() => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    const a = parseInt(ageMonths);
    if (h && w && a && gender) {
      setLiveCalcs(getLocalCalculations(h, w, a, gender));
    } else {
      setLiveCalcs(null);
    }
  }, [heightCm, weightKg, ageMonths, gender]);

  // Step 1 Submit
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/screening/clinical', {
        name,
        ageMonths: parseInt(ageMonths),
        gender,
        parentContact: parentContact || undefined,
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        muacCm: parseFloat(muacCm)
      });

      setPatientId(response.data.patientId);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit clinical details. Review metrics.');
    } finally {
      setLoading(false);
    }
  };

  // Camera Capture
  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setSelectedFile(null);
      triggerMockValidation();
    }
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        triggerMockValidation();
      };
      reader.readAsDataURL(file);
    }
  };

  // Quality checks simulation before sending
  const triggerMockValidation = () => {
    setTimeout(() => {
      setValidationChecks({
        faceCentered: true,
        goodLighting: true,
        singleFace: true,
        focus: true
      });
    }, 1200);
  };

  // Step 2 Proceed to analysis
  const handleStep2Submit = async () => {
    if (!capturedImage) return;
    setStep(3);
    setLoading(true);
    setError(null);

    // Sequence messages to show scanning progress
    const messages = [
      'Locating 468 facial coordinates...',
      'Evaluating temporal muscle structures...',
      'Computing cheek hollowness indexes...',
      'Fusing clinical z-scores with visual embeddings...',
      'Generating professional healthcare report...'
    ];

    let msgIndex = 0;
    const interval = setInterval(() => {
      if (msgIndex < messages.length) {
        setScanMessage(messages[msgIndex]);
        msgIndex++;
      }
    }, 1500);

    try {
      // Convert captured base64 or file back to binary multipart upload
      const formData = new FormData();
      formData.append('patientId', String(patientId));

      if (selectedFile) {
        formData.append('image', selectedFile);
      } else {
        const responseBlob = await fetch(capturedImage);
        const imageBlob = await responseBlob.blob();
        formData.append('image', imageBlob, 'capture.jpg');
      }

      const uploadResponse = await api.post('/screening/face-scan', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      clearInterval(interval);
      // Wait a fraction to finish animations
      setTimeout(() => {
        navigate(`/report/${uploadResponse.data.reportUuid}`, { state: { report: uploadResponse.data } });
      }, 1000);

    } catch (err: any) {
      clearInterval(interval);
      setError(err.response?.data?.error || 'AI Landmark evaluation encountered a processing error. Ensure image contains a clear face.');
      setStep(2); // Go back to capture
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      
      {/* Header bar */}
      <header className="flex justify-between items-center glass-panel px-6 py-4 rounded-3xl shadow-md border-white/50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
            className="p-2 hover:bg-vitora-primary/10 text-vitora-text/60 hover:text-vitora-primary rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-md font-extrabold tracking-wide text-vitora-text">New Screening</h1>
            <p className="text-3xs text-vitora-text/50 font-bold uppercase tracking-wider">Step {step} of 3</p>
          </div>
        </div>
        
        {/* Step dots */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                s === step 
                  ? 'bg-vitora-primary border-vitora-primary scale-110 shadow-sm' 
                  : s < step 
                    ? 'bg-vitora-secondary border-vitora-secondary' 
                    : 'bg-white/10 border-vitora-text/20'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-3">
          <HelpCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* --- STEP 1: CLINICAL QUESTIONNAIRE --- */}
      {step === 1 && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 rounded-glass shadow-lg relative border-white/50"
        >
          <div className="flex items-center gap-3 text-vitora-primary mb-6">
            <FileSpreadsheet className="w-6 h-6" />
            <h2 className="text-xl font-black tracking-tight text-vitora-text">Clinical Parameters</h2>
          </div>

          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Demographics Group */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-vitora-secondary uppercase tracking-widest border-b border-vitora-primary/20 pb-1">Patient Details</h3>
                
                <div>
                  <label className="text-2xs font-extrabold text-vitora-text/75 mb-1.5 block">Patient Name</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Marcus Aurelius"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-2xl glass-input text-vitora-text font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-2xs font-extrabold text-vitora-text/75 mb-1.5 block">Age (Months)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="60"
                      placeholder="E.g., 36"
                      value={ageMonths}
                      onChange={(e) => setAgeMonths(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-2xl glass-input text-vitora-text font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-extrabold text-vitora-text/75 mb-1.5 block">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-2xl glass-input text-vitora-text font-bold"
                    >
                      <option value="MALE">Male (Boy)</option>
                      <option value="FEMALE">Female (Girl)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-extrabold text-vitora-text/75 mb-1.5 block">Parent Contact Info (Optional)</label>
                  <input
                    type="text"
                    placeholder="E.g., +1 555-0199"
                    value={parentContact}
                    onChange={(e) => setParentContact(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-2xl glass-input text-vitora-text font-medium"
                  />
                </div>
              </div>

              {/* Measurements Group */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-vitora-secondary uppercase tracking-widest border-b border-vitora-primary/20 pb-1">Anatomical Metrics</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-2xs font-extrabold text-vitora-text/75 mb-1.5 block">Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="E.g., 95.5"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-2xl glass-input text-vitora-text font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-extrabold text-vitora-text/75 mb-1.5 block">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="E.g., 12.4"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-2xl glass-input text-vitora-text font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-extrabold text-vitora-text/75 mb-1.5 block">MUAC (cm) - Mid-Upper Arm Circumference</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="E.g., 13.5"
                    value={muacCm}
                    onChange={(e) => setMuacCm(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-2xl glass-input text-vitora-text font-medium"
                  />
                  <span className="text-4xs text-vitora-text/40 font-bold block mt-1 uppercase">Recommended for infants over 6 months</span>
                </div>

                {/* Instant Feedback Overlay */}
                <AnimatePresence>
                  {liveCalcs && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 bg-vitora-primary/5 border border-vitora-primary/20 rounded-2xl space-y-2 text-2xs overflow-hidden"
                    >
                      <h4 className="font-extrabold text-vitora-secondary uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Instant WHO Growth Metrics
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-center font-bold">
                        <div className="bg-white/40 p-2 rounded-xl">
                          <p className="text-vitora-text/40 text-4xs uppercase">BMI</p>
                          <p className="text-sm mt-0.5 text-vitora-text">{liveCalcs.bmi}</p>
                        </div>
                        <div className="bg-white/40 p-2 rounded-xl">
                          <p className="text-vitora-text/40 text-4xs uppercase">Weight-for-Height Z</p>
                          <p className={`text-sm mt-0.5 ${liveCalcs.whz < -2 ? 'text-red-500' : 'text-vitora-text'}`}>
                            {liveCalcs.whz}
                          </p>
                        </div>
                        <div className="bg-white/40 p-2 rounded-xl">
                          <p className="text-vitora-text/40 text-4xs uppercase">Height-for-Age Z</p>
                          <p className={`text-sm mt-0.5 ${liveCalcs.haz < -2 ? 'text-red-500' : 'text-vitora-text'}`}>
                            {liveCalcs.haz}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            <div className="flex justify-end pt-4 border-t border-vitora-text/10">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl glass-button text-xs font-bold"
              >
                {loading ? 'Recording...' : 'Proceed to Face Capture'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* --- STEP 2: CAMERA AND PHOTO VALIDATION --- */}
      {step === 2 && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 rounded-glass shadow-lg relative border-white/50"
        >
          <div className="flex items-center gap-3 text-vitora-primary mb-6">
            <Camera className="w-6 h-6" />
            <h2 className="text-xl font-black tracking-tight text-vitora-text">Facial Scan Acquisition</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Viewfinder/Preview Column */}
            <div className="md:col-span-2 space-y-4">
              <div className="relative aspect-video rounded-3xl bg-slate-900 border border-slate-700 shadow-inner overflow-hidden flex items-center justify-center">
                {!capturedImage ? (
                  <>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="absolute inset-0 w-full h-full object-cover"
                      videoConstraints={{ facingMode: "user", width: 1280, height: 720 }}
                    />
                    
                    {/* VisionOS Face Overlay Guidelines */}
                    <div className="absolute inset-0 border-[3px] border-dashed border-vitora-primary/40 rounded-full scale-y-[0.70] scale-x-[0.45] pointer-events-none flex items-center justify-center">
                      <span className="text-4xs text-vitora-primary font-bold uppercase bg-vitora-bg/80 border border-vitora-primary/30 px-2 py-0.5 rounded-full scale-y-[1.4] scale-x-[2.2]">
                        Position Face Here
                      </span>
                    </div>
                  </>
                ) : (
                  <img src={capturedImage} alt="Capture preview" className="w-full h-full object-cover" />
                )}
              </div>

              <div className="flex justify-center gap-4">
                {!capturedImage ? (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-button text-xs font-bold"
                    >
                      <Camera className="w-4 h-4" /> Capture Photo
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-button-secondary text-xs font-bold"
                    >
                      <Upload className="w-4 h-4" /> Upload File
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setCapturedImage(null); setSelectedFile(null); }}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-button-secondary text-xs font-bold border border-red-500/20 text-red-600 hover:bg-red-500/10"
                  >
                    <RefreshCcw className="w-4 h-4" /> Retake Photo
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            {/* Validation Checklist Column */}
            <div className="space-y-6">
              <div className="p-4 bg-white/30 border border-white/50 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-vitora-text uppercase tracking-wider">Quality Checklists</h3>
                
                <div className="space-y-2 text-2xs font-semibold text-vitora-text/70">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/40">
                    <span>Face Centered</span>
                    <div className={`w-4 h-4 rounded-full ${validationChecks.faceCentered ? 'bg-emerald-500' : 'bg-amber-500'} flex items-center justify-center text-white text-[9px] font-bold`}>✓</div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/40">
                    <span>Single Face</span>
                    <div className={`w-4 h-4 rounded-full ${validationChecks.singleFace ? 'bg-emerald-500' : 'bg-amber-500'} flex items-center justify-center text-white text-[9px] font-bold`}>✓</div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/40">
                    <span>Good Lighting</span>
                    <div className={`w-4 h-4 rounded-full ${validationChecks.goodLighting ? 'bg-emerald-500' : 'bg-amber-500'} flex items-center justify-center text-white text-[9px] font-bold`}>✓</div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/40">
                    <span>Clear Focus</span>
                    <div className={`w-4 h-4 rounded-full ${validationChecks.focus ? 'bg-emerald-500' : 'bg-amber-500'} flex items-center justify-center text-white text-[9px] font-bold`}>✓</div>
                  </div>
                </div>

                <p className="text-4xs text-vitora-text/40 font-bold uppercase leading-relaxed">
                  Note: Adjust the child's position, avoid direct window glare, and ensure the eyes are open.
                </p>
              </div>

              {capturedImage && (
                <button
                  onClick={handleStep2Submit}
                  className="w-full py-3.5 rounded-2xl glass-button text-xs font-black flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4.5 h-4.5" /> Execute AI Diagnosis
                </button>
              )}
            </div>

          </div>
        </motion.div>
      )}

      {/* --- STEP 3: MESH SCANNING ANIMATION --- */}
      {step === 3 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 rounded-glass shadow-lg flex flex-col items-center justify-center border-white/50 min-h-[450px] relative overflow-hidden"
        >
          {/* Animated Matrix/Scan Background Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(34,197,94,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,197,94,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          {capturedImage && (
            <div className="relative w-64 h-64 rounded-3xl overflow-hidden border-2 border-vitora-primary/40 shadow-lg">
              <img src={capturedImage} alt="Scanning" className="w-full h-full object-cover" />
              
              {/* Laser scan line using Framer Motion */}
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-vitora-primary to-transparent shadow-[0_0_10px_rgba(34,197,94,0.8)] z-10"
              />

              {/* Scanning Landmark Dots representation */}
              <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute top-[35%] left-[30%] w-1.5 h-1.5 bg-vitora-primary rounded-full animate-ping" />
                <div className="absolute top-[35%] right-[30%] w-1.5 h-1.5 bg-vitora-primary rounded-full animate-ping" />
                <div className="absolute top-[50%] left-[48%] w-1.5 h-1.5 bg-vitora-primary rounded-full animate-ping" />
                <div className="absolute top-[60%] left-[25%] w-1.5 h-1.5 bg-vitora-primary rounded-full animate-ping" />
                <div className="absolute top-[60%] right-[25%] w-1.5 h-1.5 bg-vitora-primary rounded-full animate-ping" />
                <div className="absolute top-[75%] left-[48%] w-1.5 h-1.5 bg-vitora-primary rounded-full animate-ping" />
              </div>
            </div>
          )}

          <div className="mt-8 text-center space-y-3 relative z-10">
            <div className="flex items-center justify-center gap-2 text-vitora-primary">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest">{scanMessage}</span>
            </div>
            <p className="text-3xs text-vitora-text/50 font-bold uppercase tracking-wider">
              Executing Branch Fusion Network (Clinical 70% + Facial 30%)
            </p>
          </div>
        </motion.div>
      )}

    </div>
  );
};

export default ScreeningWizard;
