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

    // If the path is already a full URL, return it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Handle default samples (those in the public directory)
    if (path.startsWith('public/samples/') || path.startsWith('/samples/') || path.startsWith('samples/') || !path.includes('/')) {
      // Remove 'public/' prefix if present
      const normalizedPath = path.replace(/^public\//, '');
      
      // Ensure the path starts with /samples/
      const fullPath = normalizedPath.startsWith('/')
        ? normalizedPath
        : `/${normalizedPath.startsWith('samples/') ? '' : 'samples/'}${normalizedPath}`;
      
      // Ensure .wav extension
      const finalPath = fullPath.endsWith('.wav') ? fullPath : `${fullPath}.wav`;
      
      // Return the full URL for the sample
      const url = `${window.location.origin}${finalPath}`;
      
      // Verify the URL is valid
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Sample not found at ${url}`);
        }
        return url;
      } catch (error) {
        console.error('Error verifying sample URL:', error);
        return null;
      }
    }

    // Handle user samples with retry logic
    const operation = retry.operation({
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
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

          // Verify the signed URL is valid
          try {
            const response = await fetch(data.signedUrl, { method: 'HEAD' });
            if (!response.ok) {
              throw new Error(`Sample not found at ${data.signedUrl}`);
            }
            resolve(data.signedUrl);
          } catch (error) {
            if (operation.retry(error as Error)) {
              return;
            }
            reject(operation.mainError());
          }
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