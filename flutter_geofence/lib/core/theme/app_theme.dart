import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class FrostyBiteTheme {
  // Brand Colors
  static const Color primaryGold = Color(0xFFD4AF37);
  static const Color deepVelvet = Color(0xFF1B1212);
  static const Color creamIce = Color(0xFFFFFDD0);
  static const Color darkChocolate = Color(0xFF2C1E1A);
  static const Color warmGrey = Color(0xFF8A7968);
  static const Color errorRed = Color(0xFFD32F2F);

  static ThemeData get premiumDarkTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: const ColorScheme.dark(
        primary: primaryGold,
        secondary: creamIce,
        background: deepVelvet,
        surface: darkChocolate,
        error: errorRed,
      ),
      scaffoldBackgroundColor: deepVelvet,
      textTheme: TextTheme(
        displayLarge: GoogleFonts.spaceGrotesk(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: creamIce,
          letterSpacing: -0.5,
        ),
        displayMedium: GoogleFonts.spaceGrotesk(
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: creamIce,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: 16,
          fontWeight: FontWeight.normal,
          color: Colors.white,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: 14,
          color: warmGrey,
        ),
        labelLarge: GoogleFonts.jetBrainsMono(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: primaryGold,
          letterSpacing: 2.0,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryGold,
          foregroundColor: deepVelvet,
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          textStyle: GoogleFonts.inter(
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryGold,
          textStyle: GoogleFonts.inter(
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}
