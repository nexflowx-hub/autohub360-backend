import type { FastifyInstance } from 'fastify';
import { supabaseService } from '../supabase.js';

const PUBLIC_CODE_RE = /^AH[A-F0-9]{16}$/;

export async function registerPublicTrackingRoutes(app: FastifyInstance) {
  app.get('/api/v1/tracking/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const normalized = code.trim().toUpperCase();

    if (!PUBLIC_CODE_RE.test(normalized)) {
      return reply.code(400).send({ success: false, error: 'INVALID_TRACKING_CODE' });
    }

    const db = supabaseService();
    const { data: shipment, error } = await db
      .from('shipments')
      .select('id,public_code,carrier,tracking_code,status,estimated_delivery,last_event_at,delivered_at,created_at,updated_at,orders!inner(number,status,market)')
      .eq('public_code', normalized)
      .maybeSingle();

    if (error) throw error;
    if (!shipment) {
      return reply.code(404).send({ success: false, error: 'TRACKING_NOT_FOUND' });
    }

    const { data: events, error: eventsError } = await db
      .from('shipment_events')
      .select('event_code,status,title,description,location,occurred_at')
      .eq('shipment_id', shipment.id)
      .order('occurred_at', { ascending: false });

    if (eventsError) throw eventsError;

    return {
      success: true,
      data: {
        publicCode: shipment.public_code,
        carrier: shipment.carrier,
        trackingCode: shipment.tracking_code,
        status: shipment.status,
        estimatedDelivery: shipment.estimated_delivery,
        lastEventAt: shipment.last_event_at,
        deliveredAt: shipment.delivered_at,
        order: shipment.orders,
        events: events ?? [],
      },
    };
  });
}
