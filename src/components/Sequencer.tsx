import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Square, Save, Upload, Download, Settings, Plus, Trash2, Music2, Volume2, AudioWaveform as Waveform, AlertCircle, RefreshCw, Loader2, Headphones, Volume, VolumeX, Filter, Clock, Waves, ChevronDown, ChevronRight } from 'lucide-react';
import BassTrack, { BassTrackRef } from './BassTrack';
import PolyTrack, { PolyTrackRef } from './PolyTrack';
import { supabase } from '../lib/supabase';
import { getSampleUrl } from '../lib/samples';
import retry from 'retry';

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

  const calculateDelayTime = (bpm: number): number => {
    const secondsPerBeat = 60 / bpm;
    return secondsPerBeat / 2;
  };

  const loadTrackSample = async (track: Track) => {
    if (!track.samplePath || track.type === 'bass' || track.type === 'poly') return;

    try {
      const operation = retry.operation({
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        randomize: true
      });

      return new Promise((resolve, reject) => {
        operation.attempt(async (currentAttempt) => {
          try {
            setTracks(prev => prev.map(t => 
              t.id === track.id ? {
                ...t,
                loadProgress: {
                  status: currentAttempt > 1 ? 'retrying' : 'loading',
                  attempt: currentAttempt,
                  message: currentAttempt > 1 ? `Retrying (${currentAttempt}/3)...` : 'Loading sample...'
                }
              } : t
            ));

            const url = track.samplePath!.startsWith('/samples/')
              ? track.samplePath
              : await getSampleUrl(track.samplePath!);

            if (!url) throw new Error('Failed to get sample URL');

            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch audio file: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);

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
              url: audioBuffer,
              onload: () => {
                setTracks(prev => prev.map(t => 
                  t.id === track.id ? {
                    ...t,
                    loadError: undefined,
                    loadProgress: undefined
                  } : t
                ));
                resolve(true);
              },
              onerror: (error) => {
                console.error(`Error loading sample for ${track.name}:`, error);
                if (operation.retry(error)) {
                  return;
                }
                reject(operation.mainError());
              }
            }).connect(filter);

            player.volume.value = track.volume;
            players.current.set(track.id, player);

          } catch (error) {
            console.error('Error in attempt:', error);
            if (operation.retry(error as Error)) {
              return;
            }
            reject(operation.mainError());
          }
        });
      });
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
      throw error;
    }
  };

  // Rest of the component implementation remains the same...
  
  return (
    // Component JSX remains the same...
  );
};

export default Sequencer;