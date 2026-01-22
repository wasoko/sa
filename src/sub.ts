import {Rt} from './types'
import { stts } from './fc';
import * as fc from './fc';
import {DEF_TREE, Tag, db} from './idb'
import * as sb from '@supabase/supabase-js';
/** Subscribes to real-time changes in the 'journal_entries' table and syncs to Dexie.
 * Also performs initial data fetch.
 */
export async function subRt(sbc: sb.SupabaseClient) {
  if (sub_user=== user?.id || !user?.id) return
  sub_user = user?.id
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

const isExt = typeof chrome !== 'undefined' && chrome.storage;
const storage = isExt? chrome.storage.sync || chrome.storage.local : null;
const tokenStorageAdapter = { getItem: async (key: string) => {
    const result = await storage.get(key);
    return result[key] || null;
  },
  setItem: async (key: string, value: string) => await storage?.set({ [key]: value }),
  removeItem: async (key: string) => await storage?.remove(key),
};
const sb_options = {auth:{    
    autoRefreshToken: !isExt,// ??    // For Chrome extensions, disable auto-refresh to avoid redirect issues
    detectSessionInUrl: !isExt, // Prevent chromium-extension:// URL issues
    persistSession: true,
    storage: isExt? tokenStorageAdapter : undefined,
    debug:false,
}}
const SB_AUTH_NEXT = 'auth_next_path'
export let sbg:sb.SupabaseClient = sb.createClient(DEF_TREE['server'], DEF_TREE['pub_key']
  , sb_options);
let sess: sb.Session |null = null
let user: sb.User |null = null
let sub_user = ''
sbg.auth.getSession().then(({ data: { session } }) => {
  sess = session;
  user = session?.user ?? null;
});
sbg.auth.onAuthStateChange((event, session) => {
  sess = session;
  user = session?.user ?? null;
  if (event==='SIGNED_IN' && session) subRt(sbg)
  if (event==='SIGNED_OUT') fc.sideLog('SIGNED_OUT',sbg.removeAllChannels())
});

export async function signinGoogle() {
  const nextPath = window.location
  if (!isExt) return sbg.auth.signInWithOAuth({ provider: 'google' 
    , options:{redirectTo: nextPath.href
          // , options: {redirectTo: `${window.location.origin}/auth-callback.html?next=${encodeURIComponent(nextPath.hash)}`
        }})
  const { data, error } = await sbg.auth.signInWithOAuth({
    provider: 'google', options: {
      redirectTo: chrome.identity.getRedirectURL(),
      skipBrowserRedirect: true // Returns the URL instead of redirecting
    } });
  // if (chrome.runtime.lastError || !responseUrl) {
  if (error) return fc.sideLog('err signin Google: ', error)
  chrome.identity.launchWebAuthFlow({ url: data.url,
    interactive: true }, async (callbackUrl) => {
      if (callbackUrl) {
        // const url = new URL(callbackUrl);
        const params = new URLSearchParams(new URL(callbackUrl).hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (!access_token || !refresh_token) return fc.sideLog('err token missing', params)

        // const code = url.searchParams.get('code') || url.hash.split('access_token=')[1]?.split('&')[0];
        // const res = await sbg.auth.exchangeCodeForSession(code)
        const res = await sbg.auth.setSession({access_token, refresh_token});
        // console.info('',code)
        sess = res.data.session
        user = res.data.user
            window.history.replaceState(null, '', nextPath.href);
        // window.location.hash = nextPath.replace(/^#/, '')
        // chrome.storage.local.set({SB_TOKEN: res.data})
    }
  })
}
export function set_sbg(server, pub_key) {
  // try {
    const tmp_sbc = sb.createClient(server, pub_key, sb_options)
    // if (tmp_sbc) last_sync_desc(tmp_sbc).then(res=> {
    //   if (res.ok) stts('cred test done', "Sync")
    //   else return fc.sideLog('cred test error: ',res)
    if (sbg) {
      sbg.realtime.disconnect(); 
      sbg.removeAllChannels();
      sess = null
      user = null
    }
    sbg = tmp_sbc
  // }) } catch(e) {
  //   stts(e.message, "Sync")
  //   console.error(`error: `,e)
  // }
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
  const path = `${user.id}`
  const result = await sbc.storage.from('bb').list(path, { limit: 11, sortBy: { column: 'created_at', order: 'desc' } });    
  if (result.error) 
    return {ok:false, error: stts(`err [listing buckets]  ${result.error.name}: ${result.error.message}`), result}
  if (!result.data.length)
    return {ok:false, error: stts(`No snapshot found yet.`), result}

  const matched = result.data?.filter((o: { name: string; })=> o.name.startsWith('tags'))
  if (!matched.length)
    return {ok:false, error: stts(`err no matched sync image found`), result}  // already return false after async wrapper
  fc.nowWarn(st, 'sync', 'list last')
  return {ok: true, name: path+'/'+matched[0].name, updated_at: matched[0].updated_at, result}
}
  // ref edge://sync-internals/ https://github.com/kitt-browser/chrome-sync/blob/master/protocol/sync_enums.proto