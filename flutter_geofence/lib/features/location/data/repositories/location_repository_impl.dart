import 'package:geolocator/geolocator.dart';
import '../../domain/models/delivery_zone.dart';
import '../../domain/repositories/location_repository.dart';
import '../datasources/location_remote_datasource.dart';

class LocationRepositoryImpl implements LocationRepository {
  final LocationRemoteDataSource _remoteDataSource;

  LocationRepositoryImpl(this._remoteDataSource);

  @override
  Future<bool> isGpsEnabled() async {
    return await Geolocator.isLocationServiceEnabled();
  }

  @override
  Future<LocationPermission> checkAndRequestPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission;
  }

  @override
  Future<Position> getCurrentLocation() async {
    // Battery efficient configuration
    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.medium,
      timeLimit: const Duration(seconds: 10),
    );
  }

  @override
  Future<List<DeliveryZone>> getActiveDeliveryZones() async {
    return await _remoteDataSource.fetchActiveZones();
  }

  @override
  Future<DeliveryZone?> validateDeliveryArea(Position position) async {
    final activeZones = await getActiveDeliveryZones();

    for (final zone in activeZones) {
      // Calculate distance securely on client side with Geolocator
      final double distanceInMeters = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        zone.latitude,
        zone.longitude,
      );

      if (distanceInMeters <= zone.radiusMeters) {
        return zone; // Success! Inside active geofence zone
      }
    }

    return null; // Outside all delivery geofences
  }
}
