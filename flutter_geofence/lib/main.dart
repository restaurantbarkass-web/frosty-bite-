import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/theme/app_theme.dart';
import 'features/location/presentation/providers/location_provider.dart';
import 'features/location/presentation/screens/splash_screen.dart';
import 'features/location/presentation/screens/restricted_screen.dart';
import 'features/location/presentation/screens/home_screen.dart';
import 'features/location/presentation/widgets/restricted_dialog.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Supabase.
  // Using environment variables with fallback placeholders.
  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://placeholder.supabase.co'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: 'placeholder-anon-key'),
  );

  runApp(
    const ProviderScope(
      child: FrostyBiteApp(),
    ),
  );
}

class FrostyBiteApp extends ConsumerWidget {
  const FrostyBiteApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch location state dynamically
    final locationState = ref.watch(locationProvider);

    return MaterialApp(
      title: 'Frosty Bite',
      debugShowCheckedModeBanner: false,
      theme: FrostyBiteTheme.premiumDarkTheme,
      home: _buildHomeState(context, locationState, ref),
    );
  }

  /// Evaluates state to return corresponding production screen layout securely
  Widget _buildHomeState(BuildContext context, LocationState state, WidgetRef ref) {
    switch (state) {
      case LocationStateInitial():
      case LocationStateChecking():
      case LocationStateFetchingZones():
        return const SplashScreen();

      case LocationStateInsideZone(matchedZone: final zone, userPosition: final position):
        return HomeScreen(
          currentZone: zone,
          initialPosition: position,
        );

      case LocationStateOutsideZone(availableZones: final zones):
        return RestrictedScreen(
          availableZones: zones,
        );

      case LocationStateGpsDisabled():
        return Scaffold(
          body: LocationRecoveryWidget(
            title: "GPS Location Disabled",
            description: "To serve you our fresh bakery items, we require active GPS location services. Please enable location on your device.",
            icon: Icons.gps_off,
            actionLabel: "REFRESH & CONNECT",
            onAction: () => ref.read(locationProvider.notifier).runGeofencePipeline(),
          ),
        );

      case LocationStatePermissionDenied():
        return Scaffold(
          body: LocationRecoveryWidget(
            title: "Location Permission Denied",
            description: "To confirm delivery availability, Frosty Bite require background or current location permissions inside our service areas.",
            icon: Icons.location_disabled_outlined,
            actionLabel: "PROMPT PERMISSION",
            onAction: () => ref.read(locationProvider.notifier).runGeofencePipeline(),
          ),
        );

      case LocationStatePermissionPermanentlyDenied():
        return Scaffold(
          body: LocationRecoveryWidget(
            title: "Permission Locked",
            description: "Location permission is permanently denied. You must open system settings and permit location manual access before checkout.",
            icon: Icons.lock_outline,
            actionLabel: "OPEN SYSTEM SETTINGS",
            onAction: () => ref.read(locationProvider.notifier).openSettings(),
          ),
        );

      case LocationStateError(message: final msg):
        return Scaffold(
          body: LocationRecoveryWidget(
            title: "Validation Issue Detected",
            description: msg,
            icon: Icons.error_outline_rounded,
            actionLabel: "REVAL_COORDINATES",
            onAction: () => ref.read(locationProvider.notifier).runGeofencePipeline(),
          ),
        );
    }
  }
}
