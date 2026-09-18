import React, { useState } from 'react';
import { History, Play, Square, Upload, Gauge, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface ReplayViewProps {
  isReplaying: boolean;
  onStartReplay: (speed: number) => Promise<void>;
  onStopReplay: () => Promise<void>;
  currentPcap: string;
  pcapsList: string[];
  onPcapUploaded: () => void;
}

export const ReplayView: React.FC<ReplayViewProps> = ({
  isReplaying,
  onStartReplay,
  onStopReplay,
  currentPcap,
  pcapsList,
  onPcapUploaded,
}) => {
  const [speed, setSpeed] = useState<number>(1.0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus('Uploading PCAP...');
    try {
      const res = await api.uploadPcap(file);
      setUploadStatus(`Uploaded: ${res.filename}`);
      onPcapUploaded();
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      setUploadStatus('Failed to upload PCAP file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="panel-card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
            <History className="h-4 w-4 text-purple-400" />
            <span>SESSION REPLAY & OFFLINE SIMULATION LABORATORY</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Replay live telemetry captures at variable playback rates for retrospective incident analysis.
          </p>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
          isReplaying ? 'badge-purple' : 'badge-slate'
        }`}>
          {isReplaying ? 'PLAYBACK ACTIVE' : 'STANDBY'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Playback Controls Card */}
        <div className="panel-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-mono text-slate-200 uppercase">
              Telemetry Playback Engine
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* Speed Selector */}
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1.5">PLAYBACK RATE</label>
              <div className="grid grid-cols-4 gap-2">
                {[0.5, 1.0, 2.0, 5.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      speed === s
                        ? 'bg-cyan-950 text-cyan-400 border-cyan-500 shadow-md shadow-cyan-950/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {!isReplaying ? (
                <button
                  onClick={() => onStartReplay(speed)}
                  className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-mono text-xs font-semibold shadow-lg shadow-purple-950/50 border border-purple-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>START REPLAY ({speed}x SPEED)</span>
                </button>
              ) : (
                <button
                  onClick={onStopReplay}
                  className="w-full py-3 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-mono text-xs font-semibold shadow-lg shadow-rose-950/50 border border-rose-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>STOP REPLAY</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Upload Custom PCAP Card */}
        <div className="panel-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold font-mono text-slate-200 uppercase">
              Upload PCAP Capture
            </h3>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <p className="text-slate-400 text-xs leading-relaxed">
              Upload a `.pcap` packet capture file to run it through the C++ multi-threaded DPI engine.
            </p>

            <label className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/40">
              <Upload className="h-8 w-8 text-slate-500 mb-2" />
              <span className="text-xs text-slate-300 font-semibold">Click to select .pcap file</span>
              <span className="text-[10px] text-slate-500 mt-1">Supports standard libpcap format</span>
              <input
                type="file"
                accept=".pcap"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {uploadStatus && (
              <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
