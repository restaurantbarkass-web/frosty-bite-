import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/delivery_zone.dart';
import '../../domain/repositories/location_repository.dart';
import '../../data/repositories/location_repository_impl.dart';
import '../../data/datasources/location_remote_datasource.dart';

// Provide Supabase Client (Initialized inside main.dart)
final supabaseClientProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

// Provide Remote Data Source
final locationRemoteDataSourceProvider = Provider<LocationRemoteDataSource>((ref) {
  final client = ref.watch(supabaseClientProvider);
  return SupabaseLocationRemoteDataSourceImpl(client);
});

// Provide Location Repository
final locationRepositoryProvider = Provider<LocationRepository>((ref) {
  final dataSource = ref.watch(locationRemoteDataSourceProvider);
  return LocationRepositoryImpl(dataSource);
});

// Sealed Class representing Location States
sealed class LocationState {
  const LocationState();
}

class LocationStateInitial extends LocationState {
  const LocationStateInitial();
}

class LocationStateChecking extends LocationState {
  const LocationStateChecking();
}

class LocationStatePermissionDenied extends LocationState {
  const LocationStatePermissionDenied();
}

class LocationStatePermissionPermanentlyDenied extends LocationState {
  const LocationStatePermissionPermanentlyDenied();
}

class LocationStateGpsDisabled extends LocationState {
  const LocationStateGpsDisabled();
}

class LocationStateFetchingZones extends LocationState {
  const LocationStateFetchingZones();
}

class LocationStateOutsideZone extends LocationState {
  final List<DeliveryZone> availableZones;
  const LocationStateOutsideZone({required this.availableZones});
}

class LocationStateInsideZone extends LocationState {
  final DeliveryZone matchedZone;
  final Position userPosition;
  const LocationStateInsideZone({required this.matchedZone, required this.userPosition});
}

class LocationStateError extends LocationState {
  final String message;
  const LocationStateError(this.message);
}

// Location Notifier to drive State Flows
class LocationNotifier extends StateNotifier<LocationState> {
  final LocationRepository _repository;

  LocationNotifier(this._repository) : super(const LocationStateInitial());

  /// Runs complete geofencing pipeline flow on startup or check trigger
  Future<void> runGeofencePipeline() async {
    state = const LocationStateChecking();

    try {
      // 1. Verify GPS service status
      final gpsActive = await _repository.isGpsEnabled();
      if (!gpsActive) {
        state = const LocationStateGpsDisabled();
        return;
      }

      // 2. Request / Verify permissions
      final permission = await _repository.checkAndRequestPermission();
      if (permission == LocationPermission.denied) {
        state = const LocationStatePermissionDenied();
        return;
      } else if (permission == LocationPermission.deniedForever) {
        state = const LocationStatePermissionPermanentlyDenied();
        return;
      }

      // 3. Obtain user GPS position (battery efficient limit)
      final position = await _repository.getCurrentLocation();

      // 4. Fetch dynamic active zones from Supabase
      state = const LocationStateFetchingZones();
      final activeZones = await _repository.getActiveDeliveryZones();

      if (activeZones.isEmpty) {
        state = const LocationStateError("No delivery zones are configured right now. Please check back soon.");
        return;
      }

      // 5. Geofence mathematical validation
      final matchedZone = await _repository.validateDeliveryArea(position);

      if (matchedZone != null) {
        state = LocationStateInsideZone(
          matchedZone: matchedZone,
          userPosition: position,
        );
      } else {
        state = LocationStateOutsideZone(availableZones: activeZones);
      }
    } catch (e) {
      state = LocationStateError("An unexpected error occurred during geo-validation: $e");
    }
  }

  /// Open application configuration settings to permit direct recovery
  Future<void> openSettings() async {
    await Geolocator.openAppSettings();
    runGeofencePipeline();
  }
}

// Provide Location State notifier
final locationProvider = StateNotifierProvider<LocationNotifier, LocationState>((ref) {
  final repository = ref.watch(locationRepositoryProvider);
  return LocationNotifier(repository);
});
