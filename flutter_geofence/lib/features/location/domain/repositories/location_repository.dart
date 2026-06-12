import 'package:geolocator/geolocator.dart';
import '../models/delivery_zone.dart';

abstract class LocationRepository {
  /// Checks whether GPS service is enabled on the device.
  Future<bool> isGpsEnabled();

  /// Checks and requests location permission.
  /// Returns the current permission status.
  Future<LocationPermission> checkAndRequestPermission();

  /// Gets the current GPS coordinates of the device.
  Future<Position> getCurrentLocation();

  /// Retrieves all active delivery zones from Supabase.
  Future<List<DeliveryZone>> getActiveDeliveryZones();

  /// Validates if a coordinate is inside any of the active delivery zones
  /// and returns the matched delivery zone or null.
  Future<DeliveryZone?> validateDeliveryArea(Position position);
}
