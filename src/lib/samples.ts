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
      // Try to refresh the session
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session?.user) {
        throw new Error('Session expired. Please sign in again.');
      }
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate file type
    if (!(file instanceof Blob) || !file.type.startsWith('audio/')) {
      throw new Error('Invalid file type. Please upload an audio file.');
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File too large. Maximum size is 10MB.');
    }

    // Include user ID in storage path to enforce ownership
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

    // Save metadata
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

    // Handle default samples (those in the public directory)
    if (path.startsWith('/samples/') || !path.includes('/')) {
      // Ensure the path starts with /samples/ and ends with .wav
      const normalizedPath = path.startsWith('/samples/') 
        ? path 
        : `/samples/${path}${path.endsWith('.wav') ? '' : '.wav'}`;
      
      // Return the full URL including origin for default samples
      return window.location.origin + normalizedPath;
    }

    // Create retry operation for user samples
    const operation = retry.operation({
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          // Get signed URL for user samples
          const { data, error } = await supabase.storage
            .from('echobucket')
            .createSignedUrl(path, 3600); // 1 hour expiry

          if (error) {
            if (operation.retry(error)) {
              return;
            }
            reject(operation.mainError());
            return;
          }

          resolve(data.signedUrl);
        } catch (error) {
          if (operation.retry(error as Error)) {
            return;
          }
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
      // Try to refresh the session
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session?.user) {
        throw new Error('Session expired. Please sign in again.');
      }
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Create retry operation
    const operation = retry.operation({
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          // Get user samples
          const { data: userSamples, error } = await supabase
            .from('samples')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            if (operation.retry(error)) {
              return;
            }
            reject(operation.mainError());
            return;
          }

          // Get default samples
          const { data: defaultSamples, error: defaultError } = await supabase
            .from('default_samples')
            .select('*')
            .order('created_at', { ascending: false });

          if (defaultError) {
            if (operation.retry(defaultError)) {
              return;
            }
            reject(operation.mainError());
            return;
          }

          // Combine and return all samples
          resolve([
            ...(userSamples || []),
            ...(defaultSamples || []).map(sample => ({
              ...sample,
              user_id: null // Mark as default sample
            }))
          ]);
        } catch (error) {
          if (operation.retry(error as Error)) {
            return;
          }
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
      // Try to refresh the session
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session?.user) {
        throw new Error('Session expired. Please sign in again.');
      }
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Create retry operation
    const operation = retry.operation({
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          // Get the sample to find its storage path
          const { data: sample, error: fetchError } = await supabase
            .from('samples')
            .select('storage_path')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

          if (fetchError) {
            if (operation.retry(fetchError)) {
              return;
            }
            reject(operation.mainError());
            return;
          }

          if (!sample) {
            resolve(false);
            return;
          }

          // Delete from storage
          const { error: storageError } = await supabase.storage
            .from('echobucket')
            .remove([sample.storage_path]);

          if (storageError) {
            if (operation.retry(storageError)) {
              return;
            }
            reject(operation.mainError());
            return;
          }

          // Delete from database
          const { error: dbError } = await supabase
            .from('samples')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

          if (dbError) {
            if (operation.retry(dbError)) {
              return;
            }
            reject(operation.mainError());
            return;
          }

          resolve(true);
        } catch (error) {
          if (operation.retry(error as Error)) {
            return;
          }
          reject(operation.mainError());
        }
      });
    });
  } catch (error) {
    console.error('Error in deleteSample:', error);
    return false;
  }
}