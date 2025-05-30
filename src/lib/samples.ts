import { supabase } from './supabase';
import retry from 'retry';

export interface Sample {
  id: string;
  name: string;
  user_id: string | null;
  storage_path: string;
  type: string;
  created_at: string;
}

export async function uploadSample(file: Blob, fileName: string, type: string): Promise<string | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session?.user) {
        throw new Error('Session expired. Please sign in again.');
      }
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!(file instanceof Blob) || !file.type.startsWith('audio/')) {
      throw new Error('Invalid file type. Please upload an audio file.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File too large. Maximum size is 10MB.');
    }

    const storagePath = `samples/${user.id}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('echobucket')
      .upload(storagePath, file, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (error) {
      console.error('Error uploading sample:', error);
      return null;
    }

    const { data: sampleData, error: metadataError } = await supabase
      .from('samples')
      .insert([
        {
          name: fileName.replace('.wav', ''),
          storage_path: data.path,
          user_id: user.id,
          type: type
        }
      ])
      .select()
      .single();

    if (metadataError) {
      console.error('Error saving sample metadata:', metadataError);
      return null;
    }

    return data.path;
  } catch (error) {
    console.error('Error in uploadSample:', error);
    return null;
  }
}

export async function getSampleUrl(path: string): Promise<string | null> {
  try {
    if (!path) {
      throw new Error('Invalid path provided');
    }

    // Handle full URLs
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Handle default samples from Tone.js
    if (path.includes('tonejs.github.io')) {
      return path;
    }

    // Handle default samples from public directory
    if (path.startsWith('/samples/') || !path.includes('/')) {
      const normalizedPath = path.startsWith('/samples/') ? path : `/samples/${path}`;
      const finalPath = normalizedPath.endsWith('.wav') ? normalizedPath : `${normalizedPath}.wav`;
      return `${window.location.origin}${finalPath}`;
    }

    // Handle user samples with retry logic
    const operation = retry.operation({
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const { data, error } = await supabase.storage
            .from('echobucket')
            .createSignedUrl(path, 3600);

          if (error) {
            if (operation.retry(error)) return;
            reject(operation.mainError());
            return;
          }

          resolve(data.signedUrl);
        } catch (error) {
          if (operation.retry(error as Error)) return;
          reject(operation.mainError());
        }
      });
    });
  } catch (error) {
    console.error('Error getting sample URL:', error);
    return null;
  }
}