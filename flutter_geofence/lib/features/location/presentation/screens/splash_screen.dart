import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../../../../core/theme/app_theme.dart';
import '../providers/location_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );

    _animationController.forward().then((_) {
      // Execute the location validation pipeline once entry transition is complete
      ref.read(locationProvider.notifier).runGeofencePipeline();
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          color: FrostyBiteTheme.deepVelvet,
        ),
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Minimalist stylized Premium Bakery Brand Vector Placeholder
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: FrostyBiteTheme.darkChocolate,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: FrostyBiteTheme.primaryGold, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: FrostyBiteTheme.primaryGold.withOpacity(0.2),
                        blurRadius: 20,
                        spreadRadius: 5,
                      )
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.bakery_dining,
                      color: FrostyBiteTheme.primaryGold,
                      size: 52,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  "FROSTY BITE",
                  style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    letterSpacing: 4.0,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  "PREMIUM CONFECTIONERY & BAKERY",
                  style: Theme.of(context).textTheme.labelLarge,
                ),
                const SizedBox(height: 64),
                const SpinKitDoubleBounce(
                  color: FrostyBiteTheme.primaryGold,
                  size: 40.0,
                ),
                const SizedBox(height: 16),
                Text(
                  "Syncing Neural Geofence Client...",
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
