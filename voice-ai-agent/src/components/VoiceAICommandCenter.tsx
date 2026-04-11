"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, PhoneCall, ShieldAlert, Zap, 
  Globe, Cpu, StopCircle, 
  PlayCircle, MoreVertical, Server, Volume2
} from "lucide-react";

export default function VoiceAICommandCenter() {
  const [systemActive, setSystemActive] = useState(true);

  // Fake active calls data
  const [calls] = useState([
    { id: "CL-8842", region: "us-east", duration: "04:12", status: "Speaking", sentiment: "Positive" },
    { id: "CL-9102", region: "eu-west", duration: "01:45", status: "Listening", sentiment: "Neutral" },
    { id: "CL-1025", region: "ap-south", duration: "12:04", status: "Processing", sentiment: "Frustrated" },
  ]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* Grid Pattern Background */}
      <div className="fixed inset-0 pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      
      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-900/10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

      <div className="relative z-10 flex flex-col h-screen p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/60 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
              <Activity className="w-6 h-6 text-white" />
              {systemActive && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-neutral-900 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-100 to-blue-200">
                Command Center
              </h1>
              <p className="text-neutral-400 text-sm flex items-center gap-2">
                <Globe className="w-3 h-3" /> Global Routing Cluster
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setSystemActive(!systemActive)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                systemActive 
                  ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25"
              }`}
            >
              {systemActive ? <StopCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
              {systemActive ? "EMERGENCY STOP" : "START CLUSTER"}
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* Key Metrics */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: "Active Calls", value: "24", unit: "live", icon: PhoneCall, color: "text-blue-400", bg: "bg-blue-400/10" },
                { label: "Avg Latency", value: "184", unit: "ms", icon: Zap, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                { label: "CPU Load", value: "48", unit: "%", icon: Cpu, color: "text-amber-400", bg: "bg-amber-400/10" },
              ].map((stat, i) => (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/60 rounded-2xl p-5 flex flex-col hover:border-neutral-700/60 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <MoreVertical className="w-4 h-4 text-neutral-600 cursor-pointer hover:text-neutral-300" />
                  </div>
                  <p className="text-neutral-400 text-sm font-medium">{stat.label}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <h2 className="text-3xl font-black text-neutral-100 tracking-tight">{stat.value}</h2>
                    <span className="text-neutral-500 font-medium text-sm">{stat.unit}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Live Call Monitoring */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/60 rounded-2xl flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-neutral-800/60 flex justify-between items-center bg-neutral-900/50">
                <h3 className="font-semibold text-neutral-200 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  Live Call Interception
                </h3>
                <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold rounded-full">
                  AUTO-SCALING
                </span>
              </div>
              <div className="overflow-y-auto p-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider">
                      <th className="pb-3 font-medium">Session ID</th>
                      <th className="pb-3 font-medium">Region</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Duration</th>
                      <th className="pb-3 font-medium text-right">Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {calls.map((call, idx) => (
                        <motion.tr 
                          key={call.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + (idx * 0.1) }}
                          className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors group"
                        >
                          <td className="py-4 text-sm font-mono text-neutral-300">{call.id}</td>
                          <td className="py-4 text-sm text-neutral-400 flex items-center gap-2">
                            <Server className="w-3 h-3" /> {call.region}
                          </td>
                          <td className="py-4 text-sm">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              call.status === 'Speaking' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              call.status === 'Listening' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}>
                              {call.status}
                            </span>
                          </td>
                          <td className="py-4 text-sm font-mono text-neutral-400">{call.duration}</td>
                          <td className="py-4 text-sm text-right">
                            <span className={`text-xs font-medium ${
                              call.sentiment === 'Positive' ? 'text-emerald-400' : 
                              call.sentiment === 'Frustrated' ? 'text-rose-400' : 'text-neutral-400'
                            }`}>
                              {call.sentiment}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>

          {/* Right Sidebar - System Logs */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="col-span-12 lg:col-span-4 bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/60 rounded-2xl p-5 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-6 text-neutral-200 font-semibold border-b border-neutral-800/60 pb-4">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Security & Error Logs
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto pr-2 relative filter">
              {/* Overlay fade out at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
              
              {[
                { time: "10:42:01", level: "INFO", msg: "Model swapped to fast-tts-v2", hl: false },
                { time: "10:41:15", level: "WARN", msg: "Latency spike detected on eu-west (201ms)", hl: true },
                { time: "10:35:00", level: "INFO", msg: "New call CL-8842 allocated to worker-03", hl: false },
                { time: "10:30:12", level: "INFO", msg: "Daily snapshot backup completed", hl: false },
                { time: "10:28:44", level: "ERROR", msg: "Twilio webhook timeout on retry #1", hl: true },
                { time: "10:25:01", level: "INFO", msg: "Deepgram socket connected", hl: false },
              ].map((log, i) => (
                <div key={i} className="flex gap-3 text-sm group">
                  <span className="text-neutral-600 font-mono text-xs mt-0.5 min-w-[60px]">{log.time}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded ${
                        log.level === 'ERROR' ? 'bg-rose-500/20 text-rose-400' :
                        log.level === 'WARN' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {log.level}
                      </span>
                    </div>
                    <p className={`text-sm ${log.hl ? 'text-neutral-200 font-medium' : 'text-neutral-500'}`}>
                      {log.msg}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-4 flex gap-2">
              <button className="flex-1 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors border border-neutral-700">
                EXPORT LOGS
              </button>
              <button className="flex-1 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-colors border border-cyan-500/20">
                AWS CONSOLE
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
