import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireInternalAuth } from '../internal-auth.js';
import { supabaseService } from '../supabase.js';

const protectedRoute = { preHandler: requireInternalAuth } as const;
const limitSchema = z.coerce.number().int().min(1).max(100).default(50);
const shipmentStatusSchema = z.enum(['created', 'labeled', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned']);
const automationStatusSchema = z.enum(['draft', 'active', 'paused']);
const shipmentEventSchema = z.object({
  status: shipmentStatusSchema,
  eventCode: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  occurredAt: z.string().datetime().optional(),
});
const shipmentEventByIdentifierSchema = shipmentEventSchema.extend({
  shipment: z.string().trim().min(3).max(120),
});
const automationRuleStatusSchema = z.object({ status: automationStatusSchema });

function parseLimit(input: unknown) {
  const raw = (input as { limit?: unknown } | undefined)?.limit ?? 50;
  return limitSchema.parse(raw);
}

async function insertShipmentEvent(shipmentId: string, input: z.infer<typeof shipmentEventSchema>) {
  const db = supabaseService();
  const { data, error } = await db
    .from('shipment_events')
    .insert({
      shipment_id: shipmentId,
      event_code: input.eventCode,
      status: input.status,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select('id,event_code,status,title,description,location,occurred_at,created_at')
    .single();
  if (error) throw error;
  return data;
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

  app.get('/api/v1/admin/crm/activities', protectedRoute, async (request) => {
    const db = supabaseService();
    const { data, error } = await db
      .from('crm_activities')
      .select('id,contact_id,kind,direction,subject,body,actor,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(parseLimit(request.query));
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.get('/api/v1/admin/crm/sessions', protectedRoute, async (request) => {
    const db = supabaseService();
    const { data, error } = await db
      .from('web_sessions')
      .select('id,session_id,contact_id,lead_id,market,first_path,last_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,device,browser,event_count,first_seen_at,last_seen_at,metadata')
      .order('last_seen_at', { ascending: false })
      .limit(parseLimit(request.query));
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.get('/api/v1/admin/leads', protectedRoute, async (request) => {
    const db = supabaseService();
    const { data, error } = await db
      .from('leads')
      .select('id,status,source,utm_source,utm_medium,utm_campaign,created_at')
      .order('created_at', { ascending: false })
      .limit(parseLimit(request.query));
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

  app.get('/api/v1/admin/shipments/events', protectedRoute, async (request) => {
    const db = supabaseService();
    const { data, error } = await db
      .from('shipment_events')
      .select('id,shipment_id,event_code,status,title,description,location,occurred_at,created_at')
      .order('occurred_at', { ascending: false })
      .limit(parseLimit(request.query));
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.post('/api/v1/admin/shipments/events', protectedRoute, async (request, reply) => {
    const parsed = shipmentEventByIdentifierSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ success: false, error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
    }

    const db = supabaseService();
    const identifier = parsed.data.shipment;
    let { data: shipment, error } = await db
      .from('shipments')
      .select('id,public_code,tracking_code')
      .eq('public_code', identifier.toUpperCase())
      .maybeSingle();
    if (error) throw error;

    if (!shipment) {
      const result = await db
        .from('shipments')
        .select('id,public_code,tracking_code')
        .eq('tracking_code', identifier)
        .maybeSingle();
      if (result.error) throw result.error;
      shipment = result.data;
    }

    if (!shipment) return reply.code(404).send({ success: false, error: 'SHIPMENT_NOT_FOUND' });

    const data = await insertShipmentEvent(shipment.id, {
      status: parsed.data.status,
      eventCode: parsed.data.eventCode,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      occurredAt: parsed.data.occurredAt,
    });
    return reply.code(201).send({ success: true, data, publicCode: shipment.public_code });
  });

  app.post('/api/v1/admin/shipments/:id/events', protectedRoute, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = shipmentEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ success: false, error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
    }
    const data = await insertShipmentEvent(id, parsed.data);
    return reply.code(201).send({ success: true, data });
  });

  app.get('/api/v1/admin/automations/rules', protectedRoute, async (request) => {
    const db = supabaseService();
    const { data, error } = await db
      .from('automation_rules')
      .select('id,code,name,trigger_event,market,audience,channel,template_code,delay_minutes,frequency_cap_hours,conditions,status,created_at,updated_at')
      .order('created_at', { ascending: true })
      .limit(parseLimit(request.query));
    if (error) throw error;
    return { success: true, data: data ?? [] };
  });

  app.patch('/api/v1/admin/automations/rules/:code', protectedRoute, async (request, reply) => {
    const { code } = request.params as { code: string };
    const parsed = automationRuleStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: 'INVALID_PAYLOAD' });
    const db = supabaseService();
    const { data, error } = await db
      .from('automation_rules')
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq('code', code)
      .select('id,code,status,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return reply.code(404).send({ success: false, error: 'AUTOMATION_RULE_NOT_FOUND' });
    return { success: true, data };
  });

  app.get('/api/v1/admin/automations/templates', protectedRoute, async (request) => {
    const db = supabaseService();
    const { data, error } = await db
      .from('notification_templates')
      .select('id,code,market,channel,name,subject,body,variables,status,created_at,updated_at')
      .order('code', { ascending: true })
      .limit(parseLimit(request.query));
    if (error) throw error;
    return { success: true, data: data ?? [] };
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
