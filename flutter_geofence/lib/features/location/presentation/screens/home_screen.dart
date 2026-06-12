import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/delivery_zone.dart';
import '../providers/location_provider.dart';

class HomeScreen extends ConsumerStatefulWidget {
  final DeliveryZone currentZone;
  final Position initialPosition;

  const HomeScreen({
    super.key,
    required this.currentZone,
    required this.initialPosition,
  });

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _isCheckingCheckout = false;

  /// Secure verification check right before checkout execution
  Future<void> _processSecureCheckout(String itemName) async {
    setState(() {
      _isCheckingCheckout = true;
    });

    try {
      final repository = ref.read(locationRepositoryProvider);
      
      // 1. Fetch exact real-time GPS coordinates
      final freshPosition = await repository.getCurrentLocation();
      
      // 2. Validate geofence boundaries securely on clientside
      final matchedZone = await repository.validateDeliveryArea(freshPosition);

      if (matchedZone == null) {
        // High alert security drift: user moved outside boundaries
        _showOrderBlockedDialog(
          "Security Boundary Breach",
          "Our system detected that your coordinates lie outside our delivery zone. To preserve flavor and quality, we cannot complete checkout for $itemName from this location."
        );
        
        // Push state back to outside zone
        ref.read(locationProvider.notifier).runGeofencePipeline();
      } else {
        // Success check! Proceed to place order
        _showOrderSuccessDialog(matchedZone, itemName);
      }
    } catch (e) {
      _showOrderBlockedDialog(
        "Location Sync Lost",
        "Unable to securely verify coordinates for checking out $itemName. Please check GPS settings and try again: $e"
      );
    } finally {
      setState(() {
        _isCheckingCheckout = false;
      });
    }
  }

  void _showOrderSuccessDialog(DeliveryZone zone, String itemName) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1C1C24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Colors.pinkAccent),
        ),
        title: Row(
          children: [
            const Icon(Icons.check_circle_outline, color: Colors.pinkAccent),
            const SizedBox(width: 8),
            Text(
              "Order Authorized",
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontSize: 18,
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ],
        ),
        content: Text(
          "Your selection of '$itemName' is authorized for instant dispatch to '${zone.name}'. Prep has started! 🍰",
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("EXQUISITE", style: TextStyle(color: Colors.pinkAccent, fontWeight: FontWeight.bold)),
          )
        ],
      ),
    );
  }

  void _showOrderBlockedDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1C1C24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Colors.redAccent),
        ),
        title: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.redAccent),
            const SizedBox(width: 8),
            Text(
              title,
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontSize: 18,
                    color: Colors.redAccent,
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ],
        ),
        content: Text(
          message,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("OK", style: TextStyle(color: Colors.redAccent)),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F12),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Bar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Frosty Bite 🍰",
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.location_on, color: Colors.pinkAccent, size: 14),
                          const SizedBox(width: 4),
                          Text(
                            "Serving in ${widget.currentZone.name}",
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white60,
                            ),
                          ),
                        ],
                      )
                    ],
                  ),
                  const CircleAvatar(
                    backgroundColor: Colors.pinkAccent,
                    child: Icon(Icons.person, color: Colors.white),
                  )
                ],
              ),

              const SizedBox(height: 20),

              // Hero Banner
              Container(
                height: 160,
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF4D6D), Color(0xFFFF8FA3)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.pinkAccent.withOpacity(0.3),
                      blurRadius: 15,
                      offset: const Offset(0, 5),
                    )
                  ],
                ),
                child: const Align(
                  alignment: Alignment.bottomLeft,
                  child: Text(
                    "Fresh Cakes\nDelivered in Minutes",
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      height: 1.2,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 25),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "Popular Items",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (_isCheckingCheckout)
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.pinkAccent),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 12),

              // Product Cards Grid
              Expanded(
                child: GridView.count(
                  crossAxisCount: 2,
                  childAspectRatio: 0.78,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  children: [
                    _buildPopularCard("Chocolate Cake", "199", Icons.cake_outlined),
                    _buildPopularCard("Strawberry Cupcake", "99", Icons.cookie_outlined),
                    _buildPopularCard("Blueberry Donut", "129", Icons.donut_large_outlined),
                    _buildPopularCard("Vanilla Pastry", "89", Icons.icecream_outlined),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPopularCard(String title, String price, IconData icon) {
    return GestureDetector(
      onTap: _isCheckingCheckout ? null : () => _processSecureCheckout(title),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1C1C24),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: Colors.pinkAccent.withOpacity(0.1),
                ),
                child: Center(
                  child: Icon(icon, size: 44, color: Colors.pinkAccent),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "₹$price",
                  style: const TextStyle(
                    color: Colors.pinkAccent,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const Icon(
                  Icons.arrow_forward_rounded,
                  size: 14,
                  color: Colors.white30,
                )
              ],
            )
          ],
        ),
      ),
    );
  }
}
