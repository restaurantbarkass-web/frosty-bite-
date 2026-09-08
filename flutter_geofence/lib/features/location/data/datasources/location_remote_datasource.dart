import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/delivery_zone.dart';

abstract class LocationRemoteDataSource {
  Future<List<DeliveryZone>> fetchActiveZones();
}

class SupabaseLocationRemoteDataSourceImpl implements LocationRemoteDataSource {
  final SupabaseClient _supabaseClient;

  SupabaseLocationRemoteDataSourceImpl(this._supabaseClient);

  @override
  Future<List<DeliveryZone>> fetchActiveZones() async {
    try {
      final response = await _supabaseClient
          .from('delivery_zones')
          .select()
          .eq('active', true);

      final List<dynamic> data = response as List<dynamic>;
      return data.map((json) => DeliveryZone.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      throw Exception('Failed to fetch delivery zones from Supabase: $e');
    }
  }
}
