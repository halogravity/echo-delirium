import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Square, Save, Upload, Download, Settings, Plus, Trash2, Music2, Volume2, AudioWaveform as Waveform, AlertCircle, RefreshCw, Loader2, Headphones, Volume, VolumeX, Filter, Clock, Waves, ChevronDown, ChevronRight } from 'lucide-react';
import BassTrack, { BassTrackRef } from './BassTrack';
import PolyTrack, { PolyTrackRef } from './PolyTrack';
import { supabase } from '../lib/supabase';
import { getSampleUrl } from '../lib/samples';

interface Track {
  id: string;
  name: string;
  type: 'drum' | 'bass' | 'poly';
  pattern: boolean[];
  samplePath?: string;
  volume: number;
  pan: number;
  effects: {
    filter: number;
    resonance: number;
    delay: number;
    reverb: number;
  };
  muted: boolean;
  soloed: boolean;
  gated: boolean;
  collapsed?: boolean;
  loadError?: string;
  loadProgress?: {
    status: 'loading' | 'retrying' | 'failed';
    attempt: number;
    message: string;
  };
}

interface Recording {
  id: string;
  name: string;
  storage_path: string;
  created_at: string;
}

interface Sample {
  id: string;
  name: string;
  storage_path: string;
  type: string;
  created_at: string;
  user_id?: string | null;
}

const STEP_OPTIONS = [4, 8, 16, 32, 64] as const;
type StepAmount = typeof STEP_OPTIONS[number];

