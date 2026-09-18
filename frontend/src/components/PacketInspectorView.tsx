import React, { useEffect, useState } from 'react';
import { Binary, Search, Eye, ArrowRight, Layers, Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { PacketSample } from '../types';
import { api } from '../services/api';

export const PacketInspectorView: React.FC = () => {
  const [packets, setPackets] = useState<PacketSample[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<PacketSample | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadSamples() {
      try {
        const res = await fetch('/api/packets/samples?limit=50');
        const data = await res.json();
        setPackets(data);
        if (data.length > 0 && !selectedPacket) {
          setSelectedPacket(data[0]);
        }
      } catch (err) {
        console.error('Failed to load packet samples:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSamples();
    const timer = setInterval(loadSamples, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="panel-card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
            <Binary className="h-4 w-4 text-cyan-400" />
            <span>DEEP PACKET INSPECTOR & PAYLOAD DISSECTOR</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            L2/L3/L4 protocol stack analysis and raw payload byte inspection
          </p>
        </div>
        <span className="badge-cyan">{packets.length} PACKETS CAPTURED</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Packet Stream List (5 cols) */}
        <div className="panel-card p-4 lg:col-span-5 flex flex-col justify-between max-h-[600px] overflow-hidden">
          <div className="text-xs font-mono text-slate-400 uppercase font-bold mb-3">
            Captured Packets Stream
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {packets.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-400">
                Waiting for packet samples... Start the DPI engine.
              </div>
            ) : (
              packets.map((pkt) => {
                const isSelected = selectedPacket?.packet_id === pkt.packet_id;
                return (
                  <div
                    key={pkt.packet_id}
                    onClick={() => setSelectedPacket(pkt)}
                    className={`p-3 rounded-lg border text-xs font-mono cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-900/70 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">#{pkt.packet_id}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {pkt.protocol}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        pkt.action === 'DROP' ? 'badge-rose' : 'badge-emerald'
                      }`}>
                        {pkt.action}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      <span>{pkt.src_ip}:{pkt.src_port}</span>
                      <span className="text-slate-500 mx-1.5">➔</span>
                      <span>{pkt.dst_ip}:{pkt.dst_port}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                      <span>{pkt.size_bytes} Bytes</span>
                      <span>{pkt.time_str}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Packet Dissector Detail & Payload (7 cols) */}
        <div className="panel-card p-5 lg:col-span-7 flex flex-col justify-between max-h-[600px] overflow-y-auto space-y-4 font-mono text-xs">
          {selectedPacket ? (
            <>
              {/* Header Info */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase">
                    Packet #{selectedPacket.packet_id} Dissection
                  </span>
                  <span className="text-slate-400 text-[11px]">{selectedPacket.time_str}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-800/80 pt-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">SRC ADDR:</span>
                    <span className="text-cyan-300 font-bold">{selectedPacket.src_ip}:{selectedPacket.src_port}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">DST ADDR:</span>
                    <span className="text-indigo-300 font-bold">{selectedPacket.dst_ip}:{selectedPacket.dst_port}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PROTOCOL:</span>
                    <span className="text-slate-200">{selectedPacket.protocol}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">FRAME SIZE:</span>
                    <span className="text-slate-200">{selectedPacket.size_bytes} Bytes</span>
                  </div>
                </div>
              </div>

              {/* Protocol Stack Layers */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Protocol Stack Headers
                </span>
                
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-cyan-400 font-semibold">Layer 2: Ethernet II</div>
                  <div className="text-slate-400">Type: IPv4 (0x0800)</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-indigo-400 font-semibold">Layer 3: Internet Protocol Version 4</div>
                  <div className="text-slate-400">Src: {selectedPacket.src_ip} | Dst: {selectedPacket.dst_ip}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-emerald-400 font-semibold">Layer 4: {selectedPacket.protocol} Header</div>
                  <div className="text-slate-400">Src Port: {selectedPacket.src_port} | Dst Port: {selectedPacket.dst_port}</div>
                </div>
              </div>

              {/* Payload Snippet Preview */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Extracted Payload Hex / ASCII Dump
                </span>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-cyan-300 font-mono overflow-x-auto whitespace-pre leading-relaxed">
                  {selectedPacket.payload_snippet || (
                    `0000  16 03 01 00 f5 01 00 00  f1 03 03 b2 a4 19 8c 9f  ................\n` +
                    `0010  1a 7e 30 1c 9a 02 8b f3  94 00 28 a1 33 90 2a 8f  .~0.......(.3.*.\n` +
                    `0020  00 00 20 c0 2f c0 2b c0  11 c0 07 c0 13 c0 09 c0  .. ./...+.......\n` +
                    `0030  14 c0 0a 00 9c 00 9d 00  2f 00 35 00 0a 01 00 00  ......../.5.....`
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400">Select a packet to view dissection details.</div>
          )}
        </div>
      </div>
    </div>
  );
};
