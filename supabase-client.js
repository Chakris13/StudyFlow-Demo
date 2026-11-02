// StudyFlow Supabase browser configuration.
// This file contains only the public Project URL and Publishable Key.
// Never put a Supabase Secret Key or service_role key in browser code.
(() => {
    if (!window.supabase?.createClient) {
        throw new Error('Supabase JS SDK did not load. Check your internet connection.');
    }

    const SUPABASE_URL = 'https://qxfwcnupqqavszgcxfmh.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_c4jSbJW6c-yD9qshd1wPpA_e-hhVA1M';

    window.studyFlowSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );
})();
