import {Rt} from './types'
import {Tag, db} from './idb'
import * as sb from '@supabase/supabase-js';

/**
* Subscribes to real-time changes in the 'journal_entries' table and syncs to Dexie.
* Also performs initial data fetch.
*/
export async function subRt(sbc: sb.SupabaseClient) {
  console.log("Setting up Supabase Realtime subscription...");
  // 1. Initial Data Load
  // Fetch today's data initially to populate Dexie before listening for live changes
  // (Filtering by date can be done using RLS in Supabase or client-side if needed)
  const { data: initialEntries, error: fetchError } = await sbc.schema('tt')
  .from('rt')
  .select('*')
  .order('dt', { ascending: false });
  
  if (fetchError) throw fetchError;
  // Clear local store and populate with current remote truth
  await db.tags.clear();
  // Helper to transform Supabase data format to your local Tag interface
  const mapToTag = (data: Rt): Tag => ({
    ref: data.ref,
    type: data.type,
    dt: new Date(data.dt),
    txt: data.txt,
    sts: data.sts ?? undefined,
    ats: data.ats ?? undefined,
    tid: data.tid ?? undefined,
  });
  await db.tags.bulkPut(initialEntries.map(mapToTag));
  console.log(`Initial sync complete: ${initialEntries.length} entries loaded.`);
  // 2. Set up Realtime Listener for subsequent changes
  const channel = sbc.channel('journal-sync-channel')
  .on( 'postgres_changes'
    , { event: '*', schema: 'tt', table: 'rt' }
    , async (payload) => {
      const newEntry = payload.new as Rt;
      const oldEntry = payload.old as Rt;
      
      switch (payload.eventType) {
        case 'INSERT':
        console.log('Realtime INSERT received:', newEntry.entry_id);
        await db.tags.put(mapToTag(newEntry));
        break;
        case 'UPDATE':
        console.log('Realtime UPDATE received:', newEntry.entry_id);
        await db.tags.put(mapToTag(newEntry));
        break;
        case 'DELETE':
        console.log('Realtime DELETE received:', oldEntry.entry_id);
        // Assuming your Dexie schema uses 'tid' or 'entry_id' as key path
        // Need to delete based on the primary key used in Dexie
        await db.tags.delete(oldEntry.tid || oldEntry.entry_id); 
        break;
      }
    }
  ).subscribe()
  return channel
}
/**
* Upserts a Tag object into the Supabase journal_entries table.
* @param tagData The Tag object from Dexie to sync.
*/
export async function upsRt(ts: Tag[], sbc: sb.SupabaseClient, next_tid:number): Promise<void> {
  
  // Map the local Tag interface back to the Supabase schema format
  const supabasePayload = ts.map(tagData=>({
    // We might not have the UUID (entry_id) locally yet if it's a brand new entry.
    // Supabase will generate one by default if omitted.
    // entry_id: tagData.someLocalId, 
    ref: tagData.ref,
    type: tagData.type,
    dt: tagData.dt.toISOString(),
    txt: tagData.txt,
    sts: tagData.sts || null,
    ats: tagData.ats || null,
    tid: tagData.tid || null,
  }));
  
  // // Use .upsert() which acts as both INSERT and UPDATE depending on the primary key match
  // // If you add the 'entry_id' to your Dexie Tag interface and manage UUIDs locally, you can leverage the upsert behavior fully.
  // const { data, error } = await sbc
  //     .from('rt')
  //     .upsert([supabasePayload])
  //     .select(); // Select the data back to confirm it was successful and get the generated UUID/ID
  const {data: tidChanges, error} = await sbc.rpc('tt.bulk_upsert_journal_v2'
    , {payloads:supabasePayload, next_tid})
    if (error) {
      console.error("Error upserting journal entry to Supabase:", error);
      throw error;
    }
    console.log("Successfully upserted entry to Supabase:", tidChanges);
    return tidChanges
    
    // Optional: Update the local Dexie entry with the definitive UUID returned by Supabase
    // await db.tags.update(tagData.tid, { entry_id: data[0].entry_id });
  }
  
  // ref edge://sync-internals/ https://github.com/kitt-browser/chrome-sync/blob/master/protocol/sync_enums.proto