import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * 1. GET /api/admin/customers
 * Returns paginated customer list, real summary metrics, search, and filters.
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : 'all';
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string || '50', 10), 100));
    const offset = (page - 1) * limit;

    // Fetch all user records from database
    const { data: rawUsers, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const allUsers = rawUsers || [];

    const isBlockedUser = (c: any) =>
      c.status === 'blocked' ||
      c.is_blocked === true ||
      c.settings?.status === 'blocked' ||
      c.settings?.is_blocked === true;

    const totalCount = allUsers.length;
    const blockedCount = allUsers.filter(isBlockedUser).length;
    const activeCount = Math.max(0, totalCount - blockedCount);

    const sevenDaysAgoTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newCount = allUsers.filter(c => c.created_at && new Date(c.created_at).getTime() >= sevenDaysAgoTime).length;

    let filtered = allUsers;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c =>
        (c.full_name?.toLowerCase() || '').includes(q) ||
        (c.name?.toLowerCase() || '').includes(q) ||
        (c.email?.toLowerCase() || '').includes(q) ||
        (c.phone || '').includes(q)
      );
    }

    if (statusFilter === 'blocked') {
      filtered = filtered.filter(isBlockedUser);
    } else if (statusFilter === 'active') {
      filtered = filtered.filter(c => !isBlockedUser(c));
    } else if (statusFilter === 'recent') {
      filtered = filtered.filter(c => c.created_at && new Date(c.created_at).getTime() >= sevenDaysAgoTime);
    }

    const paginated = filtered.slice(offset, offset + limit);

    const customers = paginated.map(c => ({
      ...c,
      is_blocked: isBlockedUser(c),
      status: isBlockedUser(c) ? 'blocked' : 'active'
    }));

    return res.json({
      ok: true,
      customers,
      pagination: {
        page,
        limit,
        total: filtered.length
      },
      stats: {
        totalCustomers: totalCount,
        activeCustomers: activeCount,
        blockedCustomers: blockedCount,
        newCustomers: newCount
      }
    });
  } catch (err: any) {
    console.error('[Admin Customers GET] Error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch customer management data.' });
  }
});

/**
 * 2. GET /api/admin/customers/:id
 * Detailed customer profile, order history, and activity summary.
 */
router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;

    const { data: customer, error: cErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', customerId)
      .single();

    if (cErr || !customer) {
      return res.status(404).json({ ok: false, error: 'Customer not found.' });
    }

    // Fetch customer recent orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_amount, status, created_at, items')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);

    const totalOrders = orders?.length || customer.total_orders || 0;
    const totalSpent = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || customer.lifetime_spend || 0;

    return res.json({
      ok: true,
      customer: {
        ...customer,
        is_blocked: customer.status === 'blocked' || customer.is_blocked === true,
        status: (customer.status === 'blocked' || customer.is_blocked === true) ? 'blocked' : 'active',
        total_orders: totalOrders,
        lifetime_spend: totalSpent
      },
      orders: orders || []
    });
  } catch (err: any) {
    console.error('[Admin Customer Detail GET] Error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch customer details.' });
  }
});

/**
 * 3. POST /api/admin/customers/:id/block
 * Safely blocks a customer account with reason, note, and audit logging.
 */
