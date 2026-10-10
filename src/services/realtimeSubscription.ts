/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { nexusStore } from './nexusStore';

type ToastCallback = (message: string) => void;

class RealtimeSubscriptionManager {
  private toastCallback: ToastCallback | null = null;
  private channel: any = null;

  public setToastCallback(callback: ToastCallback) {
    this.toastCallback = callback;
  }

  public init() {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        try {
          this.channel = client
            .channel('nexus_realtime_changes')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'sporting_events' },
              (payload) => {
                if (this.toastCallback) {
                  this.toastCallback(`Realtime: sporting_events ${payload.eventType}`);
                }
              }
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'factual_post_mortem' },
              (payload) => {
                if (this.toastCallback) {
                  this.toastCallback(`Realtime: Brier post-mortem evaluated (${(payload.new as any)?.brier_score})`);
                }
              }
            )
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'autonomous_upgrades' },
              (payload) => {
                if (this.toastCallback) {
                  this.toastCallback(`Realtime: Autonomous model upgrade applied`);
                }
              }
            )
            .subscribe((status) => {
              console.log('Supabase Realtime subscription status:', status);
            });
        } catch (err) {
          console.warn('Realtime subscription error:', err);
        }
      }
    }
  }

  public teardown() {
    if (this.channel) {
      const client = getSupabaseClient();
      if (client) {
        client.removeChannel(this.channel);
      }
    }
  }
}

export const realtimeManager = new RealtimeSubscriptionManager();
