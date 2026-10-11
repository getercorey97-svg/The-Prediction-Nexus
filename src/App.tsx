/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { nexusStore } from './services/nexusStore';
import { SportingEvent } from './types/database';
import { RAW_INIT_SQL } from './data/rawSql';
import { realtimeManager } from './services/realtimeSubscription';
import { TopNav, NavTabType } from './components/TopNav';
import { OverviewView } from './components/OverviewView';
import { TennisPredictorView } from './components/TennisPredictorView';
import { SimulationLabView } from './components/SimulationLabView';
import { FactorDecompositionView } from './components/FactorDecompositionView';
import { MonteCarloView } from './components/MonteCarloView';
import { PostMortemView } from './components/PostMortemView';
import { AutonomousUpgradesView } from './components/AutonomousUpgradesView';
import { SqlConsoleView } from './components/SqlConsoleView';
import { TriggerSimulatorModal } from './components/TriggerSimulatorModal';
import { RotateCcw, Check, Radio } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabType>('overview');
  const [frameworks, setFrameworks] = useState(nexusStore.getFrameworks());
  const [events, setEvents] = useState(nexusStore.getEvents());
  const [predictions, setPredictions] = useState(nexusStore.getPredictions());
  const [postMortems, setPostMortems] = useState(nexusStore.getPostMortems());
  const [upgrades, setUpgrades] = useState(nexusStore.getUpgrades());
  const [realtimeLogs, setRealtimeLogs] = useState(nexusStore.getRealtimeLogs());

  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to state store updates
    const unsubscribe = nexusStore.subscribe(() => {
      setFrameworks(nexusStore.getFrameworks());
      setEvents(nexusStore.getEvents());
      setPredictions(nexusStore.getPredictions());
      setPostMortems(nexusStore.getPostMortems());
      setUpgrades(nexusStore.getUpgrades());
      setRealtimeLogs(nexusStore.getRealtimeLogs());
    });

    // Wire up real-time toast callback
    realtimeManager.setToastCallback((msg: string) => {
      showToast(msg);
    });
    realtimeManager.init();

    return () => {
      unsubscribe();
      realtimeManager.teardown();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenTriggerForEvent = (event: SportingEvent) => {
    setSelectedEventId(event.id);
    setIsTriggerModalOpen(true);
  };

  const handleOpenGenericTrigger = () => {
    setSelectedEventId(null);
    setIsTriggerModalOpen(true);
  };

  const handleExecuteTrigger = (eventId: string, homeScore: number, awayScore: number) => {
    const result = nexusStore.completeEventWithScores(eventId, homeScore, awayScore);
    showToast(`Triggers evaluated atomically! Brier score computed & model upgraded.`);
    return result;
  };

  const handleDownloadSql = () => {
    const blob = new Blob([RAW_INIT_SQL], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'init.sql');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('init.sql file downloaded successfully.');
  };

  const handleResetSeed = () => {
    nexusStore.resetToSeed();
    showToast('Database reset to verified empirical seed data.');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 3-Zone Top Bar */}
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenTriggerModal={handleOpenGenericTrigger}
        onDownloadSql={handleDownloadSql}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Sub-header Context Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-white/[0.06] text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-semibold text-white">THE PREDICTION NEXUS</span>
            <span>·</span>
            <span>Batch 4 Production Platform</span>
            <span>·</span>
            <span className="text-emerald-400 font-mono">MLB · CFB · NFL · Tennis</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Realtime WebSockets Active</span>
            </div>
            <span className="text-slate-600">|</span>
            <button
              onClick={handleResetSeed}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title="Reset state to initial verifiable historical seed data"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset State</span>
            </button>
            <span className="text-slate-600">|</span>
            <div className="font-mono text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>MC Iterations:</span>
              <span className="text-emerald-300 font-bold">50,003</span>
            </div>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'overview' && (
          <OverviewView
            frameworks={frameworks}
            events={events}
            predictions={predictions}
            postMortems={postMortems}
            realtimeLogs={realtimeLogs}
            onOpenTriggerModalForEvent={handleOpenTriggerForEvent}
            onNavigateToTab={(tab) => {
              if (tab === 'predictions') setActiveTab('predictions');
              else if (tab === 'post-mortem') setActiveTab('post-mortem');
              else if (tab === 'upgrades') setActiveTab('upgrades');
              else if (tab === 'sql-ddl') setActiveTab('sql-ddl');
              else if (tab === 'tennis') setActiveTab('tennis');
            }}
          />
        )}

        {activeTab === 'tennis' && (
          <TennisPredictorView events={events} />
        )}

        {activeTab === 'simulation-lab' && (
          <SimulationLabView events={events} />
        )}

        {activeTab === 'factors' && (
          <FactorDecompositionView />
        )}

        {activeTab === 'predictions' && (
          <MonteCarloView
            events={events}
            predictions={predictions}
            frameworks={frameworks}
          />
        )}

        {activeTab === 'post-mortem' && (
          <PostMortemView
            postMortems={postMortems}
            events={events}
            predictions={predictions}
          />
        )}

        {activeTab === 'upgrades' && (
          <AutonomousUpgradesView
            upgrades={upgrades}
            frameworks={frameworks}
          />
        )}

        {activeTab === 'sql-ddl' && (
          <SqlConsoleView
            sqlContent={RAW_INIT_SQL}
            onDownload={handleDownloadSql}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#060910] py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          The Prediction Nexus · Autonomous Sports Quantitative Platform
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
          <span>Vercel Serverless (Python FastAPI)</span>
          <span>·</span>
          <span>50,003 NumPy Monte Carlo</span>
          <span>·</span>
          <span>Supabase Realtime WebSockets</span>
          <span>·</span>
          <span>Brier Score Post-Mortem</span>
        </div>
      </footer>

      {/* Trigger Simulation Modal */}
      <TriggerSimulatorModal
        isOpen={isTriggerModalOpen}
        onClose={() => setIsTriggerModalOpen(false)}
        events={events}
        predictions={predictions}
        selectedEventId={selectedEventId}
        onExecuteTrigger={handleExecuteTrigger}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-slate-950 font-semibold text-xs rounded-lg shadow-xl animate-fade-in">
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
