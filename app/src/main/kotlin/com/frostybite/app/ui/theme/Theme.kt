package com.frostybite.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = GoldAccent,
    onPrimary = DarkBackground,
    secondary = MintIceCream,
    onSecondary = DarkBackground,
    tertiary = DustyLavender,
    background = DarkBackground,
    onBackground = TextPrimary,
    surface = DarkSurface,
    onSurface = TextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    outline = BoardBorder
)

@Composable
fun FrostyBiteTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme, // Force premium dark theme corresponding to Frosty Bite's vibe!
        typography = Typography,
        content = content
    )
}