const Sequencer: React.FC = () => {
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [showEffects, setShowEffects] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [userSamples, setUserSamples] = useState<Sample[]>([]);
  const [userRecordings, setUserRecordings] = useState<Recording[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState<{ [key: string]: boolean }>({});
  const [stepAmount, setStepAmount] = useState<StepAmount>(16);

  const players = useRef(new Map<string, Tone.Player>());
  const filters = useRef(new Map<string, Tone.Filter>());
  const delays = useRef(new Map<string, Tone.FeedbackDelay>());
  const reverbs = useRef(new Map<string, Tone.Reverb>());
  const repeatId = useRef<number | null>(null);
  const currentStepRef = useRef(0);
  const tracksRef = useRef<Track[]>([]);
  const bassRef = useRef<BassTrackRef>(null);
  const polyRefs = useRef<Map<string, PolyTrackRef>>(new Map());

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const handleStepAmountChange = (steps: number) => {
    setStepAmount(steps as StepAmount);
    setTracks(prevTracks => prevTracks.map(track => ({
      ...track,
      pattern: track.pattern.length > steps 
        ? track.pattern.slice(0, steps)
        : [...track.pattern, ...Array(steps - track.pattern.length).fill(false)]
    })));
  };

  useEffect(() => {
    setTracks(prevTracks => prevTracks.map(track => ({
      ...track,
      pattern: track.pattern.length > stepAmount 
        ? track.pattern.slice(0, stepAmount)
        : [...track.pattern, ...Array(stepAmount - track.pattern.length).fill(false)]
    })));
  }, [stepAmount]);

  useEffect(() => {
    const initializeSequencer = async () => {
      try {
        setLoadingMessage('Initializing audio engine...');
        await Tone.start();
        await Tone.loaded();
        Tone.Transport.bpm.value = bpm;
        Tone.Transport.swing = swing;

        await loadUserContent();

        const defaultTracks: Track[] = [
          {
            id: 'kick',
            name: 'Kick',
            type: 'drum',
            pattern: Array(stepAmount).fill(false),
            samplePath: '/samples/kick.mp3',
            volume: 0,
            pan: 0,
            effects: { filter: 20000, resonance: 1, delay: 0, reverb: 0 },
            muted: false,
            soloed: false,
            gated: false,
            collapsed: true
          },
          {
            id: 'bass',
            name: 'Bass',
            type: 'bass',
            pattern: Array(stepAmount).fill(false),
            volume: 0,
            pan: 0,
            effects: { filter: 20000, resonance: 1, delay: 0, reverb: 0 },
            muted: false,
            soloed: false,
            gated: false,
            collapsed: false
          }
        ];

        await Promise.all(defaultTracks.map(track => loadTrackSample(track)));
        
        setTracks(defaultTracks);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing:', error);
        setLoadingMessage('Error initializing audio engine. Please refresh.');
      }
    };

    initializeSequencer();

    return () => {
      stopSequencer();
      disposePlayers();
    };
  }, []);

  const loadUserContent = async () => {
    try {
      setLoadingMessage('Loading samples...');
      
      const [samplesResult, defaultSamplesResult, recordingsResult] = await Promise.all([
        supabase.from('samples').select('*').order('created_at', { ascending: false }),
        supabase.from('default_samples').select('*').order('created_at', { ascending: false }),
        supabase.from('recordings').select('*').order('created_at', { ascending: false })
      ]);

      if (samplesResult.error) throw samplesResult.error;
      if (defaultSamplesResult.error) throw defaultSamplesResult.error;
      if (recordingsResult.error) throw recordingsResult.error;

      setUserSamples([
        ...(samplesResult.data || []),
        ...(defaultSamplesResult.data || []).map(sample => ({ ...sample, user_id: null }))
      ]);
      setUserRecordings(recordingsResult.data || []);
    } catch (error) {
      console.error('Error loading user content:', error);
      throw error;
    }
  };

  const loadTrackSample = async (track: Track) => {
    if (!track.samplePath || track.type === 'bass' || track.type === 'poly') return;

    try {
      setTracks(prev => prev.map(t => 
        t.id === track.id ? {
          ...t,
          loadProgress: {
            status: 'loading',
            attempt: 0,
            message: 'Loading sample...'
          }
        } : t
      ));

      let urlToLoad = track.samplePath;

      // If it's a local sample from the /samples directory, fetch its content first
      if (track.samplePath.startsWith('/samples/')) {
        try {
          const response = await fetch(track.samplePath);
          if (!response.ok) throw new Error('Failed to load sample file');
          urlToLoad = await response.text();
        } catch (error) {
          console.error('Error loading local sample:', error);
          throw new Error('Failed to load local sample');
        }
      } else {
        // For user samples, get the URL from storage
        urlToLoad = await getSampleUrl(track.samplePath);
      }

      if (!urlToLoad) throw new Error('Failed to get sample URL');

      const filter = new Tone.Filter({
        frequency: track.effects.filter,
        type: "lowpass",
        Q: track.effects.resonance
      });

      const delay = new Tone.FeedbackDelay({
        delayTime: calculateDelayTime(bpm) * track.effects.delay,
        feedback: 0.3,
        wet: track.effects.delay
      });

      const reverb = new Tone.Reverb({
        decay: 2,
        wet: track.effects.reverb
      });

      filter.connect(delay);
      delay.connect(reverb);
      reverb.toDestination();

      filters.current.set(track.id, filter);
      delays.current.set(track.id, delay);
      reverbs.current.set(track.id, reverb);

      const player = new Tone.Player({
        url: urlToLoad,
        onload: () => {
          setTracks(prev => prev.map(t => 
            t.id === track.id ? {
              ...t,
              loadError: undefined,
              loadProgress: undefined
            } : t
          ));
        },
        onerror: (error) => {
          console.error(`Error loading sample for ${track.name}:`, error);
          setTracks(prev => prev.map(t => 
            t.id === track.id ? {
              ...t,
              loadError: 'Failed to load sample',
              loadProgress: {
                status: 'failed',
                attempt: 0,
                message: 'Failed to load sample. Click to retry.'
              }
            } : t
          ));
        }
      }).connect(filter);

      player.volume.value = track.volume;

      players.current.set(track.id, player);
    } catch (error) {
      console.error('Error loading track sample:', error);
      setTracks(prev => prev.map(t => 
        t.id === track.id ? {
          ...t,
          loadError: 'Failed to load sample',
          loadProgress: {
            status: 'failed',
            attempt: 0,
            message: 'Failed to load sample. Click to retry.'
          }
        } : t
      ));
    }
  };

  const calculateDelayTime = (bpm: number): number => {
    const secondsPerBeat = 60 / bpm;
    return secondsPerBeat / 2;
  };

  useEffect(() => {
    const delayTime = calculateDelayTime(bpm);
    delays.current.forEach(delay => {
      delay.delayTime.rampTo(delayTime, 0.1);
    });
  }, [bpm]);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    Tone.Transport.swing = swing;
  }, [swing]);

  const startSequencer = async () => {
    if (isPlaying) {
      stopSequencer();
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Starting sequencer...');

    try {
      await Tone.start();

      const loadPromises = tracks.map(track => {
        if (track.type === 'drum' && track.samplePath && !players.current.has(track.id)) {
          return loadTrackSample(track);
        }
        return Promise.resolve();
      });

      await Promise.all(loadPromises);

      setIsPlaying(true);
      setCurrentStep(0);
      currentStepRef.current = 0;

      const repeat = (time: number) => {
        const activeTracks = tracksRef.current.filter(track => {
          if (track.muted) return false;
          const hasSoloedTracks = tracksRef.current.some(t => t.soloed);
          return !hasSoloedTracks || track.soloed;
        });

        activeTracks.forEach(track => {
          if (track.type === 'drum') {
            if (track.pattern[currentStepRef.current]) {
              const player = players.current.get(track.id);
              if (player && player.loaded) {
                const stepDuration = Tone.Time('16n').toSeconds();
                if (track.gated) {
                  player.start(time).stop(time + stepDuration);
                } else {
                  player.start(time);
                }
              }
            }
          } else if (track.type === 'bass' && bassRef.current) {
            bassRef.current.playStep(currentStepRef.current, time);
          } else if (track.type === 'poly') {
            const polyRef = polyRefs.current.get(track.id);
            if (polyRef) {
              polyRef.playStep(currentStepRef.current, time);
            }
          }
        });

        currentStepRef.current = (currentStepRef.current + 1) % stepAmount;
        setCurrentStep(currentStepRef.current);
      };

      repeatId.current = Tone.Transport.scheduleRepeat(repeat, '16n');
      Tone.Transport.start();
    } catch (error) {
      console.error('Error starting sequencer:', error);
      stopSequencer();
    } finally {
      setIsLoading(false);
    }
  };

  const stopSequencer = () => {
    setIsPlaying(false);
    Tone.Transport.stop();
    if (repeatId.current !== null) {
      Tone.Transport.clear(repeatId.current);
      repeatId.current = null;
    }
    setCurrentStep(0);
    currentStepRef.current = 0;

    players.current.forEach(player => {
      if (player.state === 'started') {
        player.stop();
      }
    });

    if (bassRef.current) {
      bassRef.current.stop();
    }

    polyRefs.current.forEach(ref => {
      ref.stop();
    });
  };

  const disposePlayers = () => {
    players.current.forEach(player => {
      player.stop();
      player.dispose();
    });
    players.current.clear();

    filters.current.forEach(filter => filter.dispose());
    filters.current.clear();

    delays.current.forEach(delay => delay.dispose());
    delays.current.clear();

    reverbs.current.forEach(reverb => reverb.dispose());
    reverbs.current.clear();
  };

  const toggleStep = (trackId: string, step: number) => {
    setTracks(tracks.map(track => {
      if (track.id === trackId) {
        const newPattern = [...track.pattern];
        newPattern[step] = !newPattern[step];
        return { ...track, pattern: newPattern };
      }
      return track;
    }));
  };

  const handleAddTrack = (type: Track['type']) => {
    const id = `track-${Date.now()}`;
    const newTrack: Track = {
      id,
      name: type === 'poly' ? 'Poly Synth' : `Track ${tracks.length + 1}`,
      type,
      pattern: Array(stepAmount).fill(false),
      volume: 0,
      pan: 0,
      effects: { filter: 20000, resonance: 1, delay: 0, reverb: 0 },
      muted: false,
      soloed: false,
      gated: false,
      collapsed: false
    };

    setTracks([...tracks, newTrack]);
  };

  const removeTrack = (trackId: string) => {
    const player = players.current.get(trackId);
    if (player) {
      player.stop();
      player.dispose();
      players.current.delete(trackId);
    }

    const filter = filters.current.get(trackId);
    if (filter) {
      filter.dispose();
      filters.current.delete(trackId);
    }

    const delay = delays.current.get(trackId);
    if (delay) {
      delay.dispose();
      delays.current.delete(trackId);
    }

    const reverb = reverbs.current.get(trackId);
    if (reverb) {
      reverb.dispose();
      reverbs.current.delete(trackId);
    }

    setTracks(tracks.filter(track => track.id !== trackId));
  };

  const handleSelectSample = async (trackId: string, sampleId: string, type: 'sample' | 'recording') => {
    try {
      setLoadingSamples(prev => ({ ...prev, [trackId]: true }));
      const trackToUpdate = tracks.find(t => t.id === trackId);
      if (!trackToUpdate) return;
      
      let storagePath = '';
      let name = '';
      
      if (type === 'sample') {
        const sample = userSamples.find(s => s.id === sampleId);
        if (!sample) return;
        storagePath = sample.storage_path;
        name = sample.name;
      } else {
        const recording = userRecordings.find(r => r.id === sampleId);
        if (!recording) return;
        storagePath = recording.storage_path;
        name = recording.name;
      }

      const existingPlayer = players.current.get(trackId);
      if (existingPlayer) {
        existingPlayer.stop();
        existingPlayer.dispose();
        players.current.delete(trackId);
      }
      
      const updatedTrack = {
        ...trackToUpdate,
        samplePath: storagePath,
        name: trackToUpdate.name === name ? name : trackToUpdate.name
      };

      setTracks(prev => prev.map(t => 
        t.id === trackId ? updatedTrack : t
      ));

      if (isPlaying) {
        await loadTrackSample(updatedTrack);
      }
      
    } catch (error) {
      console.error('Error selecting sample:', error);
      setTracks(prev => prev.map(t => 
        t.id === trackId ? {
          ...t,
          loadError: 'Failed to load sample',
          loadProgress: {
            status: 'failed',
            attempt: 0,
            message: 'Failed to load sample. Click to retry.'
          }
        } : t
      ));
    } finally {
      setLoadingSamples(prev => ({ ...prev, [trackId]: false }));
    }
  };

  const handleUploadSample = async (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `samples/${(await supabase.auth.getUser()).data.user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('echobucket')
        .upload(filePath, file, {
          contentType: 'audio/wav',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data, error: metadataError } = await supabase
        .from('samples')
        .insert([
          {
            name: file.name.replace('.wav', ''),
            storage_path: filePath,
            type
          }
        ])
        .select()
        .single();

      if (metadataError) throw metadataError;

      setUserSamples(prev => [data, ...prev]);
    } catch (error) {
      console.error('Error uploading sample:', error);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleVolumeChange = async (trackId: string, volume: number) => {
    const player = players.current.get(trackId);
    if (player) {
      player.volume.value = volume;
    }

    setTracks(prev => prev.map(t =>
      t.id === trackId ? { ...t, volume } : t
    ));
  };

  const handleEffectChange = (trackId: string, effect: keyof Track['effects'], value: number) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    switch (effect) {
      case 'filter':
        const filter = filters.current.get(trackId);
        if (filter) filter.frequency.value = value;
        break;
      case 'resonance':
        const resFilter = filters.current.get(trackId);
        if (resFilter) resFilter.Q.value = value;
        break;
      case 'delay':
        const delay = delays.current.get(trackId);
        if (delay) {
          const baseDelayTime = calculateDelayTime(bpm);
          delay.delayTime.value = baseDelayTime * value;
          delay.wet.value = value;
        }
        break;
      case 'reverb':
        const reverb = reverbs.current.get(trackId);
        if (reverb) reverb.wet.value = value;
        break;
    }

    setTracks(prev => prev.map(t =>
      t.id === trackId
        ? { ...t, effects: { ...t.effects, [effect]: value } }
        : t
    ));
  };

  const toggleTrackMute = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, muted: !track.muted } : track
    ));
  };

  const toggleTrackSolo = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, soloed: !track.soloed } : track
    ));
  };

  const toggleTrackGate = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, gated: !track.gated } : track
    ));
  };

  const toggleTrackCollapse = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, collapsed: !track.collapsed } : track
    ));
  };

  return (
    <div className="min-h-screen bg-black/40 relative">
      <div className="fixed top-16 left-0 right-0 z-40 bg-black/95 border-b border-red-900/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={startSequencer}
                disabled={isLoading}
                className={`
                  flex items-center gap-2 px-4 py-2 transition-colors relative overflow-hidden
                  ${isLoading
                    ? 'bg-red-900/20 border-red-900/30 text-red-500/50 cursor-not-allowed'
                    : isPlaying
                      ? 'bg-red-900/40 border-red-600/50 text-red-500'
                      : 'bg-red-900/20 border border-red-900/50 text-red-500 hover:bg-red-900/30'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : isPlaying ? (
                  <>
                    <Square className="w-4 h-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Play
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-red-500/70 text-sm font-mono">BPM:</span>
                <input
                  type="number"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-16 bg-black/30 border border-red-900/30 text-red-200 px-2 py-1 text-sm font-mono"
                  min="20"
                  max="300"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-red-500/70 text-sm font-mono">Steps:</span>
                <select
                  value={stepAmount}
                  onChange={(e) => handleStepAmountChange(parseInt(e.target.value))}
                  className="bg-black/30 border border-red-900/30 text-red-200 px-2 py-1 text-sm font-mono"
                >
                  {STEP_OPTIONS.map(amount => (
                    <option key={amount} value={amount}>{amount}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-red-500/70 text-sm font-mono">Swing:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={swing}
                  onChange={(e) => setSwing(parseFloat(e.target.value))}
                  className="w-24 accent-red-500"
                />
                <span className="text-red-500/50 text-xs font-mono">
                  {Math.round(swing * 100)}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddTrack('drum')}
                className="flex items-center gap-2 px-3 py-1 text-xs font-mono text-red-500/70 hover:text-red-500 transition-colors border border-red-900/20 hover:border-red-900/40"
              >
                <Plus className="w-4 h-4" />
                Drum
              </button>
              <button
                onClick={() => handleAddTrack('bass')}
                className="flex items-center gap-2 px-3 py-1 text-xs font-mono text-red-500/70 hover:text-red-500 transition-colors border border-red-900/20 hover:border-red-900/40"
              >
                <Plus className="w-4 h-4" />
                Bass
              </button>
              <button
                onClick={() => handleAddTrack('poly')}
                className="flex items-center gap-2 px-3 py-1 text-xs font-mono text-red-500/70 hover:text-red-500 transition-colors border border-red-900/20 hover:border-red-900/40"
              >
                <Plus className="w-4 h-4" />
                Poly
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-40 px-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-red-500 font-mono">{loadingMessage}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {tracks.map(track => (
              <div key={track.id} className="flex gap-4">
                <div className="w-64 bg-black/20 border border-red-900/20 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTrackCollapse(track.id)}
                        className="text-red-500/50 hover:text-red-500 transition-colors"
                      >
                        {track.collapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="text"
                        value={track.name}
                        onChange={(e) => setTracks(tracks.map(t => 
                          t.id === track.id ? { ...t, name: e.target.value } : t
                        ))}
                        className="bg-transparent text-red-300 font-mono text-sm border-b border-red-900/20 focus:outline-none focus:border-red-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => toggleTrackMute(track.id)}
                      className={`p-1 transition-colors ${
                        track.muted
                          ? 'text-red-500'
                          : 'text-red-500/50 hover:text-red-500'
                      }`}
                      title={track.muted ? 'Unmute' : 'Mute'}
                    >
                      {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleTrackSolo(track.id)}
                      className={`p-1 transition-colors ${
                        track.soloed
                          ? 'text-red-500'
                          : 'text-red-500/50 hover:text-red-500'
                      }`}
                      title={track.soloed ? 'Unsolo' : 'Solo'}
                    >
                      <Headphones className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleTrackGate(track.id)}
                      className={`p-1 transition-colors ${
                        track.gated
                          ? 'text-red-500'
                          : 'text-red-500/50 hover:text-red-500'
                      }`}
                      title={track.gated ? 'Disable Gate' : 'Enable Gate'}
                    >
                      <Music2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeTrack(track.id)}
                      className="p-1 text-red-500/50 hover:text-red-500 transition-colors"
                      title="Delete Track"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {track.loadProgress && (
                    <div className={`mb-4 p-2 text-xs font-mono ${
                      track.loadProgress.status === 'failed'
                        ? 'bg-red-900/20  border border-red-500/30 text-red-500'
                        : 'bg-red-900/10 border border-red-500/20 text-red-500/70'
                    }`}>
                      <div className="flex items-center gap-2">
                        {track.loadProgress.status === 'loading' && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {track.loadProgress.message}
                      </div>
                    </div>
                  
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <Volume2 className="w-4 h-4 text-red-500/50" />
                    <input
                      type="range"
                      min="-60"
                      max="0"
                      value={track.volume}
                      onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                      className="w-full accent-red-500"
                    />
                  </div>

                  {!track.collapsed && (
                    <>
                      <div className="space-y-4 border-t border-red-900/20 pt-4">
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-red-500/50" />
                          <div className="flex-1">
                            <input
                              type="range"
                              min="20"
                              max="20000"
                              value={track.effects.filter}
                              onChange={(e) => handleEffectChange(track.id, 'filter', parseFloat(e.target.value))}
                              className="w-full accent-red-500"
                            />
                            <div className="text-xs font-mono text-red-500/50 mt-1">
                              Filter: {track.effects.filter}Hz
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-red-500/50" />
                          <div className="flex-1">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={track.effects.delay}
                              onChange={(e) => handleEffectChange(track.id, 'delay', parseFloat(e.target.value))}
                              className="w-full accent-red-500"
                            />
                            <div className="text-xs font-mono text-red-500/50 mt-1">
                              Delay: {Math.round(track.effects.delay * 100)}%
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Waves className="w-4 h-4 text-red-500/50" />
                          <div className="flex-1">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={track.effects.reverb}
                              onChange={(e) => handleEffectChange(track.id, 'reverb', parseFloat(e.target.value))}
                              className="w-full accent-red-500"
                            />
                            <div className="text-xs font-mono text-red-500/50 mt-1">
                              Reverb: {Math.round(track.effects.reverb * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {track.type === 'drum' && (
                        <div className="mt-4">
                          <div className="text-xs font-mono text-red-500/70 mb-2">User Samples</div>
                          <div className="relative">
                            <select
                              value=""
                              onChange={(e) => e.target.value && handleSelectSample(track.id, e.target.value, 'sample')}
                              className={`w-full bg-black/30 border border-red-900/30 text-red-200 px-2 py-1 text-xs font-mono mb-2 ${
                                loadingSamples[track.id] ? 'opacity-50' : ''
                              }`}
                              disabled={loadingSamples[track.id]}
                            >
                              <option value="">-- Select Sample --</option>
                              {userSamples.map(sample => (
                                <option key={sample.id} value={sample.id}>{sample.name}</option>
                              ))}
                            </select>
                            {loadingSamples[track.id] && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="text-xs font-mono text-red-500/70 mb-2">Recordings</div>
                          <div className="relative">
                            <select
                              value=""
                              onChange={(e) => e.target.value && handleSelectSample(track.id, e.target.value, 'recording')}
                              className={`w-full bg-black/30 border border-red-900/30 text-red-200 px-2 py-1 text-xs font-mono ${
                                loadingSamples[track.id] ? 'opacity-50' : ''
                              }`}
                              disabled={loadingSamples[track.id]}
                            >
                              <option value="">-- Select Recording --</option>
                              {userRecordings.map(recording => (
                                <option key={recording.id} value={recording.id}>{recording.name}</option>
                              ))}
                            </select>
                          </div>

                          <label className="flex items-center gap-2 px-3 py-1 mt-2 text-xs font-mono text-red-500/70 hover:text-red-500 transition-colors border border-red-900/20 hover:border-red-900/40 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            {isUploading ? 'Uploading...' : 'Upload Sample'}
                            <input
                              type="file"
                              accept=".wav"
                              className="hidden"
                              onChange={(e) => handleUploadSample(e, 'drum')}
                              disabled={isUploading}
                            />
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {track.type === 'bass' ? (
                  <div className="flex-1">
                    <BassTrack
                      ref={bassRef}
                      currentStep={currentStep}
                      stepAmount={stepAmount}
                    />
                  </div>
                ) : track.type === 'poly' ? (
                  <div className="flex-1">
                    <PolyTrack
                      ref={(ref) => {
                        if (ref) {
                          polyRefs.current.set(track.id, ref);
                        } else {
                          polyRefs.current.delete(track.id);
                        }
                      }}
                      currentStep={currentStep}
                      stepAmount={stepAmount}
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="overflow-x-auto">
                      <div 
                        className="inline-flex gap-1 min-w-full" 
                        style={{ width: `max(100%, ${stepAmount * 40}px)` }}
                      >
                        {track.pattern.map((isActive, step) => (
                          <button
                            key={step}
                            onClick={() => toggleStep(track.id, step)}
                            className={`
                              w-10 h-12 border transition-colors relative
                              ${step === currentStep && isPlaying
                                ? 'border-red-500 bg-red-900/20'
                                : isActive
                                  ? 'bg-red-800/50 border-red-400/70 hover:bg-red-700/50'
                                  : 'border-red-500/40 hover:border-red-400/70'
                              }
                              ${step % 4 === 0 ? 'border-l-2 border-l-red-500/60' : ''}
                            `}
                          >
                            {step % 4 === 0 && (
                              <div className="absolute -top-6 left-0 text-xs font-mono text-red-500/50">
                                {step + 1}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }

        .overflow-x-auto::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: rgba(220, 38, 38, 0.3);
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(220, 38, 38, 0.5);
        }
      `}</style>
    </div>
  );
};

export default Sequencer;