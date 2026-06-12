import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class LocationRecoveryWidget extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final String actionLabel;
  final VoidCallback onAction;

  const LocationRecoveryWidget({
    super.key,
    required this.title,
    required this.description,
    required this.icon,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(24),
        margin: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: FrostyBiteTheme.darkChocolate,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: FrostyBiteTheme.primaryGold.withOpacity(0.3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: FrostyBiteTheme.primaryGold.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: FrostyBiteTheme.primaryGold,
                size: 40,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: Theme.of(context).textTheme.displayMedium?.copyWith(fontSize: 20),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              description,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.white70,
                fontSize: 14,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onAction,
                child: Text(actionLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
