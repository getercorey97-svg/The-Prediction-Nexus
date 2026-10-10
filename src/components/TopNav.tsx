/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, Terminal } from 'lucide-react';

export type NavTabType =
  | 'overview'
  | 'tennis'
  | 'simulation-lab'
  | 'factors'
  | 'predictions'
  | 'post-mortem'
  | 'upgrades'
  | 'sql-ddl';

interface TopNavProps {
  activeTab: NavTabType;
  onSelectTab: (tab: NavTabType) => void;
  onOpenTriggerModal: () => void;
  onDownloadSql: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenTriggerModal,
  onDownloadSql,
}) => {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#080c14]/90 backdrop-blur-md border-b border-white/[0.08]">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Terminal className="w-4 h-4" />
        </div>
        <button
          onClick={() => onSelectTab('overview')}
          className="text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 text-left"
        >
          The Prediction Nexus
        </button>
      </div>

      {/* Zone 2: Single-line clean text navigation links */}
      <nav className="hidden xl:flex items-center gap-5 text-sm font-medium">
        <button
          onClick={() => onSelectTab('overview')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'overview'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => onSelectTab('tennis')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'tennis'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tennis 1-on-1
        </button>
        <button
          onClick={() => onSelectTab('simulation-lab')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'simulation-lab'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Simulation Lab
        </button>
        <button
          onClick={() => onSelectTab('factors')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'factors'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Factor Breakdown
        </button>
        <button
          onClick={() => onSelectTab('predictions')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'predictions'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Forecast Lines
        </button>
        <button
          onClick={() => onSelectTab('post-mortem')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'post-mortem'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Factual Post-Mortem
        </button>
        <button
          onClick={() => onSelectTab('upgrades')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'upgrades'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Model Upgrades
        </button>
        <button
          onClick={() => onSelectTab('sql-ddl')}
          className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
            activeTab === 'sql-ddl'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          SQL Schema
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenTriggerModal}
          className="px-3.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-md hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0"
        >
          Simulate Match Completion
        </button>
        <button
          onClick={onDownloadSql}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-white/[0.05] border border-white/[0.1] rounded-md hover:bg-white/[0.1] transition-colors whitespace-nowrap shrink-0"
          title="Download complete raw init.sql script"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>init.sql</span>
        </button>
      </div>
    </header>
  );
};
