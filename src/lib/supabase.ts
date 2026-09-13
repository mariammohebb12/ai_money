import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wscqhuwlicbhmxgubxhq.supabase.co';
const supabaseAnonKey = 'sb_publishable_2nh2-6fxG6thrV0MSQDRTQ_0reMEcNC';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There's no browser URL to parse a session out of in React Native.
    detectSessionInUrl: false,
  },
});