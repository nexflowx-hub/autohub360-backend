import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireInternalAuth } from '../internal-auth.js';
import { supabaseService } from '../supabase.js';

const protectedRoute = { preHandler: requireInternalAuth } as const;
const limitSchema = z.coerce.number().int().min(1).max(100).default(50);
const shipmentEventSchema = z.object({
  status: z.enum(['created', 'labeled', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned']),
  eventCode: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  occurredAt: z.string().datetime().optional(),
});

function parseLimit(input: unknown) {
  const raw = (input as { limit?: unknown } | undefined)?.limit ?? 50;
  return limitSchema.parse(raw);
}

export async function registerAdminOperationRoutes(app: FastifyInstance) {
  app.get('/api/v1/admin/crm/contacts', protectedRoute, async (request) => {
    const { stage } = request.query as { stage?: string };
    const db = supabaseService();
    let query = db
      .from('crm_contacts')
      .select('id,market,full_name,email,phone,company,lifecycle_stage,source,owner,tags,consent_marketing,lifetime_value_cents,currency,last_activity_at,created_at,updated_at')
      .order('last_activity_at', { ascending: false })
      .limit(parseLimit(request.query));
    if (stage) query = query.eq('lifecycle_stage', stage);
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.get('/api/v1/admin/orders', protectedRoute, async (request) => {
    const { status } = request.query as { status?: string };
    const db = supabaseService();
    let query = db
      .from('orders')
      .select('id,number,market,status,customer_name,customer_email,customer_phone,delivery_method,shipping_option,shipping_cents,installation_cents,subtotal_cents,discount_cents,total_cents,currency,coupon_code,demo,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(parseLimit(request.query));
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.get('/api/v1/admin/shipments', protectedRoute, async (request) => {
    const { status } = request.query as { status?: string };
    const db = supabaseService();
    let query = db
      .from('shipments')
      .select('id,order_id,public_code,carrier,tracking_code,status,estimated_delivery,last_event_at,delivered_at,created_at,updated_at,orders(number,status,market,customer_name,customer_email)')
      .order('created_at', { ascending: false })
      .limit(parseLimit(request.query));
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.post('/api/v1/admin/shipments/:id/events', protectedRoute, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = shipmentEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ success: false, error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
    }

    const body = parsed.data;
    const db = supabaseService();
    const { data, error } = await db
      .from('shipment_events')
      .insert({
        shipment_id: id,
        event_code: body.eventCode,
        status: body.status,
        title: body.title,
        description: body.description ?? null,
        location: body.location ?? null,
        occurred_at: body.occurredAt ?? new Date().toISOString(),
      })
      .select('id,event_code,status,title,description,location,occurred_at,created_at')
      .single();
    if (error) throw error;
    return reply.code(201).send({ success: true, data });
  });

  app.get('/api/v1/admin/automations/outbox', protectedRoute, async (request) => {
    const { status } = request.query as { status?: string };
    const db = supabaseService();
    let query = db
      .from('notification_outbox')
      .select('id,contact_id,order_id,case_id,rule_id,template_code,market,channel,destination,status,scheduled_for,sent_at,attempts,provider,provider_ref,error,created_at,updated_at')
      .order('scheduled_for', { ascending: false })
      .limit(parseLimit(request.query));
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.post('/api/v1/admin/automations/outbox/:id/retry', protectedRoute, async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = supabaseService();
    const { data, error } = await db
      .from('notification_outbox')
      .update({ status: 'queued', scheduled_for: new Date().toISOString(), error: null })
      .eq('id', id)
      .select('id,status,scheduled_for,attempts')
      .maybeSingle();
    if (error) throw error;
    if (!data) return reply.code(404).send({ success: false, error: 'OUTBOX_ITEM_NOT_FOUND' });
    return { success: true, data };
  });
}
