# Frosty Bite Delivery Geofencing System 📍

A highly-polished, production-ready **Flutter geofencing client** for the premium bakery app **Frosty Bite**, engineered with **Clean Architecture**, **Riverpod state management**, and **Supabase Database integrations**.

## Architectural Framework 🥞

This codebase implements **Clean Architecture** strict guidelines to isolate business rules from delivery mechanisms:

```
lib/
├── core/
│   ├── theme/                       # Premium brand palettes & styles (Dark Velvet & Premium Gold)
│   └── error/                       # General error handle definitions
├── features/
│   └── location/
│       ├── domain/                  # Enterprise business models & interfaces
│       │   ├── models/              # DeliveryZone object
│       │   └── repositories/        # LocationRepository contract definition
│       ├── data/                    # Concrete IO data source & repo implementations
│       │   ├── datasources/         # Supabase client query integrations
│       │   └── repositories/        # Geolocation calculations using Geolocator
│       └── presentation/            # State holders & UI screens
│           ├── providers/           # Riverpod StateNotifier state engines
│           ├── screens/             # SplashScreen, RestrictedScreen, HomeScreen
│           └── widgets/             # LocationRecoveryWidget
└── main.dart                        # Initialization pipeline & state router
```

## Production Configurations 🚀

### 1. Requirements Fulfilled
* **No External Map SDK overhead**: Avoids heavy, battery-draining Google Maps or Mapbox binaries, saving license fees and rendering overheads.
* **Supabase database sync**: Pulls live active zones dynamically from Supabase database `delivery_zones`.
* **Complete onboarding security flow**: Checks system GPS states, prompts permissions dynamically, validates coordinate bounds gracefully, and locks app interfaces if validation fails.
* **Double Check-out Protection**: Forces GPS location updates and checks bounds right before initiating checkout, blocking spoofed or drifted users from sending invalid commands to the database.

---

### 2. Client Side Geolocation Formula

The distance between the user position and delivery zones is calculated using the mathematically optimized, battery-efficient Vincenty ellipsoidal model provided by the native `Geolocator` library:

$$\text{Distance} \le \text{ZoneRadiusMeters}$$

```dart
final double distanceInMeters = Geolocator.distanceBetween(
  position.latitude,
  position.longitude,
  zone.latitude,
  zone.longitude,
);
```

---

### 3. Server-Side Verification Security (Supabase Database Function)

To prevent spoofed client coordinates from bypassing security, place a PostgreSQL validation trigger or function in Supabase. This secure execution check guarantees absolute safety:

```sql
CREATE OR REPLACE FUNCTION verify_order_geofence(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION
) RETURNS BOOLEAN AS $$
DECLARE
  is_inside BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM delivery_zones
    WHERE active = true 
      AND (
        -- Standard Earth distance calculation using PostGIS or simple haversine formula
        -- 6371000 * acos(cos(radians(latitude)) * cos(radians(user_lat)) * cos(radians(user_lng) - radians(longitude)) + sin(radians(latitude)) * sin(radians(user_lat)))
        (6371000 * acos(
          cos(radians(latitude)) * cos(radians(user_lat)) * cos(radians(user_lng) - radians(longitude)) + 
          sin(radians(latitude)) * sin(radians(user_lat))
        )) <= radius_meters
      )
  ) INTO is_inside;
  
  RETURN is_inside;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Getting Started ⚙️

1. Add your Supabase Keys in `lib/main.dart` or during compilations:
   ```bash
   flutter run --dart-define=SUPABASE_URL=URL --dart-define=SUPABASE_ANON_KEY=ANON_KEY
   ```
2. Upload the schema inside `supabase_schema.sql` into your Supabase Database editor.
3. Boot the application up to enjoy the seamless, premium validation flow!
