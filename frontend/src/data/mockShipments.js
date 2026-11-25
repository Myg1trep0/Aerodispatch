/**
 * AeroDispatch - Authentic User Consignments & Operations Store
 * 
 * Clean slate state: All demo/test consignments removed.
 * Ready for real-time user accounts and live bookings.
 */

export const MASTER_ADMIN_SHIPMENTS = [];

export const MOCK_SHIPMENTS = MASTER_ADMIN_SHIPMENTS;

export const MASTER_ADMIN_METRICS = {
  totalShipmentsToday: 0,
  activeInTransit: 0,
  outForDelivery: 0,
  deliveredToday: 0,
  failedExceptions: 0,
  onTimeSlaPercentage: 100.0,
  activeHubs: 3,
  activeFleetCount: 1
};
export const MOCK_ADMIN_METRICS = MASTER_ADMIN_METRICS;

export const MASTER_ADMIN_HUBS = [
  {
    id: 'HUB-BOM',
    name: 'Western Air Cargo Hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    status: 'OPERATIONAL',
    activeCouriers: 1,
    capacityUsage: 42
  },
  {
    id: 'HUB-DEL',
    name: 'Northern Linehaul Gateway',
    city: 'New Delhi',
    state: 'Delhi NCR',
    status: 'OPERATIONAL',
    activeCouriers: 0,
    capacityUsage: 28
  },
  {
    id: 'HUB-BLR',
    name: 'Southern Express Terminal',
    city: 'Bengaluru',
    state: 'Karnataka',
    status: 'OPERATIONAL',
    activeCouriers: 0,
    capacityUsage: 20
  }
];
export const MOCK_HUBS = MASTER_ADMIN_HUBS;

export const MASTER_ADMIN_DRIVERS = [
  {
    id: 'DRV-0214',
    driverId: 'DRV-0214',
    name: 'Captain Dispatch',
    email: 'captain.dispatch@aerodispatch.site',
    phone: '+91 98451 90214',
    vehicle: 'MH-02-EV-0214',
    vehicleType: 'Express Electric Cargo Van',
    operationalZone: 'Mumbai Metro & Central Corridor',
    zone: 'Mumbai Metro & Central Corridor',
    hub: 'Western Air Cargo Hub',
    status: 'AVAILABLE',
    rating: 5.0,
    tripsCompleted: 0
  }
];
export const MOCK_DRIVERS = MASTER_ADMIN_DRIVERS;

export const MOCK_NOTIFICATIONS = [];

export const MOCK_USERS = {};
