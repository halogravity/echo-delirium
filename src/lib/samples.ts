import * as Tone from 'tone';

// Use direct URLs for samples instead of local files
export const SAMPLE_URLS = {
  kick: 'https://tonejs.github.io/audio/drum-samples/808/kick.wav',
  snare: 'https://tonejs.github.io/audio/drum-samples/808/snare.wav',
  hihat: 'https://tonejs.github.io/audio/drum-samples/808/hihat.wav',
  bass: 'https://tonejs.github.io/audio/drum-samples/808/bass.wav',
  sub: 'https://tonejs.github.io/audio/drum-samples/808/sub.wav'
} as const;

export type SampleName = keyof typeof SAMPLE_URLS;

// Create a map to store loaded samples
const samplePlayers = new Map<SampleName, Tone.Player>();

// Function to load a sample
export async function loadSample(name: SampleName): Promise<Tone.Player> {
  // Check if sample is already loaded
  const existingPlayer = samplePlayers.get(name);
  if (existingPlayer) {
    return existingPlayer;
  }

  // Create new player with the URL
  const player = new Tone.Player({
    url: SAMPLE_URLS[name],
    onload: () => {
      console.log(`Loaded sample: ${name}`);
    },
    onerror: (error) => {
      console.error(`Error loading sample ${name}:`, error);
    }
  }).toDestination();

  // Store the player
  samplePlayers.set(name, player);
  
  // Wait for player to load
  await player.loaded();
  
  return player;
}

// Function to get a loaded sample
export function getSample(name: SampleName): Tone.Player | undefined {
  return samplePlayers.get(name);
}

// Function to load all samples
export async function loadAllSamples(): Promise<void> {
  const loadPromises = Object.keys(SAMPLE_URLS).map(name => 
    loadSample(name as SampleName)
  );
  
  await Promise.all(loadPromises);
}

// Function to dispose all samples
export function disposeSamples(): void {
  samplePlayers.forEach(player => player.dispose());
  samplePlayers.clear();
}