router.post('/:id/block', requireAdmin, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const adminUser = (req as any).user;
    const { reason, note } = req.body || {};

    const validReasons = [
      'Suspicious activity',
      'Payment issue',
      'Abuse of service',
      'Repeated policy violations',
      'Fraud prevention',
      'Other'
    ];

    const blockReason = validReasons.includes(reason) ? reason : 'Abuse of service';
    const blockNote = note ? String(note).trim() : null;
    const nowIso = new Date().toISOString();

    // Prevent blocking an administrator account
    const { data: targetUser } = await supabase
      .from('users')
      .select('role, email, settings')
      .eq('id', customerId)
      .maybeSingle();

    if (targetUser?.role === 'admin') {
      return res.status(400).json({ ok: false, error: 'Administrator accounts cannot be blocked.' });
    }

    let updatedUser: any = null;

    // First attempt: direct column update
    const { data: directUpdated, error: updateErr } = await supabase
      .from('users')
      .update({
        status: 'blocked',
        is_blocked: true,
        block_reason: blockReason,
        block_note: blockNote,
        blocked_at: nowIso,
        blocked_by: adminUser?.id || adminUser?.email || 'admin',
        updated_at: nowIso
      })
      .eq('id', customerId)
      .select()
      .maybeSingle();

    if (!updateErr && directUpdated) {
      updatedUser = directUpdated;
    } else {
      // Fallback attempt: store block status inside settings JSON
      const currentSettings = targetUser?.settings || {};
      const newSettings = {
        ...currentSettings,
        status: 'blocked',
        is_blocked: true,
        block_reason: blockReason,
        block_note: blockNote,
        blocked_at: nowIso,
        blocked_by: adminUser?.id || adminUser?.email || 'admin'
      };

      const { data: fallbackUpdated } = await supabase
        .from('users')
        .update({
          settings: newSettings,
          updated_at: nowIso
        })
        .eq('id', customerId)
        .select()
        .maybeSingle();

      updatedUser = fallbackUpdated || { id: customerId, settings: newSettings };
    }

    console.log(`[AUDIT] 🚫 Customer BLOCKED: ID=${customerId}, Email=${targetUser?.email || 'N/A'}, Admin=${adminUser?.email || adminUser?.id}, Reason=${blockReason}`);

    return res.json({
      ok: true,
      message: 'Customer has been blocked successfully.',
      customer: {
        ...updatedUser,
        is_blocked: true,
        status: 'blocked',
        block_reason: blockReason
      }
    });
  } catch (err: any) {
    console.error('[Admin Block Customer Error]:', err);
    return res.status(500).json({ ok: false, error: 'Failed to block customer. Please try again.' });
  }
});

/**
 * 4. POST /api/admin/customers/:id/unblock
 * Restores customer account access with audit logging.
 */
router.post('/:id/unblock', requireAdmin, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const adminUser = (req as any).user;
    const nowIso = new Date().toISOString();

    let updatedUser: any = null;

    const { data: directUpdated, error: updateErr } = await supabase
      .from('users')
      .update({
        status: 'active',
        is_blocked: false,
        block_reason: null,
        block_note: null,
        unblocked_at: nowIso,
        unblocked_by: adminUser?.id || adminUser?.email || 'admin',
        updated_at: nowIso
      })
      .eq('id', customerId)
      .select()
      .maybeSingle();

    if (!updateErr && directUpdated) {
      updatedUser = directUpdated;
    } else {
      const { data: currentUser } = await supabase
        .from('users')
        .select('settings')
        .eq('id', customerId)
        .maybeSingle();

      const currentSettings = currentUser?.settings || {};
      const newSettings = {
        ...currentSettings,
        status: 'active',
        is_blocked: false,
        block_reason: null,
        block_note: null,
        unblocked_at: nowIso,
        unblocked_by: adminUser?.id || adminUser?.email || 'admin'
      };

      const { data: fallbackUpdated } = await supabase
        .from('users')
        .update({
          settings: newSettings,
          updated_at: nowIso
        })
        .eq('id', customerId)
        .select()
        .maybeSingle();

      updatedUser = fallbackUpdated || { id: customerId, settings: newSettings };
    }

    console.log(`[AUDIT] ✅ Customer UNBLOCKED: ID=${customerId}, Admin=${adminUser?.email || adminUser?.id}`);

    return res.json({
      ok: true,
      message: 'Customer access restored successfully.',
      customer: {
        ...updatedUser,
        is_blocked: false,
        status: 'active'
      }
    });
  } catch (err: any) {
    console.error('[Admin Unblock Customer Error]:', err);
    return res.status(500).json({ ok: false, error: 'Failed to restore customer access.' });
  }
});

export default router;
