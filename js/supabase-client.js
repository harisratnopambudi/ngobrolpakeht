/* HT-PRO Manager - Supabase Client (Hybrid Sync) */

const SB_CONFIG_KEY = 'ht_cloud_config';

const sb = {
    client: null,

    init: function () {
        // Try to load config from local storage
        let config = JSON.parse(localStorage.getItem(SB_CONFIG_KEY) || '{}');

        // If not found, use default provided by user (first run)
        if (!config.url || !config.key) {
            const defaultUrl = 'https://zdrhmnpjrjznickxnifh.supabase.co';
            const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcmhtbnBqcmp6bmlja3huaWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NzU2MDYsImV4cCI6MjA4NjE1MTYwNn0.iwzOZj325ZkfghyGRl28rELN4T7COH5MkEp_IHJViVc';

            config = { url: defaultUrl, key: defaultKey };
            localStorage.setItem(SB_CONFIG_KEY, JSON.stringify(config));
        }

        if (window.supabase) {
            try {
                this.client = window.supabase.createClient(config.url, config.key);
                console.log('Supabase initialized');
                this.syncDown(); // Attempt initial sync
            } catch (err) {
                console.error('Supabase init failed:', err);
            }
        } else {
            console.error('Supabase JS not loaded');
        }
    },

    // Push data to cloud (Fire & Forget)
    pushData: async function (table, data) {
        if (!this.client) this.init(); // Auto-init if missing
        if (!this.client) return;

        // Show saving indicator (optional, or just console)
        const statusEl = document.getElementById('cloudStatus');
        if (statusEl) {
            const txt = statusEl.querySelector('.status-text');
            if (txt) txt.textContent = 'Saving...';
        }

        try {
            const { error } = await this.client
                .from(table)
                .upsert({ id: 'main', data: data }, { onConflict: 'id' });

            if (error) throw error;
            console.log(`Cloud sync success: ${table}`);

            // Revert status
            if (statusEl) {
                const txt = statusEl.querySelector('.status-text');
                if (txt) txt.textContent = 'Cloud Connected';
            }

            // Optional: Discrete success toast for critical actions only?
            // showToast('Tersimpan ke Cloud', 'success'); 
        } catch (err) {
            console.error(`Cloud sync failed (${table}):`, err.message);
            showToast('Gagal simpan ke Cloud! Cek koneksi.', 'error');
            if (statusEl) {
                const txt = statusEl.querySelector('.status-text');
                if (txt) txt.textContent = 'Sync Failed';
                statusEl.querySelector('.status-dot').style.background = '#ef4444';
            }
        }
    },

    // Pull data from cloud (On Load)
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
            console.warn(`Cloud fetch failed (${table}):`, err.message);
            return null;
        }
    },

    // Aggressive Sync: Block UI, Fetch All, Compare
    forceSync: async function () {
        if (!this.client) {
            this.updateStatus(false);
            return;
        }

        const overlay = document.getElementById('syncOverlay');
        if (overlay) overlay.style.display = 'flex';

        this.updateStatus(true);
        let needsReload = false;

        const syncTable = async (key, table) => {
            try {
                const remote = await this.fetchData(table);
                if (!remote) return; // No data on cloud or error

                const localStr = localStorage.getItem(key);
                const remoteStr = JSON.stringify(remote);

                if (localStr !== remoteStr) {
                    console.log(`[Sync] Update detected for ${key}`);
                    localStorage.setItem(key, remoteStr);
                    needsReload = true;
                }
            } catch (e) {
                console.error(`[Sync] Error syncing ${table}`, e);
            }
        };

        await Promise.all([
            syncTable('ht_units', 'ht_units'),
            syncTable('bookings', 'bookings'),
            syncTable('app_settings', 'ht_settings')
        ]);

        if (overlay) overlay.style.display = 'none';

        if (needsReload) {
            console.log('[Sync] Data refreshed, reloading...');
            showToast('Data diperbarui dari Cloud', 'info');
            setTimeout(() => location.reload(), 500);
        } else {
            console.log('[Sync] Local data is up to date.');
        }
    },

    updateStatus: function (online) {
        const el = document.getElementById('cloudStatus');
        if (!el) return;
        const dot = el.querySelector('.status-dot');
        const txt = el.querySelector('.status-text');

        if (online) {
            dot.style.background = '#22c55e'; // Green
            txt.textContent = 'Cloud Connected';
            txt.style.color = '#fff';
        } else {
            dot.style.background = '#666'; // Grey
            txt.textContent = 'Offline Mode';
            txt.style.color = 'var(--text2)';
        }
    },

    syncDown: async function () {
        // Legacy: alias to forceSync but maybe without overlay? 
        // For now, let's just forward to forceSync or do silent sync
        console.log('Background sync...');
        await this.forceSync();
    }
};
