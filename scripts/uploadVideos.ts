import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import "dotenv/config";


const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'wrenchgo-videos';

interface VideoFile {
  key: string;
  localPath: string;
  remotePath: string;
}

const VIDEO_FILES: VideoFile[] = [
  {
    key: 'logo_video',
    localPath: 'assets/logovideo.mp4',
    remotePath: 'logovideo.mp4',
  },
  {
    key: 'wrenchgo_ad_1',
    localPath: 'assets/wrenchGoAd.mp4',
    remotePath: 'wrenchGoAd.mp4',
  },
  {
    key: 'wrenchgo_ad_2',
    localPath: 'assets/wrenchGoAd2.mp4',
    remotePath: 'wrenchGoAd2.mp4',
  },
  {
    key: 'wrenchgo_ad_3',
    localPath: 'assets/wrenchGoAd3.mp4',
    remotePath: 'wrenchGoAd3.mp4',
  },
];

async function main() {
  if (!SUPABASE_URL) {
    console.error('❌ Error: SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.error('   Get this from: Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🚀 Starting video upload to Supabase Storage...\n');

// Bucket must already exist (create once in Supabase Dashboard → Storage)
console.log(`✅ Using bucket "${BUCKET_NAME}" (must exist in Supabase Storage)\n`);


  for (const video of VIDEO_FILES) {
    console.log(`📹 Processing: ${video.key} (${video.localPath})`);

    if (!fs.existsSync(video.localPath)) {
      console.warn(`⚠️  File not found: ${video.localPath}, skipping...`);
      continue;
    }

    const fileBuffer = fs.readFileSync(video.localPath);
    const fileSizeBytes = fileBuffer.length;
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

    console.log(`   Size: ${fileSizeMB} MB`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(video.remotePath, fileBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error(`❌ Upload failed for ${video.key}:`, uploadError);
      continue;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(video.remotePath);

    const publicUrl = publicUrlData.publicUrl;

    console.log(`   ✅ Uploaded to: ${uploadData.path}`);
    console.log(`   🔗 Public URL: ${publicUrl}`);

    const { error: upsertError } = await supabase
      .from('media_assets')
      .upsert(
        {
          key: video.key,
          bucket: BUCKET_NAME,
          path: video.remotePath,
          content_type: 'video/mp4',
          size_bytes: fileSizeBytes,
          public_url: publicUrl,
        },
        {
          onConflict: 'key',
        }
      );

    if (upsertError) {
      console.error(`❌ Database upsert failed for ${video.key}:`, upsertError);
    } else {
      console.log(`   ✅ Database record updated\n`);
    }
  }

  console.log('🎉 All videos uploaded successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Verify uploads in Supabase Dashboard → Storage → wrenchgo-videos');
  console.log('   2. Check database records: SELECT * FROM media_assets;');
  console.log('   3. Update your app code to use getMediaUrl() helper');
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
