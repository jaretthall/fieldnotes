import { useState, useEffect } from 'react';
import { useEntriesStore } from '../../stores/entries.store';
import type { AppSettings, VoiceResult, WhisperInstallResult, WhisperStatus, RealtimeInstallResult } from '../../../../shared/types';
import { usePathwaysStore } from '../../stores/pathways.store';
import EntryComposer from '../journal/EntryComposer';
import EntryDetail from '../journal/EntryDetail';
import MicOverlay from '../journal/MicOverlay';
import SearchBar from '../search/SearchBar';
import SearchResults from '../search/SearchResults';
import Timeline from '../insights/Timeline';
import PatternCard from '../insights/PatternCard';
import PathwayBrowser from '../pathways/PathwayBrowser';
import PathwaySession from '../pathways/PathwaySession';
import { BookOpen } from 'lucide-react';

interface MainPanelProps {
  activeView: string;
}

export default function MainPanel({ activeView }: MainPanelProps) {
  const activePathway = usePathwaysStore((s) => s.activePathway);
  const [pathwayView, setPathwayView] = useState<'browser' | 'session'>('browser');

  useEffect(() => {
    if (activeView === 'pathways') {
      setPathwayView(activePathway ? 'session' : 'browser');
    }
  }, [activeView, activePathway]);

  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    window.api.invoke('settings:get').then((settings) => {
      setAppSettings(settings);
    }).catch(() => undefined);
  }, []);
  const allowVoice = appSettings?.inputMode !== 'text_only';
  const allowRealtime = allowVoice && (appSettings?.realtimeTranscription ?? false);
  const realtimeModel = appSettings?.realtimeWhisperModel ?? 'tiny.en';

  return (
    <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {activeView === 'journal' && <JournalView allowVoice={allowVoice} allowRealtime={allowRealtime} realtimeModel={realtimeModel} />}
      {activeView === 'search' && <SearchView />}
      {activeView === 'timeline' && <TimelineView />}
      {activeView === 'settings' && <SettingsView onSettingsUpdated={setAppSettings} />}
      {activeView === 'pathways' && (
        pathwayView === 'session' && activePathway ? (
          <PathwaySession
            pathway={activePathway}
            onBack={() => setPathwayView('browser')}
            allowVoice={allowVoice}
          />
        ) : (
          <PathwayBrowser onPathwayStarted={() => setPathwayView('session')} />
        )
      )}
    </main>
  );
}

