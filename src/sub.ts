import {Rt} from './types'
import { stts } from './fc';
import * as fc from './fc';
import {Tag, db} from './idb'
import * as sb from '@supabase/supabase-js';
/** Subscribes to real-time changes in the 'journal_entries' table and syncs to Dexie.
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
  // // Clear local store and populate with current remote truth
  // await db.tags.clear();
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
/** Upserts a Tag object into the Supabase journal_entries table.
* @param tagData The Tag object from Dexie to sync.
*/
export async function upsRt(ts: Tag[], sbc: sb.SupabaseClient, next_tid:number): Promise<void> {
  
  const { data: { user } } = await sbc.auth.getUser()
  if (!user) return console.error("Not logged in")

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
    user_id: user.id
  }));
  
  // // Use .upsert() which acts as both INSERT and UPDATE depending on the primary key match
  // // If you add the 'entry_id' to your Dexie Tag interface and manage UUIDs locally, you can leverage the upsert behavior fully.
  // const { data, error } = await sbc
  //     .from('rt')
  //     .upsert([supabasePayload])
  //     .select(); // Select the data back to confirm it was successful and get the generated UUID/ID
  const {data: tidChanges, error} = await sbc.schema('tt').rpc('bulk_upsert_journal_v2'
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
const sb_options = {auth:{
    persistSession: true,    // Enabled by default; ensures storage use
    autoRefreshToken: true,  // Automatically uses refresh tokens
    detectSessionInUrl: true, // Critical for picking up Google OAuth tokens
    debug:false,
}}
export let sbg:sb.SupabaseClient = sb.createClient('https://qhumewjpkzxaltwefqch.supabase.co', 'sb_publishable_5Stcng45Jofw5Wv3FA4GnQ_BivUYQ_K'
  , sb_options);
export function set_sbg(server, pub_key, cb) {
  try {const tmp_sbc = sb.createClient(server, pub_key, sb_options)
    if (tmp_sbc) last_sync_desc(tmp_sbc).then(res=> {
      if (res.ok)
        stts('cred test done', "Sync")
      else
        return fc.sideLog('cred test error: ',res.result.error)
    if (sbg) {
      sbg.realtime.disconnect(); 
      sbg.removeAllChannels();
    }
    sbg = tmp_sbc
    subRt(sbg)
    cb(sbg)
  }) } catch(e) {
    stts(e.message, "Sync")
    console.error(`error: `,e)
  }
}
// export function useSupabaseInit (url, anon) {
//   return useQuery({ queryKey: ['supabase', url, anon], // Only re-init if these specific values change
//     queryFn: async () => {
//       const client = sb.createClient(url, anon)
//       const { ok, result } = await last_sync_desc(client);
//       if (!ok) throw new Error(`Health check failed: ${result?.error?.message}`);      
//       return client
//     },
//     // Prevent the client from being "garbage collected" or marked as stale
//     staleTime: Infinity, 
//     gcTime: Infinity,
//     enabled: !!(url && anon), // Stop the query from running if credentials aren't fully typed yet
//   });
// };

export async function last_sync(sbc:sb.SupabaseClient) {
  const st = performance.now()
  const {ok, name} = await last_sync_desc(sbc)
  // if (!ok) return 
  const res = fc.dl(sbc.storage.from('bb'), name)
  fc.nowWarn(st, 'sync', 'dl last')
  return res
}
export async function last_sync_desc(sbc:sb.SupabaseClient) {
  const st = performance.now()
  const { data: { user } } = await sbc.auth.getUser()
  if (!user) return {ok:false, error: stts("err Not logged in"), result:user}
  const result = await sbc.storage.from('bb').list(`${user.id}`, { limit: 11, sortBy: { column: 'created_at', order: 'desc' } });    
  if (result.error) 
    return {ok:false, error: stts(`err [listing buckets]  ${result.error.name}: ${result.error.message}`), result}
  if (!result.data.length)
    return {ok:false, error: stts(`No snapshot found yet.`), result}

  const matched = result.data?.filter((o: { name: string; })=> o.name.startsWith('tags'))
  if (!matched.length)
    return {ok:false, error: stts(`err no matched sync image found`), result}  // already return false after async wrapper
  fc.nowWarn(st, 'sync', 'list last')
  return {ok: true, name: matched[0].name, updated_at: matched[0].updated_at, result}
}
  // ref edge://sync-internals/ https://github.com/kitt-browser/chrome-sync/blob/master/protocol/sync_enums.proto