import { supabase } from '../supabase';

export const supabaseService = {
  // Improved error handler
  handleError(error: any) {
    if (error.code === 'PGRST205') {
      console.error('SUPABASE CONFIG ERROR: Database table or column not found. Did you run the SQL script in your Supabase Dashboard?', error);
    }
    return error;
  },

  // Generic Fetch
  async fetchData<T>(table: string, queryBuilder?: (q: any) => any) {
    let q = supabase.from(table).select('*');
    if (queryBuilder) {
      q = queryBuilder(q);
    }
    const { data, error } = await q;
    if (error) throw this.handleError(error);
    return data as T[];
  },

  // Generic Get Single
  async fetchSingle<T>(table: string, id: string, idField: string = 'id') {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(idField, id)
      .single();
    if (error) throw this.handleError(error);
    return data as T;
  },

  // Generic Upsert
  async upsertData<T>(table: string, data: any, idField: string = 'id') {
    const { data: result, error } = await supabase
      .from(table)
      .upsert(data, { onConflict: idField })
      .select();
    if (error) throw this.handleError(error);
    return (result && result[0]) as T;
  },

  // Generic Update
  async updateData(table: string, id: string, data: any, idField: string = 'id') {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq(idField, id)
      .select();
    if (error) throw this.handleError(error);
    return result && result[0];
  },

  // Generic Delete
  async deleteData(table: string, id: string, idField: string = 'id') {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(idField, id);
    if (error) throw error;
  },

  // Real-time subscription helper
  subscribe(table: string, callback: (payload: any) => void, filter?: string) {
    let channel = supabase.channel(`public:${table}`);
    
    if (filter) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => callback(payload)
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => callback(payload)
      );
    }

    return channel.subscribe();
  }
};