function JournalView({ allowVoice, allowRealtime, realtimeModel }: { allowVoice: boolean; allowRealtime: boolean; realtimeModel: string }) {
  const selectedEntry = useEntriesStore((s) => s.selectedEntry);
  const entries = useEntriesStore((s) => s.entries);
  const selectEntry = useEntriesStore((s) => s.selectEntry);
  const createEntry = useEntriesStore((s) => s.createEntry);
  const deleteEntry = useEntriesStore((s) => s.deleteEntry);

  const handleVoiceResult = (result: VoiceResult) => {
    if ('transcription' in result) {
      createEntry({ transcription: result.transcription, inputType: 'voice' });
    } else {
      createEntry({
        transcription: '[Voice entry — transcription unavailable. Audio saved.]',
        inputType: 'voice',
        audioPath: result.audioPath,
        audioDuration: result.duration,
      });
    }
  };

  if (selectedEntry) {
    return (
      <div className="flex-1 bg-white relative flex flex-col shadow-inner min-h-0">
        <EntryDetail
          entry={selectedEntry}
          onBack={() => selectEntry(null)}
          onDelete={() => deleteEntry(selectedEntry.id)}
          variant="gemini"
        />
        {allowVoice && <MicOverlay onVoiceResult={handleVoiceResult} />}
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white relative flex flex-col shadow-inner min-h-0">
      {/* Gemini-style welcome when no entry selected */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-0 overflow-y-auto">
        <div className="max-w-md">
          <div className="w-16 h-16 rounded-3xl bg-[#2B5F3F]/10 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="text-[#2B5F3F]" size={32} />
          </div>
          <h2 className="text-3xl font-bold text-[#1A1A2E] mb-3">Fieldnotes</h2>
          <p className="text-[#4A4A5A] mb-8 leading-relaxed">
            {allowVoice
              ? 'The journal for your internal landscape. Press the mic to start reflecting, or type below.'
              : 'The journal for your internal landscape. Type below to begin. Voice recording is currently off in Settings.'}
          </p>

          <div className="mb-8">
            <EntryComposer allowRealtime={allowRealtime} realtimeModel={realtimeModel} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-xl border border-[#E8E5DD] hover:border-[#2B5F3F]/30 transition-all">
              <div className="font-bold text-xs text-[#1A1A2E] mb-1">Weekly Focus</div>
              <div className="text-[10px] text-[#4A4A5A]">
                Psychological Flexibility: Week 1 Foundation
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[#E8E5DD] hover:border-[#2B5F3F]/30 transition-all">
              <div className="font-bold text-xs text-[#1A1A2E] mb-1">Momentum</div>
              <div className="text-[10px] text-[#4A4A5A]">
                {entries.length > 0
                  ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} so far.`
                  : 'Make your first entry.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {allowVoice && <MicOverlay onVoiceResult={handleVoiceResult} />}
    </div>
  );
}

function SearchView() {
  return (
    <div className="flex-1 bg-[#F7F5F0] overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <h2 className="text-xl font-semibold text-[#1A1A2E] mb-6">Search</h2>
        <SearchBar />
        <div className="mt-6">
          <SearchResults />
        </div>
      </div>
    </div>
  );
}

function TimelineView() {
  const entries = useEntriesStore((s) => s.entries);

  return (
    <div className="flex-1 bg-[#F7F5F0] overflow-y-auto">
      <div className="flex gap-6 px-8 py-8 max-w-5xl mx-auto">
        <div className="flex-1">
          <Timeline />
        </div>
        <div className="w-64 shrink-0">
          <h3 className="text-sm font-medium text-[#1A1A2E] mb-4">Insights</h3>
          <PatternCard entries={entries} />
        </div>
      </div>
    </div>
  );
}

function SettingsView({ onSettingsUpdated }: { onSettingsUpdated: (settings: AppSettings) => void }) {
  const [status, setStatus] = useState<WhisperStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [rtInstalling, setRtInstalling] = useState(false);
  const [rtInstalled, setRtInstalled] = useState(false);
  const [rtInstallProgress, setRtInstallProgress] = useState<string>('');

  const refreshStatus = async (modelOverride?: string) => {
    const current = await window.api.invoke('audio:checkWhisperStatus');
    setStatus(current);
    if (modelOverride) {
      await window.api.invoke('ai:checkOllamaStatus', modelOverride).catch(() => undefined);
    }
  };

  useEffect(() => {
    window.api.invoke('settings:get').then((current) => {
      setSettings(current);
      onSettingsUpdated(current);
      return refreshStatus(current.ollamaModel);
    }).catch(() => {
      setFeedback('Could not load settings.');
    });
    // Check if Python backend is already installed
    window.api.invoke('realtime:isInstalled').then((installed: boolean) => {
      setRtInstalled(installed);
    }).catch(() => undefined);
    // Listen for install progress pushed from main process
    const unsub = window.api.on('realtime:installProgress', (p) => {
      setRtInstallProgress(`${p.percent}% — ${p.message}`);
    });
    return unsub;
  }, [onSettingsUpdated]);

  const handleInstall = async () => {
    setIsInstalling(true);
    setFeedback('Installing Whisper runtime. This can take a minute...');
    try {
      const result = await window.api.invoke('audio:installWhisperRuntime') as WhisperInstallResult;
      setStatus(result.status);
      setFeedback(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback(message);
    } finally {
      setIsInstalling(false);
      await refreshStatus().catch(() => undefined);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleInstallRealtimeBackend = async () => {
    setRtInstalling(true);
    setRtInstallProgress('Starting installation…');
    try {
      const result = await window.api.invoke('realtime:installBackend') as RealtimeInstallResult;
      if (result.success) {
        setRtInstalled(true);
        setRtInstallProgress('Installation complete.');
      } else {
        setRtInstallProgress(`Installation failed: ${result.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      setRtInstallProgress(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRtInstalling(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    setFeedback('Saving settings...');
    try {
      const saved = await window.api.invoke('settings:update', settings) as AppSettings;
      setSettings(saved);
      onSettingsUpdated(saved);
      await refreshStatus(saved.ollamaModel);
      setFeedback('Settings saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback(`Could not save settings: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-[#F7F5F0] overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <h2 className="text-xl font-semibold text-[#1A1A2E] mb-2">AI & Privacy</h2>
        <p className="text-sm text-[#4A4A5A] mb-6">
          Local-only keeps your journal data on this device. Cloud API is optional and opt-in.
        </p>

        {settings && (
          <div className="bg-white border border-[#E8E5DD] rounded-xl p-5 space-y-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-[#1A1A2E]">
                Privacy mode
                <select
                  value={settings.privacyMode}
                  onChange={(e) => updateSetting('privacyMode', e.target.value as AppSettings['privacyMode'])}
                  className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="local_only">Local only (recommended)</option>
                  <option value="allow_cloud">Allow cloud AI providers</option>
                </select>
              </label>
              <label className="text-sm text-[#1A1A2E]">
                Input mode
                <select
                  value={settings.inputMode}
                  onChange={(e) => updateSetting('inputMode', e.target.value as AppSettings['inputMode'])}
                  className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="text_only">Text only</option>
                  <option value="voice_text">Voice + text</option>
                </select>
              </label>
            </div>

            <label className="text-sm text-[#1A1A2E] block">
              AI categorization
              <select
                value={settings.aiProvider}
                onChange={(e) => updateSetting('aiProvider', e.target.value as AppSettings['aiProvider'])}
                className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2 bg-white"
              >
                <option value="off">Off (manual journaling only)</option>
                <option value="ollama">Local Ollama</option>
                <option value="cloud">Cloud API</option>
              </select>
            </label>

            {settings.aiProvider === 'ollama' && (
              <label className="text-sm text-[#1A1A2E] block">
                Ollama model
                <input
                  value={settings.ollamaModel}
                  onChange={(e) => updateSetting('ollamaModel', e.target.value)}
                  className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2"
                  placeholder="llama3.2:1b"
                />
              </label>
            )}

            {settings.aiProvider === 'cloud' && (
              <div className="space-y-3">
                {settings.privacyMode !== 'allow_cloud' && (
                  <p className="text-xs text-amber-700">
                    Cloud AI is currently blocked by privacy mode. Switch privacy mode to "Allow cloud AI providers" to enable cloud calls.
                  </p>
                )}
                <label className="text-sm text-[#1A1A2E] block">
                  Cloud endpoint
                  <input
                    value={settings.cloudEndpoint ?? ''}
                    onChange={(e) => updateSetting('cloudEndpoint', e.target.value)}
                    className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2"
                    placeholder="https://api.openai.com/v1/chat/completions"
                  />
                </label>
                <label className="text-sm text-[#1A1A2E] block">
                  Cloud model
                  <input
                    value={settings.cloudModel ?? ''}
                    onChange={(e) => updateSetting('cloudModel', e.target.value)}
                    className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2"
                    placeholder="gpt-4o-mini"
                  />
                </label>
                <label className="text-sm text-[#1A1A2E] block">
                  API key
                  <input
                    type="password"
                    value={settings.cloudApiKey ?? ''}
                    onChange={(e) => updateSetting('cloudApiKey', e.target.value)}
                    className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2"
                    placeholder="sk-..."
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                isSaving ? 'bg-[#8FA596] cursor-wait' : 'bg-[#2B5F3F] hover:bg-[#234F35]'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save AI & Privacy Settings'}
            </button>
          </div>
        )}

        <h2 className="text-xl font-semibold text-[#1A1A2E] mb-2">Voice Transcription</h2>
        <p className="text-sm text-[#4A4A5A] mb-6">
          Install Whisper once to enable automatic voice transcription for all users of this app profile.
        </p>

        <div className="bg-white border border-[#E8E5DD] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1A1A2E]">Whisper Status</p>
              <p className={`text-sm ${status?.ready ? 'text-[#2B5F3F]' : 'text-amber-700'}`}>
                {status?.ready ? 'Ready' : 'Not configured'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refreshStatus().catch(() => setFeedback('Could not refresh Whisper status.'))}
              className="px-3 py-1.5 text-xs rounded-lg border border-[#D8D4C8] hover:bg-[#F7F5F0] transition-colors"
            >
              Recheck
            </button>
          </div>

          <div className="text-xs text-[#4A4A5A] space-y-1">
            <p><strong>CLI:</strong> {status?.cliFound ? 'Found' : 'Missing'}</p>
            <p><strong>Model:</strong> {status?.modelFound ? 'Found' : 'Missing'}</p>
            {status?.remediation && <p>{status.remediation}</p>}
          </div>

          <button
            type="button"
            onClick={handleInstall}
            disabled={isInstalling}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              isInstalling ? 'bg-[#8FA596] cursor-wait' : 'bg-[#2B5F3F] hover:bg-[#234F35]'
            }`}
          >
            {isInstalling ? 'Installing...' : status?.ready ? 'Repair / Reinstall Whisper' : 'Install Whisper'}
          </button>

          {feedback && (
            <p className="text-xs text-[#4A4A5A] bg-[#F7F5F0] border border-[#E8E5DD] rounded-lg px-3 py-2">
              {feedback}
            </p>
          )}
        </div>

        {/* ── Real-time Transcription ── */}
        <h2 className="text-xl font-semibold text-[#1A1A2E] mt-10 mb-2">Real-time Transcription</h2>
        <p className="text-sm text-[#4A4A5A] mb-6">
          Uses <strong>faster-whisper</strong> (Python) for live, word-by-word dictation straight into your entry.
          Requires a one-time install of Python dependencies (~500 MB with CPU model weights).
          All processing stays on your device.
        </p>

        <div className="bg-white border border-[#E8E5DD] rounded-xl p-5 space-y-4">
          {/* Enable toggle */}
          {settings && (
            <label className="flex items-center gap-3 text-sm text-[#1A1A2E] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.realtimeTranscription}
                onChange={(e) => updateSetting('realtimeTranscription', e.target.checked)}
                className="w-4 h-4 accent-[#2B5F3F]"
              />
              Enable real-time dictation in the composer
            </label>
          )}

          {/* Model picker */}
          {settings?.realtimeTranscription && (
            <label className="text-sm text-[#1A1A2E] block">
              Whisper model size
              <select
                value={settings.realtimeWhisperModel}
                onChange={(e) => updateSetting('realtimeWhisperModel', e.target.value)}
                className="mt-1 w-full border border-[#D8D4C8] rounded-lg px-3 py-2 bg-white text-sm"
              >
                <option value="tiny.en">tiny.en — fastest, English only (~39 MB)</option>
                <option value="base.en">base.en — better accuracy (~74 MB)</option>
                <option value="small.en">small.en — best quality (~244 MB)</option>
                <option value="tiny">tiny — tiny multilingual</option>
                <option value="base">base — base multilingual</option>
              </select>
            </label>
          )}

          {/* Save button */}
          {settings?.realtimeTranscription && (
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                isSaving ? 'bg-[#8FA596] cursor-wait' : 'bg-[#2B5F3F] hover:bg-[#234F35]'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Real-time Settings'}
            </button>
          )}

          {/* Python backend install */}
          <div className="pt-2 border-t border-[#E8E5DD]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-[#1A1A2E]">Python Backend</p>
                <p className={`text-sm ${rtInstalled ? 'text-[#2B5F3F]' : 'text-amber-700'}`}>
                  {rtInstalled ? 'Installed' : 'Not installed'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.api.invoke('realtime:isInstalled').then((v: boolean) => setRtInstalled(v)).catch(() => undefined);
                }}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#D8D4C8] hover:bg-[#F7F5F0] transition-colors"
              >
                Recheck
              </button>
            </div>
            <button
              type="button"
              onClick={handleInstallRealtimeBackend}
              disabled={rtInstalling}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                rtInstalling ? 'bg-[#8FA596] cursor-wait' : 'bg-[#2B5F3F] hover:bg-[#234F35]'
              }`}
            >
              {rtInstalling ? 'Installing…' : rtInstalled ? 'Repair / Reinstall Backend' : 'Install Python Backend'}
            </button>
            {rtInstallProgress && (
              <p className="mt-2 text-xs text-[#4A4A5A] bg-[#F7F5F0] border border-[#E8E5DD] rounded-lg px-3 py-2">
                {rtInstallProgress}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
