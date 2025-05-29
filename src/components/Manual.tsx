import React from 'react';
import { X, Skull, Brain, Music2, Waves, Zap, Headphones, Mic, Save, Settings2, Volume2 } from 'lucide-react';

interface ManualProps {
  isOpen: boolean;
  onClose: () => void;
}

const Manual: React.FC<ManualProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative max-w-4xl w-full max-h-[80vh] overflow-y-auto bg-black/90 border border-red-900/20 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-red-500/70 hover:text-red-500 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="space-y-8">
          {/* App Description */}
          <div className="border-b border-red-900/20 pb-8">
            <div className="flex items-center gap-4 mb-4">
              <Skull className="w-8 h-8 text-red-500" />
              <h2 className="text-xl font-thin text-red-500 tracking-wider">Echo Delirium</h2>
            </div>
            <p className="text-red-300/70 text-lg mb-4">
              A surreal audio experience that transforms ambient sounds into musical instruments using AI-powered sound processing and synthesis.
            </p>
            <p className="text-red-300/70">
              Echo Delirium combines neural audio processing, granular synthesis, and spectral manipulation to create 
              otherworldly soundscapes from your recordings. Use the nightmare engine to induce audio hallucinations,
              apply various musical style influences, and sequence your transformed sounds into rhythmic patterns.
            </p>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Mic className="w-4 h-4" />
                Audio Recorder
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  The Audio Recorder allows you to capture and transform sounds:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Record up to 5 seconds of audio</li>
                  <li>Name and save your recordings</li>
                  <li>Edit recordings with trim, normalize, and reverse functions</li>
                  <li>Use the virtual keyboard to play recordings at different pitches</li>
                  <li>Apply real-time effects processing</li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4" />
                Neural Processing
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  The Nightmare Engine processes audio using neural networks:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Terror: Controls the intensity of audio hallucinations</li>
                  <li>Madness: Adds chaos and unpredictability to the sound</li>
                  <li>Descent: Determines the depth of neural processing layers</li>
                  <li>Watch real-time neural activity visualization</li>
                  <li>Combine with style influences for unique transformations</li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Music2 className="w-4 h-4" />
                Sequencer
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  Create rhythmic patterns and melodies with multiple track types:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Drum Tracks:
                    <ul>
                      <li>Load user samples or recordings</li>
                      <li>Pattern sequencing up to 64 steps</li>
                      <li>Individual track effects processing</li>
                      <li>Mute, solo, and gate controls</li>
                    </ul>
                  </li>
                  <li>Bass Tracks:
                    <ul>
                      <li>Built-in synthesizer with multiple waveforms</li>
                      <li>ADSR envelope and filter controls</li>
                      <li>Scale-based pattern sequencing</li>
                      <li>Preset patterns and sound presets</li>
                    </ul>
                  </li>
                  <li>Poly Tracks:
                    <ul>
                      <li>Polyphonic synthesizer for chords and melodies</li>
                      <li>Multiple oscillator types</li>
                      <li>Advanced modulation options</li>
                      <li>Chord progression sequencing</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Waves className="w-4 h-4" />
                Effects Processing
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  Comprehensive effects chain for each track:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Reality Synthesis:
                    <ul>
                      <li>Filter with frequency and resonance control</li>
                      <li>Multi-mode distortion with mix control</li>
                      <li>Delay with time and feedback parameters</li>
                      <li>Reverb with decay and mix controls</li>
                      <li>Pitch shifting with formant preservation</li>
                    </ul>
                  </li>
                  <li>Advanced Effects:
                    <ul>
                      <li>Chorus ensemble with multiple voices</li>
                      <li>Lo-fi degradation with bit crushing</li>
                      <li>Granular processing controls</li>
                      <li>Spectral warping and shifting</li>
                      <li>Neural modulation system</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4" />
                Style System
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  Blend different musical styles and influences:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Available Styles:
                    <ul>
                      <li>Glitch: Digital artifacts and circuit-bent chaos</li>
                      <li>Drone: Deep resonant harmonics</li>
                      <li>Vapor: Time-stretched, pitch-warped textures</li>
                      <li>Dark: Sub-bass drones and ominous resonances</li>
                      <li>Ritual: Ancient harmonics and mystical frequencies</li>
                      <li>Spectral: Crystalline harmonics and shimmering</li>
                      <li>Cosmic: Interstellar drones and quantum fluctuations</li>
                      <li>Necro: Undead harmonics and sepulchral resonance</li>
                    </ul>
                  </li>
                  <li>Style Controls:
                    <ul>
                      <li>Blend up to 3 compatible styles</li>
                      <li>Adjust influence amount per style</li>
                      <li>Control overall style blend intensity</li>
                      <li>Watch real-time neural adaptation</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Save className="w-4 h-4" />
                Content Management
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  Tools for managing your audio content:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Recordings:
                    <ul>
                      <li>Save and organize recorded audio</li>
                      <li>Edit recordings with built-in tools</li>
                      <li>Download recordings as WAV files</li>
                      <li>Use recordings as samples in the sequencer</li>
                    </ul>
                  </li>
                  <li>Samples:
                    <ul>
                      <li>Upload custom audio samples</li>
                      <li>Organize samples by type</li>
                      <li>Access built-in sample library</li>
                      <li>Preview samples before use</li>
                    </ul>
                  </li>
                  <li>Presets:
                    <ul>
                      <li>Save effect parameter combinations</li>
                      <li>Export and import presets</li>
                      <li>Quick access to common settings</li>
                      <li>Share presets between projects</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4" />
                Global Controls
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  Project-wide settings and controls:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Tempo:
                    <ul>
                      <li>Adjust BPM from 20 to 300</li>
                      <li>Control swing amount</li>
                      <li>Set step resolution (4-64 steps)</li>
                    </ul>
                  </li>
                  <li>Track Management:
                    <ul>
                      <li>Add/remove tracks</li>
                      <li>Adjust track volumes</li>
                      <li>Set track effects</li>
                      <li>Configure routing</li>
                    </ul>
                  </li>
                  <li>Project Features:
                    <ul>
                      <li>Save and load projects</li>
                      <li>Export audio</li>
                      <li>Backup settings</li>
                      <li>Share configurations</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Manual;