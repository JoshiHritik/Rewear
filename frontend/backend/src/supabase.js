import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const bucketName = process.env.SUPABASE_BUCKET || 'rewear-images';

let supabaseClient = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.warn('⚠️ Supabase client initialization warning:', err.message);
  }
}

export const isSupabaseConfigured = () => {
  return Boolean(supabaseClient && supabaseUrl && supabaseKey);
};

export const getSupabaseClient = () => supabaseClient;

/**
 * Uploads a file buffer or stream to Supabase Storage
 * @param {Buffer} fileBuffer 
 * @param {string} originalFilename 
 * @param {string} mimeType 
 * @returns {Promise<string>} Public URL of uploaded image
 */
export const uploadImageToSupabase = async (fileBuffer, originalFilename, mimeType) => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase credentials are not configured in environment variables.');
  }

  const ext = originalFilename ? originalFilename.split('.').pop() : 'png';
  const filePath = `items/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType: mimeType || 'image/jpeg',
      upsert: true
    });

  if (error) {
    console.error('Supabase upload error details:', error);
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
};
