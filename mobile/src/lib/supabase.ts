import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://snbubfvxrlnhskmdbohf.supabase.co';
const supabaseAnonKey = 'sb_publishable_KNdUDxcQzE5MUurWZmCLoQ_M0fr-Ont';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
