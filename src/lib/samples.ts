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

    // Handle Tone.js hosted samples
    if (path.includes('tonejs.github.io')) {
      return path;
    }

    // Handle default samples from public directory
    if (path.startsWith('/samples/') || !path.includes('/')) {
      const normalizedPath = path.startsWith('/samples/') ? path : `/samples/${path}`;
      const finalPath = normalizedPath.endsWith('.wav') ? normalizedPath : `${normalizedPath}.wav`;
      return window.location.origin + finalPath;
    }

    // Handle user samples with retry logic
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
          const { data, error } = await supabase.storage
            .from('echobucket')
            .createSignedUrl(path, 3600); // 1 hour expiry

          if (error) {
            console.error(`Attempt ${currentAttempt}: Error getting signed URL:`, error);
            if (operation.retry(error)) return;
            reject(operation.mainError());
            return;
          }

          if (!data?.signedUrl) {
            const err = new Error('No signed URL received');
            if (operation.retry(err)) return;
            reject(operation.mainError());
            return;
          }

          resolve(data.signedUrl);
        } catch (error) {
          console.error(`Attempt ${currentAttempt}: Error:`, error);
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

export async function loadSamples(): Promise<Sample[]> {
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
          // Load user samples
          const { data: userSamples, error: userError } = await supabase
            .from('samples')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (userError) {
            console.error(`Attempt ${currentAttempt}: Error loading user samples:`, userError);
            if (operation.retry(userError)) return;
            reject(operation.mainError());
            return;
          }

          // Load default samples
          const { data: defaultSamples, error: defaultError } = await supabase
            .from('default_samples')
            .select('*')
            .order('created_at', { ascending: false });

          if (defaultError) {
            console.error(`Attempt ${currentAttempt}: Error loading default samples:`, defaultError);
            if (operation.retry(defaultError)) return;
            reject(operation.mainError());
            return;
          }

          // Combine and validate samples
          const samples = [
            ...(userSamples || []),
            ...(defaultSamples || []).map(sample => ({
              ...sample,
              user_id: null
            }))
          ];

          // Pre-validate sample URLs
          const validatedSamples = await Promise.all(
            samples.map(async (sample) => {
              try {
                const url = await getSampleUrl(sample.storage_path);
                return url ? sample : null;
              } catch (error) {
                console.warn(`Invalid sample ${sample.id}:`, error);
                return null;
              }
            })
          );

          resolve(validatedSamples.filter((sample): sample is Sample => sample !== null));
        } catch (error) {
          console.error(`Attempt ${currentAttempt}: Error:`, error);
          if (operation.retry(error as Error)) return;
          reject(operation.mainError());
        }
      });
    });
  } catch (error) {
    console.error('Error in loadSamples:', error);
    return [];
  }
}

export async function deleteSample(id: string): Promise<boolean> {
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
          const { data: sample, error: fetchError } = await supabase
            .from('samples')
            .select('storage_path')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

          if (fetchError) {
            console.error(`Attempt ${currentAttempt}: Error fetching sample:`, fetchError);
            if (operation.retry(fetchError)) return;
            reject(operation.mainError());
            return;
          }

          if (!sample) {
            resolve(false);
            return;
          }

          const { error: storageError } = await supabase.storage
            .from('echobucket')
            .remove([sample.storage_path]);

          if (storageError) {
            console.error(`Attempt ${currentAttempt}: Error removing from storage:`, storageError);
            if (operation.retry(storageError)) return;
            reject(operation.mainError());
            return;
          }

          const { error: dbError } = await supabase
            .from('samples')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

          if (dbError) {
            console.error(`Attempt ${currentAttempt}: Error deleting from database:`, dbError);
            if (operation.retry(dbError)) return;
            reject(operation.mainError());
            return;
          }

          resolve(true);
        } catch (error) {
          console.error(`Attempt ${currentAttempt}: Error:`, error);
          if (operation.retry(error as Error)) return;
          reject(operation.mainError());
        }
      });
    });
  } catch (error) {
    console.error('Error in deleteSample:', error);
    return false;
  }
}