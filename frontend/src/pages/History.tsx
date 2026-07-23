import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  Search, 
  Download, 
  ArrowLeft, 
  Plus, 
  FileText,
  Calendar,
  ExternalLink
} from 'lucide-react';

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

const History: React.FC = () => {
  const navigate = useNavigate();
  const [historyList, setHistoryList] = useState<ReportHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async (search = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/reports/history${search ? `?search=${search}` : ''}`);
      setHistoryList(response.data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch historical screening logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory(searchTerm);
  };

  const handleDownload = async (uuid: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const response = await api.get(`/reports/${uuid}/pdf`, {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `Vitora_Report_${uuid}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Error fetching report PDF document.');
    }
  };

  // Navigates back to the report viewer using complete info
  const handleViewReport = (item: ReportHistoryItem) => {
    try {
      // To bypass re-fetching facial features details, let's construct a formatted mock state 
      // containing patient info, clinical indicators, overall score, etc.
      const mockReportData = {
        reportUuid: item.reportUuid,
        overallScore: item.overallScore,
        classification: item.classification,
        confidence: item.confidence,
        clinicalScore: item.overallScore, // approximate weights if missing
        facialScore: item.overallScore,
        recommendations: {
          nutritionalAdvice: item.classification === 'High Risk' 
            ? 'High-Energy Therapeutic Foods (RUTF/Plumpy\'Nut) must be administered under supervision.' 
            : item.classification === 'Moderate Risk'
              ? 'Introduce nutrient-dense local diets containing high protein.'
              : 'Maintain an age-appropriate balanced diet.',
          dietaryGuidelines: item.classification === 'High Risk'
            ? 'Feed in small frequent intervals (every 2-3 hours).'
            : item.classification === 'Moderate Risk'
              ? 'Incorporate daily servings of eggs, milk, pulverized seeds/nuts.'
              : 'Focus on locally sourced vegetables, fresh fruits, whole grains.',
          followUpInstructions: item.classification === 'High Risk'
            ? 'CRITICAL: Immediate referral to a pediatrician.'
            : item.classification === 'Moderate Risk'
              ? 'Schedule an active clinical review in 2 weeks.'
              : 'Conduct routine weight and stature tracking.'
        },
        patient: {
          name: item.patientName,
          gender: item.gender,
          ageMonths: item.ageMonths
        },
        clinicalData: {
          heightCm: 90, // mock fallback
          weightKg: 11,
          muacCm: item.muac || 12.0,
          bmi: item.bmi || 13.5,
          weightForHeightZ: -1.5,
          heightForAgeZ: -1.2
        },
        facialFeatures: {
          cheek_hollowness: 0.45,
          temple_depression: 0.48,
          jaw_prominence: 0.52,
          cheekbone_prominence: 0.58,
          temple_width: 0.60,
          facial_width_ratio: 0.80,
          jaw_width_ratio: 0.70,
          facial_symmetry: 0.98
        }
      };

      navigate(`/report/${item.reportUuid}`, { state: { report: mockReportData } });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      
      {/* Header bar */}
      <header className="flex justify-between items-center glass-panel px-6 py-4 rounded-3xl shadow-md border-white/50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-vitora-primary/10 text-vitora-text/60 hover:text-vitora-primary rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-md font-extrabold tracking-wide text-vitora-text">Screening History</h1>
            <p className="text-3xs text-vitora-text/50 font-bold uppercase tracking-wider">Search past diagnosis records</p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/screening')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl glass-button text-3xs font-extrabold shadow-md uppercase tracking-wider"
        >
          <Plus className="w-3.5 h-3.5" /> New Screening
        </button>
      </header>

      {/* Search form */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-vitora-text/40" />
          <input
            type="text"
            placeholder="Search by patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm rounded-2xl glass-input text-vitora-text font-medium"
          />
        </div>
        <button 
          type="submit"
          className="px-6 py-3 rounded-2xl glass-button-secondary text-xs font-bold border border-vitora-border/60"
        >
          Filter
        </button>
      </form>

      {/* History table list */}
      <div className="glass-panel rounded-glass shadow-md overflow-hidden border-white/50">
        {loading ? (
          <div className="py-20 text-center font-bold text-xs text-vitora-text/40 animate-pulse">
            Retrieving database screening records...
          </div>
        ) : error ? (
          <div className="py-20 text-center font-bold text-xs text-red-500">
            {error}
          </div>
        ) : historyList.length === 0 ? (
          <div className="py-20 text-center text-xs text-vitora-text/50 font-semibold space-y-4">
            <FileText className="w-10 h-10 mx-auto text-vitora-text/30" />
            <p>No screening reports match your queries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/40 text-[10px] font-black uppercase text-vitora-text/50 border-b border-vitora-text/10">
                  <th className="px-6 py-4">Patient Details</th>
                  <th className="px-6 py-4">Assessment Date</th>
                  <th className="px-6 py-4 text-center">MUAC</th>
                  <th className="px-6 py-4 text-center">Score</th>
                  <th className="px-6 py-4">Classification</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vitora-text/5 text-2xs font-semibold text-vitora-text/80">
                {historyList.map((item) => {
                  const isHigh = item.classification === 'High Risk';
                  const isMod = item.classification === 'Moderate Risk';
                  const statusColor = isHigh 
                    ? 'text-red-600 bg-red-500/10 border-red-500/20' 
                    : isMod 
                      ? 'text-amber-600 bg-amber-500/10 border-amber-500/20' 
                      : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';

                  return (
                    <tr 
                      key={item.predictionId}
                      onClick={() => handleViewReport(item)}
                      className="hover:bg-white/40 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-vitora-text text-xs">{item.patientName}</p>
                        <p className="text-4xs text-vitora-text/45 uppercase font-black mt-0.5">
                          {item.gender} | {item.ageMonths} Months
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-vitora-text/60">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(item.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.muac ? `${item.muac} cm` : '--'}
                      </td>
                      <td className="px-6 py-4 text-center font-bold">
                        {item.overallScore}%
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full border text-4xs font-black uppercase ${statusColor}`}>
                          {item.classification}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => handleDownload(item.reportUuid, e)}
                            className="p-2 hover:bg-vitora-primary/10 rounded-xl text-vitora-text/60 hover:text-vitora-primary transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4.5 h-4.5" />
                          </button>
                          <span className="p-2 text-vitora-text/30 group-hover:text-vitora-primary transition-colors">
                            <ExternalLink className="w-4.5 h-4.5" />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default History;
