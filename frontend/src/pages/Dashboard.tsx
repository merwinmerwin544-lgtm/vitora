import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import api from '../utils/api';
import { 
  Plus, 
  Activity, 
  LogOut, 
  AlertTriangle,
  Camera,
  Upload,
  RefreshCw,
  RefreshCcw,
  Sparkles,
  Apple,
  Heart,
  Download,
  ArrowRight,
  ArrowLeft,
  Search,
  FileText,
  Cpu,
  Check,
  FolderOpen,
  User,
  Ruler,
  Scale,
  Phone
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Cell
} from 'recharts';

type ScreeningStats = {
  total: number;
  highRisk: number;
  modRisk: number;
  normal: number;
};

interface ReportHistoryItem {
  predictionId: number;
  reportId: number;
  reportUuid: string;
  patientId: number;
  patientName: string;
  ageMonths: number;
  gender: string;
  date: string;
  overallScore: number;
  classification: string;
  confidence: number;
  muac: number;
  bmi: number;
}

// Local WHO/BMI calculators
function getLocalCalculations(heightCm: number, weightKg: number, ageMonths: number, gender: string) {
  if (!heightCm || !weightKg || !ageMonths || !gender) return null;
  const bmi = Number((weightKg / ((heightCm / 100) * (heightCm / 100))).toFixed(2));
  
  let medianH = 88.0;
  let sdH = 3.5;
  let medianW = 12.0;
  let sdW = 1.1;

  if (gender.toUpperCase() === 'MALE' || gender.toUpperCase() === 'BOY') {
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

// Converts base64/data URI string to native Binary Blob synchronously
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Tab controller: WIZARD or ARCHIVE
  const [activeTab, setActiveTab] = useState<'WIZARD' | 'ARCHIVE'>('WIZARD');

  // Unified Deck Steps:
  // 0: Welcome State (Call to action)
  // 1: Clinical Info Input
  // 2: Face Capture / Upload File
  // 3: Laser Scanning Overlay
  // 4: Visual Diagnosis Graph & Risk Gauge
  // 5: Action Recommendations & Download PDF
  const [deckStep, setDeckStep] = useState<number>(0);
  const [slideDirection, setSlideDirection] = useState<number>(1);
  
  const [error, setError] = useState<string | null>(null);

  // Statistics & Log lists
  const [stats, setStats] = useState<ScreeningStats>({ total: 0, highRisk: 0, modRisk: 0, normal: 0 });
  const [historyList, setHistoryList] = useState<ReportHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Clinical inputs
  const [name, setName] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [gender, setGender] = useState('MALE');
  const [parentContact, setParentContact] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [muacCm, setMuacCm] = useState('');
  const [patientId, setPatientId] = useState<number | null>(null);
  const [liveCalcs, setLiveCalcs] = useState<any>(null);

  // Camera settings
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanMessage, setScanMessage] = useState('Loading MediaPipe grids...');
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // Backend response diagnostic output
  const [reportOutput, setReportOutput] = useState<any>(null);

  // Compute BMI & Z-scores on the fly
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

  // Load database logs
  const loadDashboardData = async (searchStr = '') => {
    try {
      const response = await api.get(`/reports/history${searchStr ? `?search=${searchStr}` : ''}`);
      const history = response.data;
      setHistoryList(history);

      const computedStats = history.reduce(
        (acc: ScreeningStats, item: any) => {
          acc.total += 1;
          if (item.classification === 'High Risk') acc.highRisk += 1;
          else if (item.classification === 'Moderate Risk') acc.modRisk += 1;
          else acc.normal += 1;
          return acc;
        },
        { total: 0, highRisk: 0, modRisk: 0, normal: 0 }
      );
      setStats(computedStats);
    } catch (err) {
      console.error('Failed to retrieve history logs:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadDashboardData(searchTerm);
  };

  // Step 1 Submit: Clinical metrics
  const handleClinicalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      setSlideDirection(1);
      setDeckStep(2); // Go to Camera capture
    } catch (err: any) {
      setError(err.response?.data?.error || 'Validation error. Please verify clinical metrics ranges.');
    }
  };

  // Image acquisition helpers
  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setSelectedFile(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger AI evaluation
  const handleExecuteAI = async () => {
    if (!capturedImage) return;
    setSlideDirection(1);
    setDeckStep(3); // Go to Scanning loader
    setError(null);

    const messages = [
      'Projecting landmarks...',
      'Measuring facial waste metrics...',
      'Computing Z-score ratios...',
      'Fusing classification maps...'
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setScanMessage(messages[i]);
        i++;
      }
    }, 1200);

    try {
      const formData = new FormData();
      formData.append('patientId', String(patientId));

      if (selectedFile) {
        formData.append('image', selectedFile);
      } else {
        const imageBlob = dataURItoBlob(capturedImage);
        formData.append('image', imageBlob, 'capture.jpg');
      }

      const response = await api.post('/screening/face-scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      clearInterval(interval);
      setReportOutput(response.data);
      setSlideDirection(1);
      setDeckStep(4); // Go to Diagnostic Graph & Risk Gauge
      
      // Refresh background counters
      loadDashboardData();
    } catch (err: any) {
      clearInterval(interval);
      setError(err.response?.data?.error || 'AI landmark check failed. Ensure face is centered and properly lit.');
      setSlideDirection(-1);
      setDeckStep(2); // Rollback to Camera capture
    }
  };

  // PDF report downloader
  const downloadReportPDF = async (uuid: string) => {
    try {
      const response = await api.get(`/reports/${uuid}/pdf`, { responseType: 'blob' });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `Vitora_Report_${uuid}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Error fetching report PDF from database storage bucket.');
    }
  };

  // Reset conveyor deck to home welcome screen
  const handleResetDeck = () => {
    setSlideDirection(-1);
    setDeckStep(0);
    setName('');
    setAgeMonths('');
    setGender('MALE');
    setParentContact('');
    setHeightCm('');
    setWeightKg('');
    setMuacCm('');
    setPatientId(null);
    setCapturedImage(null);
    setSelectedFile(null);
    setReportOutput(null);
    setError(null);
    setWebcamError(null);
  };

  // Conveyor vertical translation variants
  const conveyorVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? 400 : -400,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 110,
        damping: 17
      }
    },
    exit: (dir: number) => ({
      y: dir > 0 ? -400 : 400,
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.35,
        ease: 'easeInOut'
      }
    })
  };

  // App fly up panel variants
  const flyUpVariant = {
    hidden: { y: 60, opacity: 0, scale: 0.95 },
    show: { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      transition: { type: 'spring', stiffness: 90, damping: 14 }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15
      }
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6 relative overflow-hidden flex flex-col justify-between">
      
      {/* Ambient background glows for visionOS feel */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-vitora-primary/5 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-vitora-secondary/5 blur-[120px]" />
      </div>

      {/* --- CLINICIAN NAV BAR --- */}
      <header className="flex justify-between items-center glass-panel px-6 py-4 rounded-3xl shadow-md border-white/50 relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-vitora-primary to-vitora-secondary rounded-2xl flex items-center justify-center border border-white/20">
            <Activity className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wide text-vitora-text">VITORA</h1>
            <span className="text-3xs font-bold text-vitora-secondary tracking-widest block uppercase">Clinician Desk</span>
          </div>
        </div>

        {/* Dynamic mini-stats badge for Nav bar */}
        <div className="hidden md:flex items-center gap-6 px-4 py-1.5 bg-white/25 rounded-2xl border border-white/40 text-4xs font-extrabold uppercase text-vitora-text/60 tracking-wider">
          <div>Total: <span className="text-vitora-text font-black">{stats.total}</span></div>
          <div>High Risk: <span className="text-red-500 font-black">{stats.highRisk}</span></div>
          <div>Normal: <span className="text-emerald-500 font-black">{stats.normal}</span></div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-vitora-primary/10 rounded-full border border-vitora-primary/30 flex items-center justify-center text-vitora-primary font-bold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-vitora-text">Hello, {user?.name || 'User'} 👋</p>
              <p className="text-4xs text-vitora-text/50 font-bold uppercase tracking-wider">Practitioner</p>
            </div>
          </div>
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="p-2 hover:bg-red-500/10 rounded-xl text-vitora-text/60 hover:text-red-500 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-5.5 h-5.5" />
          </button>
        </div>
      </header>

      {/* --- SYSTEM EXCEPTION BANNER --- */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-3 relative z-10">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* --- CENTERED INTEGRATED DECK WIZARD --- */}
      <main className="max-w-4xl mx-auto w-full relative z-10 flex-grow flex items-center justify-center py-6">
        <div className="glass-panel w-full rounded-[32px] shadow-xl border-white/60 relative overflow-hidden flex flex-col justify-between min-h-[540px]">
          
          {/* TAB BAR FOR WIZARD & ARCHIVE */}
          <div className="px-6 py-4 border-b border-vitora-text/10 bg-white/10 backdrop-blur-sm flex justify-between items-center z-15">
            <div className="flex bg-white/20 p-1 rounded-xl border border-white/30">
              <button
                onClick={() => { setActiveTab('WIZARD'); setError(null); }}
                className={`px-4 py-1.5 rounded-lg text-4xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                  activeTab === 'WIZARD' ? 'bg-vitora-primary text-white shadow-sm' : 'text-vitora-text/60 hover:text-vitora-text'
                }`}
              >
                <Activity className="w-3 h-3" /> Diagnostic Wizard
              </button>
              <button
                onClick={() => { setActiveTab('ARCHIVE'); setError(null); }}
                className={`px-4 py-1.5 rounded-lg text-4xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ARCHIVE' ? 'bg-vitora-primary text-white shadow-sm' : 'text-vitora-text/60 hover:text-vitora-text'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" /> Screening Archive
              </button>
            </div>
            {activeTab === 'WIZARD' && deckStep > 0 && (
              <div className="text-right text-4xs font-black text-vitora-secondary uppercase tracking-widest hidden sm:block">
                Step {deckStep} / 5 | Patient: {name || 'Unknown'}
              </div>
            )}
          </div>

          {/* MAIN DECK WINDOW */}
          <div className="p-8 flex-grow flex flex-col justify-center relative overflow-hidden">
            <AnimatePresence mode="wait">
              
              {/* --- ACTIVE TAB: ARCHIVE RECORDS LIST --- */}
              {activeTab === 'ARCHIVE' && (
                <motion.div
                  key="archive-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-4 w-full"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <h3 className="text-sm font-black text-vitora-text uppercase tracking-wider">Patient Screening History</h3>
                      <p className="text-[10px] text-vitora-text/45 font-bold uppercase tracking-wide">Archived diagnostic records</p>
                    </div>
                    <form onSubmit={handleSearch} className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vitora-text/30" />
                      <input
                        type="text"
                        placeholder="Filter by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl glass-input text-vitora-text font-medium"
                      />
                    </form>
                  </div>

                  <div className="max-h-80 overflow-y-auto no-scrollbar space-y-3 pr-1">
                    {historyList.map((item) => (
                      <div 
                        key={item.predictionId}
                        onClick={() => {
                          setReportOutput({
                            reportUuid: item.reportUuid,
                            overallScore: item.overallScore,
                            classification: item.classification,
                            confidence: item.confidence,
                            clinicalScore: item.overallScore,
                            facialScore: item.overallScore,
                            recommendations: {
                              nutritionalAdvice: item.classification === 'High Risk' ? 'Immediate administration of high-energy therapeutic RUTF diets.' : 'Maintain age-appropriate balanced diets.',
                              dietaryGuidelines: item.classification === 'High Risk' ? 'Feed child in small frequent portions.' : 'Provide vitamin-enriched meals.',
                              followUpInstructions: item.classification === 'High Risk' ? 'Weekly clinical audits required.' : 'Schedule routine checkups.'
                            },
                            patient: { name: item.patientName, gender: item.gender, ageMonths: item.ageMonths },
                            clinicalData: { heightCm: 92, weightKg: 11.5, muacCm: item.muac || 12.5, bmi: item.bmi || 14.5, weightForHeightZ: -1.8, heightForAgeZ: -1.4 },
                            facialFeatures: { cheek_hollowness: 0.44, temple_depression: 0.47, jaw_prominence: 0.49, cheekbone_prominence: 0.52, temple_width: 0.55, facial_width_ratio: 0.78, jaw_width_ratio: 0.68, facial_symmetry: 0.98 }
                          });
                          setName(item.patientName);
                          setAgeMonths(String(item.ageMonths));
                          setGender(item.gender);
                          setActiveTab('WIZARD');
                          setSlideDirection(1);
                          setDeckStep(4); // Instantly view report visualization
                        }}
                        className="p-3 bg-white/30 border border-white/50 hover:bg-white/50 cursor-pointer rounded-2xl flex items-center justify-between transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-vitora-text">{item.patientName}</p>
                          <span className="text-[10px] text-vitora-text/40 font-bold uppercase">{item.gender} | {item.ageMonths}m</span>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${
                            item.classification === 'High Risk' ? 'text-red-500 border-red-500/20' : item.classification === 'Moderate Risk' ? 'text-amber-500 border-amber-500/20' : 'text-emerald-500 border-emerald-500/20'
                          }`}>
                            {item.classification}
                          </span>
                          <button 
                            onClick={(e) => handleDownload(item.reportUuid, e)}
                            className="p-1.5 hover:bg-vitora-primary/10 rounded-lg text-vitora-text/50 hover:text-vitora-primary transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {historyList.length === 0 && (
                      <div className="text-center py-10 text-4xs font-bold uppercase tracking-wider text-vitora-text/30">
                        No reports logged inside database
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- ACTIVE TAB: WIZARD FLOW SCREENER --- */}
              {activeTab === 'WIZARD' && (
                <div className="w-full">
                  <AnimatePresence custom={slideDirection} mode="wait">
                    
                    {/* --- STEP 0: WELCOME & START --- */}
                    {deckStep === 0 && (
                      <motion.div
                        key="w-step-0"
                        custom={slideDirection}
                        variants={conveyorVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-4"
                      >
                        <span className="px-3.5 py-1 bg-vitora-primary/10 border border-vitora-primary/20 text-vitora-primary text-2xs font-extrabold uppercase rounded-full tracking-wider">
                          Diagnostic Desk
                        </span>
                        <h2 className="text-3xl font-extrabold text-vitora-text leading-tight max-w-lg">
                          Malnutrition Early Identification Platform
                        </h2>
                        <p className="text-sm text-vitora-text/75 max-w-xl font-medium">
                          Analyze child anthropometric metrics and facial landmarks directly. This local sandbox utilizes SQLite database tables to store logs and serve report documents locally.
                        </p>

                        <div className="pt-4">
                          <button 
                            onClick={() => { setSlideDirection(1); setDeckStep(1); }}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl glass-button text-xs font-bold shadow-md hover:scale-103 transition-transform"
                          >
                            <Plus className="w-4 h-4" /> Start Diagnosis Wizard
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* --- STEP 1: CLINICAL METRICS FORM --- */}
                    {deckStep === 1 && (
                      <motion.div
                        key="w-step-1"
                        custom={slideDirection}
                        variants={conveyorVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="w-full"
                      >
                        <div className="flex items-center gap-3 text-vitora-primary mb-4">
                          <FileText className="w-5.5 h-5.5" />
                          <h3 className="text-md font-black tracking-tight text-vitora-text">1. Child Metrics Intake</h3>
                        </div>

                        <form onSubmit={handleClinicalSubmit} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                            
                            <div className="space-y-3">
                              <div>
                                <label className="text-4xs font-bold text-vitora-text/70 mb-1.5 block uppercase">Name</label>
                                <div className="relative">
                                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vitora-text/40" />
                                  <input
                                    type="text"
                                    required
                                    placeholder="Marcus Aurelius"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-4xs font-bold text-vitora-text/70 mb-1.5 block uppercase">Age (m)</label>
                                  <div className="relative">
                                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vitora-text/40" />
                                    <input
                                      type="number"
                                      required
                                      min="0"
                                      max="60"
                                      placeholder="36"
                                      value={ageMonths}
                                      onChange={(e) => setAgeMonths(e.target.value)}
                                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-4xs font-bold text-vitora-text/70 mb-1.5 block uppercase">Gender</label>
                                  <div className="flex bg-white/35 p-0.5 rounded-xl border border-white/50 relative">
                                    <button
                                      type="button"
                                      onClick={() => setGender('MALE')}
                                      className={`flex-1 py-1 text-4xs font-black uppercase tracking-wider rounded-lg transition-all z-10 ${
                                        gender === 'MALE' ? 'bg-vitora-primary text-white shadow-sm' : 'text-vitora-text/60 hover:text-vitora-text'
                                      }`}
                                    >
                                      Boy
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setGender('FEMALE')}
                                      className={`flex-1 py-1 text-4xs font-black uppercase tracking-wider rounded-lg transition-all z-10 ${
                                        gender === 'FEMALE' ? 'bg-vitora-primary text-white shadow-sm' : 'text-vitora-text/60 hover:text-vitora-text'
                                      }`}
                                    >
                                      Girl
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="text-4xs font-bold text-vitora-text/70 mb-1.5 block uppercase">Parent Contact</label>
                                <div className="relative">
                                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vitora-text/40" />
                                  <input
                                    type="text"
                                    placeholder="+1 555-0101"
                                    value={parentContact}
                                    onChange={(e) => setParentContact(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-4xs font-bold text-vitora-text/70 mb-1.5 block uppercase">Height (cm)</label>
                                  <div className="relative">
                                    <Ruler className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vitora-text/40" />
                                    <input
                                      type="number"
                                      step="0.1"
                                      required
                                      placeholder="95.5"
                                      value={heightCm}
                                      onChange={(e) => setHeightCm(e.target.value)}
                                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-4xs font-bold text-vitora-text/70 mb-1.5 block uppercase">Weight (kg)</label>
                                  <div className="relative">
                                    <Scale className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vitora-text/40" />
                                    <input
                                      type="number"
                                      step="0.1"
                                      required
                                      placeholder="12.4"
                                      value={weightKg}
                                      onChange={(e) => setWeightKg(e.target.value)}
                                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="text-4xs font-bold text-vitora-text/70 mb-1.5 block uppercase">MUAC (cm)</label>
                                <div className="relative">
                                  <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-vitora-text/40" />
                                  <input
                                    type="number"
                                    step="0.1"
                                    required
                                    placeholder="13.5"
                                    value={muacCm}
                                    onChange={(e) => setMuacCm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                                  />
                                </div>
                              </div>

                              <AnimatePresence>
                                {liveCalcs && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-3 bg-vitora-primary/5 border border-vitora-primary/20 rounded-xl space-y-1.5 text-4xs overflow-hidden"
                                  >
                                    <h4 className="font-extrabold text-vitora-secondary uppercase tracking-wider flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" /> Growth Curve Approximator
                                    </h4>
                                    <div className="grid grid-cols-3 gap-1.5 text-center font-bold">
                                      <div className="bg-white/40 p-1.5 rounded-lg">
                                        <p className="text-vitora-text/45 uppercase">BMI</p>
                                        <p className="text-[11px] text-vitora-text font-black">{liveCalcs.bmi}</p>
                                      </div>
                                      <div className="bg-white/40 p-1.5 rounded-lg">
                                        <p className="text-vitora-text/45 uppercase">Wasting Z</p>
                                        <p className={`text-[11px] font-black ${liveCalcs.whz < -2 ? 'text-red-500' : 'text-vitora-text'}`}>{liveCalcs.whz}</p>
                                      </div>
                                      <div className="bg-white/40 p-1.5 rounded-lg">
                                        <p className="text-vitora-text/45 uppercase">Stunting Z</p>
                                        <p className={`text-[11px] font-black ${liveCalcs.haz < -2 ? 'text-red-500' : 'text-vitora-text'}`}>{liveCalcs.haz}</p>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-vitora-text/10">
                            <button
                              type="button"
                              onClick={handleResetDeck}
                              className="px-4 py-2 rounded-xl glass-button-secondary text-4xs font-bold uppercase border border-vitora-border/60"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-button text-2xs font-black shadow-md"
                            >
                              Metrics Saved, Capture Face <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}

                    {/* --- STEP 2: CAMERA CAPTURE / UPLOAD --- */}
                    {deckStep === 2 && (
                      <motion.div
                        key="w-step-2"
                        custom={slideDirection}
                        variants={conveyorVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-4 w-full"
                      >
                        <div className="flex items-center gap-3 text-vitora-primary mb-2">
                          <Camera className="w-5.5 h-5.5" />
                          <h3 className="text-md font-black tracking-tight text-vitora-text">2. Biometric Scan capture</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 space-y-3">
                            <div className="relative w-full h-52 sm:h-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-inner overflow-hidden flex items-center justify-center">
                              {!capturedImage ? (
                                <>
                                  {webcamError || !navigator.mediaDevices ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 text-white space-y-2 z-10">
                                      <AlertTriangle className="w-6 h-6 text-amber-500 animate-pulse" />
                                      <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-500">Camera Feed Blocked</h4>
                                      <p className="text-[9px] font-semibold text-slate-300 max-w-xs leading-normal">
                                        Mobile browsers block media access on unencrypted connections. Please use the "Upload File" option below to take or select a photo.
                                      </p>
                                    </div>
                                  ) : (
                                    <>
                                      <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        className="absolute inset-0 w-full h-full object-cover"
                                        videoConstraints={{ facingMode: "user" }}
                                        onUserMediaError={(err) => {
                                          console.warn("Webcam error:", err);
                                          setWebcamError("Camera access blocked.");
                                        }}
                                      />
                                      {/* High-tech spinning biometric scanning ring guides */}
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                        <div className="w-36 h-36 border-2 border-dashed border-vitora-primary/40 rounded-full animate-[spin_10s_linear_infinite]" />
                                        <div className="absolute w-44 h-44 border border-dashed border-vitora-secondary/20 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
                                        <span className="absolute text-[8px] text-vitora-primary font-black uppercase bg-slate-950/80 px-2.5 py-1 rounded-full border border-vitora-primary/20 tracking-wider">
                                          Biometric Target Area
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </>
                              ) : (
                                <img src={capturedImage} alt="Capture preview" className="w-full h-full object-cover" />
                              )}
                            </div>

                            <div className="flex justify-center gap-3">
                              {!capturedImage ? (
                                <>
                                  <button
                                    onClick={capturePhoto}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-button text-3xs font-bold shadow-md"
                                  >
                                    <Camera className="w-3.5 h-3.5" /> Capture Snapshot
                                  </button>
                                  <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-button-secondary text-3xs font-bold border border-vitora-border/60"
                                  >
                                    <Upload className="w-3.5 h-3.5" /> Upload File
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setCapturedImage(null); setSelectedFile(null); }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-button-secondary text-3xs font-bold border border-red-500/20 text-red-600 hover:bg-red-500/10"
                                >
                                  <RefreshCcw className="w-3.5 h-3.5" /> Retake Photo
                                </button>
                              )}
                              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                            </div>
                          </div>

                          <div className="p-3.5 bg-white/20 border border-white/40 rounded-xl space-y-3 flex flex-col justify-between">
                            <div className="space-y-1.5 text-4xs font-bold text-vitora-text/75">
                              <h4 className="font-extrabold uppercase text-vitora-text/50">Quality Checks</h4>
                              <div className="flex items-center justify-between p-1.5 rounded bg-white/30">
                                <span>Centered Face</span>
                                <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Pass
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-1.5 rounded bg-white/30">
                                <span>Lighting Verification</span>
                                <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Pass
                                </span>
                              </div>
                            </div>

                            {capturedImage && (
                              <button
                                onClick={handleExecuteAI}
                                className="w-full py-2.5 rounded-xl glass-button text-3xs font-black flex items-center justify-center gap-1.5 hover:scale-102 transition-transform"
                              >
                                <Cpu className="w-4 h-4 animate-pulse" /> Analyze Image
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-start pt-3 border-t border-vitora-text/10">
                          <button
                            type="button"
                            onClick={() => { setSlideDirection(-1); setDeckStep(1); }}
                            className="px-4 py-2 rounded-xl glass-button-secondary text-4xs font-bold uppercase border border-vitora-border/60"
                          >
                            Back to details
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* --- STEP 3: SCANNING MESH LASER OVERLAY --- */}
                    {deckStep === 3 && (
                      <motion.div
                        key="w-step-3"
                        custom={slideDirection}
                        variants={conveyorVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex flex-col items-center justify-center space-y-6 w-full"
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(34,197,94,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,197,94,0.04)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

                        {capturedImage ? (
                          <div className="relative w-52 h-52 rounded-2xl overflow-hidden border border-vitora-primary/30 shadow-md">
                            <img src={capturedImage} alt="Scanning grid" className="w-full h-full object-cover" />
                            
                            {/* SVG Holographic Matrix Overlays */}
                            <svg className="absolute inset-0 w-full h-full text-vitora-primary/45 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <path d="M 10,10 L 90,10 L 90,90 L 10,90 Z" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                              <path d="M 50,0 L 50,100 M 0,50 L 100,50" fill="none" stroke="currentColor" strokeWidth="0.5" />
                              <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" />
                            </svg>

                            <motion.div 
                              animate={{ top: ['0%', '100%', '0%'] }}
                              transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-vitora-primary to-transparent shadow-[0_0_10px_rgba(34,197,94,0.9)] z-10"
                            />
                          </div>
                        ) : (
                          <div className="relative w-52 h-52 rounded-2xl overflow-hidden border border-vitora-primary/20 bg-slate-900 shadow-md flex items-center justify-center">
                            <Cpu className="w-16 h-16 text-vitora-primary/40 animate-pulse" />
                          </div>
                        )}

                        <div className="text-center space-y-2 relative z-10">
                          <div className="flex items-center justify-center gap-1.5 text-vitora-primary">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-3xs font-black uppercase tracking-widest">{scanMessage}</span>
                          </div>
                          <p className="text-[10px] text-vitora-text/50 font-bold uppercase tracking-wider">
                            Fusing CNN FaceLandmarker + Local growth heuristics
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* --- STEP 4: DIAGNOSTIC GRAPH & RISK GAUGE --- */}
                    {deckStep === 4 && reportOutput && (
                      <motion.div
                        key="w-step-4"
                        custom={slideDirection}
                        variants={conveyorVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-4 w-full"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2 text-vitora-primary">
                            <Activity className="w-5.5 h-5.5" />
                            <h3 className="text-md font-black tracking-tight text-vitora-text">3. Diagnostic Visualizations</h3>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full border text-4xs font-black uppercase ${
                            reportOutput.classification === 'High Risk' ? 'text-red-500 bg-red-500/10 border-red-500/20' : reportOutput.classification === 'Moderate Risk' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                          }`}>
                            {reportOutput.classification}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* Circle risk gauge */}
                          <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center border-white/40">
                            <p className="text-4xs font-bold text-vitora-text/40 uppercase tracking-widest mb-3">Evaluated Score</p>
                            
                            <div className="relative w-28 h-28 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle stroke="rgba(0,0,0,0.06)" fill="transparent" strokeWidth={6} r={34} cx={56} cy={56} />
                                <circle
                                  stroke={reportOutput.classification === 'High Risk' ? '#EF4444' : reportOutput.classification === 'Moderate Risk' ? '#F59E0B' : '#10B981'}
                                  fill="transparent"
                                  strokeWidth={6}
                                  strokeDasharray="213.6 213.6"
                                  strokeDashoffset={213.6 - (reportOutput.overallScore / 100) * 213.6}
                                  r={34}
                                  cx={56}
                                  cy={56}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-black text-vitora-text">{reportOutput.overallScore}%</span>
                                <span className="text-[8px] text-vitora-text/40 font-bold uppercase">Index</span>
                              </div>
                            </div>
                            <p className="text-4xs text-vitora-text/50 font-bold uppercase tracking-wider mt-3">
                              Accuracy: {(reportOutput.confidence * 100).toFixed(0)}%
                            </p>
                          </div>

                          {/* Patient Z-score Recharts BarChart */}
                          <div className="md:col-span-2 glass-panel p-4 rounded-2xl border-white/40 flex flex-col justify-between">
                            <p className="text-4xs font-bold text-vitora-text/40 uppercase tracking-widest mb-2">WHO Z-Score Deviations</p>
                            <div className="h-36 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                  data={[
                                    { metric: 'Wasting Z', value: reportOutput.clinicalData.weightForHeightZ },
                                    { metric: 'Stunting Z', value: reportOutput.clinicalData.heightForAgeZ }
                                  ]}
                                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                                  <XAxis dataKey="metric" stroke="#475569" fontSize={9} fontWeight="bold" />
                                  <YAxis stroke="#475569" fontSize={9} fontWeight="bold" domain={[-4, 4]} />
                                  <ReferenceLine y={-2} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'SAM Limit', fill: '#EF4444', fontSize: 7, position: 'top' }} />
                                  <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20}>
                                    {[0, 1].map((_, index) => {
                                      const val = index === 0 ? reportOutput.clinicalData.weightForHeightZ : reportOutput.clinicalData.heightForAgeZ;
                                      return <Cell key={index} fill={val < -2 ? '#EF4444' : '#10B981'} />;
                                    })}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-vitora-text/10">
                          <button
                            onClick={handleResetDeck}
                            className="px-4 py-2 rounded-xl glass-button-secondary text-4xs font-bold uppercase border border-vitora-border/60"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => { setSlideDirection(1); setDeckStep(5); }}
                            className="flex items-center gap-1 px-5 py-2.5 rounded-xl glass-button text-2xs font-black shadow-md"
                          >
                            Review Action Plan <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* --- STEP 5: RECOMMENDATIONS & DOWNLOAD PDF (FLY UP EFFECT) --- */}
                    {deckStep === 5 && reportOutput && (
                      <motion.div
                        key="w-step-5"
                        custom={slideDirection}
                        variants={conveyorVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-4 w-full"
                      >
                        <div className="flex items-center justify-between border-b border-vitora-text/10 pb-2">
                          <div className="flex items-center gap-2 text-vitora-secondary">
                            <Sparkles className="w-5.5 h-5.5" />
                            <h3 className="text-md font-black tracking-tight text-vitora-text">4. Clinical Action Plan</h3>
                          </div>
                        </div>

                        {/* Staggered fly-up layout card stacks */}
                        <motion.div 
                          variants={staggerContainer}
                          initial="hidden"
                          animate="show"
                          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                        >
                          <motion.div 
                            variants={flyUpVariant}
                            className="p-4 bg-white/40 border border-white/50 rounded-2xl flex gap-2.5 text-4xs"
                          >
                            <Apple className="w-5 h-5 text-vitora-primary flex-shrink-0" />
                            <div>
                              <h4 className="font-extrabold text-vitora-text uppercase tracking-wide">Suggested Nutrition</h4>
                              <p className="font-semibold text-vitora-text/70 mt-1 leading-normal">
                                {reportOutput.recommendations.nutritionalAdvice}
                              </p>
                            </div>
                          </motion.div>

                          <motion.div 
                            variants={flyUpVariant}
                            className="p-4 bg-white/40 border border-white/50 rounded-2xl flex gap-2.5 text-4xs"
                          >
                            <Heart className="w-5 h-5 text-vitora-secondary flex-shrink-0" />
                            <div>
                              <h4 className="font-extrabold text-vitora-text uppercase tracking-wide">Dietary Protocols</h4>
                              <p className="font-semibold text-vitora-text/70 mt-1 leading-normal">
                                {reportOutput.recommendations.dietaryGuidelines}
                              </p>
                            </div>
                          </motion.div>
                        </motion.div>

                        {/* Staggered fly-up PDF box */}
                        <motion.div 
                          variants={flyUpVariant}
                          initial="hidden"
                          animate="show"
                          className="p-4 bg-vitora-primary/5 border border-vitora-primary/20 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                        >
                          <div>
                            <h4 className="text-3xs font-black uppercase text-vitora-secondary tracking-wider">Hospital Record Compiled</h4>
                            <p className="text-4xs font-semibold text-vitora-text/70 leading-normal mt-0.5">
                              Download the professional PDF evaluation sheet saved inside database.
                            </p>
                          </div>
                          <button
                            onClick={() => downloadReportPDF(reportOutput.reportUuid)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass-button text-3xs font-black shadow-md self-start sm:self-center hover:scale-103 transition-transform"
                          >
                            <Download className="w-3.5 h-3.5" /> Download PDF Sheet
                          </button>
                        </motion.div>

                        <div className="flex justify-between items-center pt-3 border-t border-vitora-text/10">
                          <button
                            onClick={() => { setSlideDirection(-1); setDeckStep(4); }}
                            className="px-4 py-2 rounded-xl glass-button-secondary text-4xs font-bold uppercase border border-vitora-border/60 flex items-center gap-1"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Graph
                          </button>
                          <button
                            onClick={handleResetDeck}
                            className="px-5 py-2.5 rounded-xl glass-button text-2xs font-black shadow-md flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Complete Screening
                          </button>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </main>

      {/* --- FOOTER TRADEMARKS --- */}
      <footer className="text-center py-4 text-5xs text-vitora-text/30 font-bold uppercase tracking-widest relative z-10">
        Vitora Inc. © 2026 | Secured Pediatric Diagnostic Portal
      </footer>

    </div>
  );
};

// Seeder PDF file downloader helper
const handleDownload = async (uuid: string, event: React.MouseEvent) => {
  event.stopPropagation();
  try {
    const response = await api.get(`/reports/${uuid}/pdf`, { responseType: 'blob' });
    const file = new Blob([response.data], { type: 'application/pdf' });
    const fileURL = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = fileURL;
    link.setAttribute('download', `Vitora_Report_${uuid}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  } catch (error) {
    console.error(error);
    alert('Error fetching report PDF.');
  }
};

export default Dashboard;
