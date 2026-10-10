/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, CheckCircle2 } from 'lucide-react';

interface SqlConsoleViewProps {
  sqlContent: string;
  onDownload: () => void;
}

export const SqlConsoleView: React.FC<SqlConsoleViewProps> = ({
  sqlContent,
  onDownload,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'tables' | 'triggers' | 'realtime' | 'seeds'>('all');

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const lineCount = sqlContent.split('\n').length;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Batch 1: Supabase DDL Infrastructure</h2>
          <p className="text-xs text-slate-400">
            Single raw <span className="font-mono text-emerald-400 font-medium">init.sql</span> script containing complete schemas, functions, triggers, Realtime publication, RLS policies, and seed data
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-white/[0.06] border border-white/[0.1] rounded-md hover:bg-white/[0.1] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Raw SQL</span>
              </>
            )}
          </button>

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 rounded-md hover:bg-emerald-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-950" />
            <span>Download init.sql</span>
          </button>
        </div>
      </div>

      {/* Summary cards for DDL components */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-[#0e1422] rounded border border-white/[0.08]">
          <div className="text-slate-400">Total Entities</div>
          <div className="mt-1 font-mono text-base font-bold text-white">5 Core Tables</div>
          <div className="text-[11px] text-slate-500 font-mono">framework, events, mc, post_mortem, upgrades</div>
        </div>

        <div className="p-3 bg-[#0e1422] rounded border border-white/[0.08]">
          <div className="text-slate-400">PostgreSQL Triggers</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-400">2 Automated</div>
          <div className="text-[11px] text-slate-500 font-mono">Atomic Brier + EWMA Upgrades</div>
        </div>

        <div className="p-3 bg-[#0e1422] rounded border border-white/[0.08]">
          <div className="text-slate-400">Realtime Replication</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-400">Full Replica Identity</div>
          <div className="text-[11px] text-slate-500 font-mono">supabase_realtime publication</div>
        </div>

        <div className="p-3 bg-[#0e1422] rounded border border-white/[0.08]">
          <div className="text-slate-400">Security Model</div>
          <div className="mt-1 font-mono text-base font-bold text-white">100% RLS Enabled</div>
          <div className="text-[11px] text-slate-500 font-mono">Public SELECT / Service Role ALL</div>
        </div>
      </div>

      {/* Deployment Quick Guide */}
      <div className="p-4 bg-[#080c14] border border-white/[0.08] rounded-lg text-xs space-y-2">
        <div className="flex items-center gap-2 font-semibold text-white">
          <FileCode className="w-4 h-4 text-emerald-400" />
          <span>Execution Instructions for Supabase</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          In your Supabase Dashboard: Navigate to <span className="text-emerald-400 font-mono font-medium">SQL Editor</span> → click <span className="text-white font-medium">New query</span> → paste the entire script below → click <span className="text-emerald-400 font-semibold">Run</span>. Alternatively, place the script in <span className="font-mono text-slate-200">supabase/migrations/</span> or apply via <span className="font-mono text-slate-200">psql "$DATABASE_URL" -f supabase/init.sql</span>.
        </p>
      </div>

      {/* Raw SQL Viewer Box */}
      <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-[#070a10]">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#080c14] border-b border-white/[0.08] text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>supabase/init.sql</span>
            <span className="text-slate-600">·</span>
            <span>{lineCount} lines</span>
          </div>
          <span className="text-emerald-400 font-medium">PostgreSQL 15+ / Supabase Compatible</span>
        </div>

        <div className="p-4 max-h-[580px] overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 bg-[#080c14]/50">
          <pre className="whitespace-pre overflow-x-auto text-slate-300">
            {sqlContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
