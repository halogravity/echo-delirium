import React from 'react';
import { X, Skull, Brain, Music2, Waves, Zap, Headphones } from 'lucide-react';

interface ManualProps {
  isOpen: boolean;
  onClose: () => void;
}

const Manual: React.FC<ManualProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative max-w-4xl w-full max-h-[80vh] overflow-y-auto bg-black/90 border border-red-900/20 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-red-500/70 hover:text-red-500 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <Skull className="w-8 h-8 text-red-500" />
            <h2 className="text-xl font-thin text-red-500 tracking-wider">Echo Delirium Manual</h2>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4" />
                Neural Audio Engine
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  Echo Delirium uses advanced neural networks to transform your audio into nightmarish soundscapes. The engine analyzes incoming audio in real-time, identifying patterns and applying various transformations based on your settings.
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Record audio using the built-in recorder</li>
                  <li>Apply neural processing with the Nightmare Engine controls</li>
                  <li>Adjust Terror, Madness, and Descent parameters for different effects</li>
                  <li>Watch the neural activity visualization respond to your audio</li>
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
                  The built-in sequencer allows you to create rhythmic patterns and melodies using your processed sounds.
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Add drum, bass, and poly synth tracks</li>
                  <li>Set BPM and swing amount</li>
                  <li>Create patterns up to 64 steps</li>
                  <li>Use the virtual keyboard to play sounds live</li>
                  <li>Apply effects like filter, delay, and reverb per track</li>
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
                  Each track features a comprehensive effects chain for shaping your sound:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Filter with resonance control</li>
                  <li>Multi-mode distortion</li>
                  <li>Delay with feedback</li>
                  <li>Reverb with decay control</li>
                  <li>Chorus/ensemble effects</li>
                  <li>Lo-fi degradation</li>
                  <li>Pitch shifting</li>
                  <li>Granular processing</li>
                  <li>Spectral effects</li>
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
                  The Style System allows you to blend different musical influences:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Choose from multiple style presets</li>
                  <li>Blend up to 3 styles simultaneously</li>
                  <li>Adjust influence and blend amounts</li>
                  <li>Watch the neural network adapt to your style choices</li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-red-500 text-sm font-mono uppercase tracking-wider flex items-center gap-2 mb-4">
                <Headphones className="w-4 h-4" />
                Audio Management
              </h3>
              <div className="prose prose-invert prose-red max-w-none">
                <p className="text-red-300/70">
                  Echo Delirium provides tools for managing your audio content:
                </p>
                <ul className="space-y-2 text-red-300/70">
                  <li>Save and organize recordings</li>
                  <li>Import/export audio files</li>
                  <li>Sample management system</li>
                  <li>Preset saving and loading</li>
                  <li>Track mute, solo, and gate controls</li>
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