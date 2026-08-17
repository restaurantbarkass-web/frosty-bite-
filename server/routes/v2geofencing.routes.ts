import { Router, Request, Response } from 'express';
import { V2GeofencingService } from '../services/v2Geofencing.service';

const router = Router();

// ----------------------------------------------------------------------------
// SERVICE AREA
// ----------------------------------------------------------------------------
router.get(['/service-area', '/service-areas', '/geofencing/service-area', '/geofencing/service-areas'], async (req: Request, res: Response) => {
  try {
    const area = await V2GeofencingService.getServiceArea();
    res.json(area);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch service area', details: err.message });
  }
});

router.patch(['/service-area', '/service-areas', '/geofencing/service-area', '/geofencing/service-areas'], async (req: Request, res: Response) => {
  try {
    const updated = await V2GeofencingService.updateServiceArea(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update service area', details: err.message });
  }
});

// ----------------------------------------------------------------------------
// CITIES
// ----------------------------------------------------------------------------
router.get(['/cities', '/geofencing/cities'], async (req: Request, res: Response) => {
  try {
    const cities = await V2GeofencingService.getCities();
    res.json(cities);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch cities', details: err.message });
  }
});

router.post(['/cities', '/geofencing/cities'], async (req: Request, res: Response) => {
  try {
    const { name, state, country, is_active, boundary } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'City name is required' });
    }
    const created = await V2GeofencingService.createCity({ name, state, country, is_active, boundary });
    res.status(201).json(created);
  } catch (err: any) {
    console.error('Error creating city:', err);
    res.status(400).json({ error: err.message || 'Failed to create city', details: err.stack });
  }
});

router.patch(['/cities/:id', '/geofencing/cities/:id'], async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await V2GeofencingService.updateCity(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update city', details: err.message });
  }
});

router.delete(['/cities/:id', '/geofencing/cities/:id'], async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await V2GeofencingService.deleteCity(id);
    res.json({ success: true, message: `City ${id} deleted` });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to delete city', details: err.message });
  }
});

// ----------------------------------------------------------------------------
// PINCODES
// ----------------------------------------------------------------------------
router.get(['/pincodes', '/geofencing/pincodes'], async (req: Request, res: Response) => {
  try {
    const cityId = req.query.city_id as string | undefined;
    const pincodes = await V2GeofencingService.getPincodes(cityId);
    res.json(pincodes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch pincodes', details: err.message });
  }
});

router.post(['/pincodes', '/geofencing/pincodes'], async (req: Request, res: Response) => {
  try {
    const { city_id, pincode, is_active, boundary } = req.body;
    if (!city_id || !pincode) {
      return res.status(400).json({ error: 'city_id and pincode are required' });
    }
    const created = await V2GeofencingService.createPincode({ city_id, pincode, is_active, boundary });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create pincode' });
  }
});

router.patch(['/pincodes/:id', '/geofencing/pincodes/:id'], async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await V2GeofencingService.updatePincode(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update pincode' });
  }
});

router.delete(['/pincodes/:id', '/geofencing/pincodes/:id'], async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await V2GeofencingService.deletePincode(id);
    res.json({ success: true, message: `Pincode ${id} deleted` });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to delete pincode', details: err.message });
  }
});

// ----------------------------------------------------------------------------
// LOCALITIES
// ----------------------------------------------------------------------------
router.get(['/localities', '/geofencing/localities'], async (req: Request, res: Response) => {
  try {
    const cityId = req.query.city_id as string | undefined;
    const pincodeId = req.query.pincode_id as string | undefined;
    const localities = await V2GeofencingService.getLocalities(cityId, pincodeId);
    res.json(localities);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch localities', details: err.message });
  }
});

router.post(['/localities', '/geofencing/localities'], async (req: Request, res: Response) => {
  try {
    const { city_id, pincode_id, name, is_active, delivery_fee, minimum_order, estimated_delivery_minutes, boundary } = req.body;
    if (!city_id || !name) {
      return res.status(400).json({ error: 'city_id and locality name are required' });
    }
    const created = await V2GeofencingService.createLocality({
      city_id,
      pincode_id,
      name,
      is_active,
      delivery_fee,
      minimum_order,
      estimated_delivery_minutes,
      boundary
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create locality', details: err.message });
  }
});

router.patch(['/localities/:id', '/geofencing/localities/:id'], async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await V2GeofencingService.updateLocality(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update locality', details: err.message });
  }
});

router.delete(['/localities/:id', '/geofencing/localities/:id'], async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await V2GeofencingService.deleteLocality(id);
    res.json({ success: true, message: `Locality ${id} deleted` });
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to delete locality', details: err.message });
  }
});

// ----------------------------------------------------------------------------
// POSTGIS SERVICEABILITY ENGINE CHECK
// POST /api/v2/geofencing/check or POST /api/v2/check
// ----------------------------------------------------------------------------
const handleServiceabilityCheck = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body || {};
    const result = await V2GeofencingService.checkServiceability({ latitude, longitude });
    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[V2 Geofencing Route Error]', err);
    res.status(500).json({
      serviceable: false,
      reason: 'INTERNAL_ERROR',
      message: "We currently don't deliver to this area."
    });
  }
};

router.post('/geofencing/check', handleServiceabilityCheck);
router.post('/check', handleServiceabilityCheck);

export default router;
