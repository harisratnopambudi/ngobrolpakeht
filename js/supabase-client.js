/* HT-PRO Manager - Supabase Client (Auth + Hybrid Sync) */

// Helper for deterministic JSON comparison (only strip Supabase-internal 'updated_at', NOT 'id')
function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    const keys = Object.keys(obj).filter(k => k !== 'updated_at').sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/**
 * Supabase Schema (Key-Value pattern, id='main'):
 *   ht_units    ← localStorage 'ht_units'
 *   bookings    ← localStorage 'bookings'
 *   ht_settings ← localStorage 'app_settings'
 */

const SB_URL = 'https://zdrhmnpjrjznickxnifh.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcmhtbnBqcmp6bmlja3huaWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NzU2MDYsImV4cCI6MjA4NjE1MTYwNn0.iwzOZj325ZkfghyGRl28rELN4T7COH5MkEp_IHJViVc';

const SB_TABLE_MAP = {
    'ht_units': 'ht_units',
    'bookings': 'bookings',
    'app_settings': 'ht_settings',
    'ht_vouchers': 'ht_vouchers'
};

const sb = {
    client: null,
    _lastPush: 0, // Track last push to ignore echo changes

    /* ── Init: called once on DOMContentLoaded ── */
    init: async function () {
        this.client = supabase.createClient(SB_URL, SB_KEY);

        /* ── Auth Guard ── */
        const { data: { session } } = await this.client.auth.getSession();
        if (!session) {
            /* Not logged in → go to login page */
            window.location.replace('login.html');
            return; /* Stop further execution */
        }

        console.log('Supabase auth OK:', session.user.email);

        /* Listen for sign-out events (e.g. token expired) */
        this.client.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') window.location.replace('login.html');
        });

        /* Install auto-push hooks on save functions */
        this._installHooks();

        /* Pull latest data from cloud */
        await this.syncDown();

        /* ── Realtime Setup (Instant Updates) ── */
        this._setupRealtime();
    },

    /* ── Logout ── */
    logout: async function () {
        if (this.client) await this.client.auth.signOut();
        window.location.replace('login.html');
    },

    /* ── Push one localStorage key to its cloud table ── */
    push: async function (localKey) {
        if (!this.client) return;
        const table = SB_TABLE_MAP[localKey];
        if (!table) return;

        const rawData = localStorage.getItem(localKey);
        if (!rawData) return;

        let parsed;
        try { parsed = JSON.parse(rawData); } catch { return; }

        try {
            this._lastPush = Date.now(); // Mark push time
            const { error } = await this.client
                .from(table)
                .upsert({ id: 'main', data: parsed }, { onConflict: 'id' });
            if (error) throw error;
            console.log(`☁ Push OK: ${table}`);
        } catch (err) {
            console.error(`Cloud push failed (${table}):`, err);
            const msg = err.hint || err.message || 'Error tidak diketahui';
            if (typeof showToast === 'function') showToast(`Gagal sinkron ${table}: ${msg}`, 'error');
        }
    },

    /* ── Fetch one table from cloud ── */
    fetchData: async function (table) {
        if (!this.client) return null;
        try {
            const { data, error } = await this.client
                .from(table)
                .select('data')
                .eq('id', 'main')
                .single();
            if (error) throw error;
            return data ? data.data : null;
        } catch (err) {
            console.error(`Cloud fetch failed (${table}):`, err);
            return null;
        }
    },

    /* ── Pull all tables; reload UI if anything changed ── */
    _lastSync: {},
    syncDown: async function () {
        if (!this.client || this._syncing) return;
        this._syncing = true;
        let needsReload = false;

        try {
            for (const [localKey, table] of Object.entries(SB_TABLE_MAP)) {
                const remote = await this.fetchData(table);
                const localRaw = localStorage.getItem(localKey);

                // Parse local for empty check
                let localParsed = null;
                try { if (localRaw) localParsed = JSON.parse(localRaw); } catch (e) { }

                const cloudIsEmpty = !remote || (Array.isArray(remote) && remote.length === 0) || (remote && typeof remote === 'object' && Object.keys(remote).length === 0);
                const localHasData = localParsed && (Array.isArray(localParsed) ? localParsed.length > 0 : Object.keys(localParsed).length > 0);

                // Initial Migration: If cloud is empty but PC has data, PUSH it.
                if (cloudIsEmpty && localHasData) {
                    console.log(`☁ Migrating: ${localKey} -> Cloud`);
                    await this.push(localKey);
                    continue;
                }

                if (remote === null) continue;

                const remoteStr = stableStringify(remote);
                const localStr = localParsed ? stableStringify(localParsed) : "";

                if (localStr !== remoteStr) {
                    // PENTING: simpan JSON biasa, bukan output stableStringify (yang strip field id)
                    localStorage.setItem(localKey, JSON.stringify(remote));
                    console.log(`☁ Synced: ${localKey}`);
                    needsReload = true;
                }
            }
        } finally {
            this._syncing = false;
        }

        if (needsReload) {
            console.log('☁ Changes detected, refreshing UI components...');
            const lastPage = localStorage.getItem('lastPage') || 'dashboard';
            if (typeof navigateTo === 'function') {
                navigateTo(lastPage);
                if (typeof showToast === 'function') showToast('Cloud: Data diperbarui secara instan', 'info');
            }
        }
    },

    /* ── Push all local data to cloud at once ── */
    syncUp: async function (silent = false) {
        for (const localKey of Object.keys(SB_TABLE_MAP)) {
            await this.push(localKey);
        }
        if (!silent && typeof showToast === 'function') showToast('Data berhasil disinkronkan ke Cloud', 'success');
    },

    /* ── Manual Sync Trigger (Pull then Push) ── */
    manualSync: async function () {
        if (typeof showToast === 'function') showToast('Sinkronisasi cloud sedang berjalan...', 'info');
        await this.syncDown();
        await this.syncUp(true);
        if (typeof showToast === 'function') showToast('Sinkronisasi cloud selesai', 'success');
    },

    /* ── Wrap app.js save functions to auto-push after every write ── */
    _installHooks: function () {
        const wrap = (originalFn, localKey) => function (data) {
            originalFn(data);
            sb.push(localKey);
        };

        const installed = [];
        if (typeof saveUnits === 'function') { window.saveUnits = wrap(saveUnits, 'ht_units'); installed.push('units'); }
        if (typeof saveBookings === 'function') { window.saveBookings = wrap(saveBookings, 'bookings'); installed.push('bookings'); }
        if (typeof saveSettingsData === 'function') { window.saveSettingsData = wrap(saveSettingsData, 'app_settings'); installed.push('settings'); }
        if (typeof saveVouchers === 'function') { window.saveVouchers = wrap(saveVouchers, 'ht_vouchers'); installed.push('vouchers'); }

        console.log('Auto-push hooks installed:', installed.join(', '));
        if (installed.length < 3) console.warn('Some hooks failed to install. Check script load order.');
    },

    /* ── Supabase Realtime Subscription ── */
    _setupRealtime: function () {
        if (!this.client) return;

        const channel = this.client.channel('public:any')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                // Ignore changes that happen within 3 seconds of our own push
                if (Date.now() - this._lastPush < 3000) {
                    console.log('☁ Realtime: Ignoring echo from local push.');
                    return;
                }

                console.log('☁ Realtime Change:', payload.table);
                if (this._realtimeTimer) clearTimeout(this._realtimeTimer);
                this._realtimeTimer = setTimeout(() => this.syncDown(), 1000);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('☁ Realtime Subscribed: Listening for changes...');
                } else if (status === 'CLOSED') {
                    console.log('☁ Realtime Connection Closed');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('☁ Realtime Channel Error: Make sure Realtime is enabled in your Supabase Dashboard!');
                }
            });
    }
};

/* ── Bootstrap after all scripts are loaded ── */
document.addEventListener('DOMContentLoaded', () => {
    sb.init(); /* auth check + syncDown + hook install */
});
