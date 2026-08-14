import { BaseRepository } from './BaseRepository';
import { supabase } from '../supabase';

export interface DiagnosticsTestResult {
  selectType: 'ok' | 'blocked' | 'error' | 'missing';
  insertType: 'ok' | 'blocked' | 'error' | 'missing';
  selectStr: string;
  insertStr: string;
}

class DiagnosticsRepositoryImpl extends BaseRepository {
  /**
   * Run a deduplicated SELECT test on a database table for RLS/Schema diagnostics
   */
  async testTableSelect(table: string): Promise<{ selectType: 'ok' | 'blocked' | 'error' | 'missing'; selectStr: string }> {
    return this.deduplicate(`diag_select_${table}`, async () => {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          if (error.code === '42501') {
            return { selectType: 'blocked', selectStr: '❌ Blocked (RLS)' };
          } else if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            return { selectType: 'missing', selectStr: '❓ Table Missing' };
          } else {
            return { selectType: 'error', selectStr: `⚠️ Code ${error.code}` };
          }
        }
        return { selectType: 'ok', selectStr: '✅ Allowed' };
      } catch (e: any) {
        return { selectType: 'error', selectStr: '💥 Fail' };
      }
    });
  }

  /**
   * Run a deduplicated INSERT test on a database table for RLS/Schema diagnostics
   */
  async testTableInsert(table: string): Promise<{ insertType: 'ok' | 'blocked' | 'error' | 'missing'; insertStr: string }> {
    return this.deduplicate(`diag_insert_${table}`, async () => {
      try {
        const { error } = await supabase.from(table).insert({ id: '00000000-0000-0000-0000-000000000000' }).select();
        if (error) {
          if (error.code === '42501') {
            return { insertType: 'blocked', insertStr: '❌ Blocked (RLS)' };
          } else if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            return { insertType: 'missing', insertStr: '❓ Table Missing' };
          } else {
            return { insertType: 'ok', insertStr: '✅ Allowed (Checked)' };
          }
        }
        return { insertType: 'ok', insertStr: '✅ Allowed' };
      } catch (e: any) {
        return { insertType: 'error', insertStr: '💥 Fail' };
      }
    });
  }
}

export const DiagnosticsRepository = new DiagnosticsRepositoryImpl();
