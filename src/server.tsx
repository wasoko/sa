// src/ExcelProxy.tsx (or .jsx)

import { createClient } from '@supabase/supabase-js';

export default function ExcelProxy() {
  // Run immediately – we want raw JSON output for Excel
  const loadAndOutputTags = async () => {
    try {
      // 1. Parse ?key= from URL
      const params = new URLSearchParams(window.location.search);
      const key = params.get('key');

      if (!key || !key.includes('|')) {
        document.body.innerText = JSON.stringify(
          { error: 'Missing or invalid ?key=URL|ANON_KEY parameter' },
          null,
          2
        );
        return;
      }

      const [supabaseUrl, supabaseAnonKey] = key.split('|');

      // 2. Create Supabase client
      const supabase = createClient(supabaseUrl.trim(), supabaseAnonKey.trim());

      // 3. List recent files in bucket 'bb'
      const { data: files, error: listError } = await supabase.storage
        .from('bb')
        .list('', {
          limit: 20,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (listError) throw listError;

      // 4. Find the latest file starting with 'tags'
      const tagsFile = files?.find((file) =>
        file.name.startsWith('tags')
      );

      if (!tagsFile) {
        document.body.innerText = JSON.stringify(
          { error: 'No file starting with "tags" found in storage bucket "bb"' },
          null,
          2
        );
        return;
      }

      // 5. Download the file
      const { data: blob, error: downloadError } = await supabase.storage
        .from('bb')
        .download(tagsFile.name);

      if (downloadError) throw downloadError;
      if (!blob) throw new Error('Downloaded file is empty');

      // 6. Parse as JSON (assuming the file contains a JSON array of tags)
      const text = await blob.text();
      const tagsArray = JSON.parse(text);

      if (!Array.isArray(tagsArray)) {
        throw new Error('File content is not a JSON array');
      }

      // 7. Output clean JSON for Excel
      document.body.innerText = JSON.stringify(tagsArray, null, 2);
    } catch (err: any) {
      document.body.innerText = JSON.stringify(
        { error: err.message || 'Unknown error' },
        null,
        2
      );
    }
  };

  loadAndOutputTags();

  // Minimal fallback UI (won't be visible in Excel import)
  return <p>Loading tags from Supabase storage...</p>;
}