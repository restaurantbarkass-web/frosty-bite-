package com.frostybite.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.frostybite.app.data.MockData
import com.frostybite.app.data.Product
import com.frostybite.app.ui.theme.*

@Composable
fun ProductVisual(category: String, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxSize()) {
        val width = size.width
        val height = size.height
        val centerX = width / 2
        val centerY = height / 2

        when (category) {
            "Cakes" -> {
                // Draw a beautiful multi-tiered Frosty Cake
                // Bottom tier
                drawRoundRect(
                    color = Color(0xFFFFB7B2),
                    topLeft = Offset(centerX - 40dp.toPx(), centerY),
                    size = Size(80dp.toPx(), 30dp.toPx()),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(6dp.toPx())
                )
                // Top tier
                drawRoundRect(
                    color = Color(0xFFFFD1D1),
                    topLeft = Offset(centerX - 30dp.toPx(), centerY - 25dp.toPx()),
                    size = Size(60dp.toPx(), 25dp.toPx()),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(4dp.toPx())
                )
                // Frosting & Candle
                drawCircle(
                    color = Color(0xFFFFD700),
                    radius = 6dp.toPx(),
                    center = Offset(centerX, centerY - 32dp.toPx())
                )
                drawRect(
                    color = Color(0xFFCCA736),
                    topLeft = Offset(centerX - 2dp.toPx(), centerY - 45dp.toPx()),
                    size = Size(4dp.toPx(), 15dp.toPx())
                )
            }
            "Pastries" -> {
                // Draw a flaky golden croissant
                val path = Path().apply {
                    moveTo(centerX - 35dp.toPx(), centerY + 10dp.toPx())
                    quadraticTo(centerX, centerY - 25dp.toPx(), centerX + 35dp.toPx(), centerY + 10dp.toPx())
                    quadraticTo(centerX, centerY + 20dp.toPx(), centerX - 35dp.toPx(), centerY + 10dp.toPx())
                }
                drawPath(path = path, color = Color(0xFFE29578))

                // Croissant lines
                drawArc(
                    color = Color(0xFFB07259),
                    startAngle = 180f,
                    sweepAngle = 180f,
                    useCenter = false,
                    topLeft = Offset(centerX - 15dp.toPx(), centerY - 15dp.toPx()),
                    size = Size(30dp.toPx(), 30dp.toPx()),
                    style = Stroke(width = 3dp.toPx())
                )
            }
            "Breads" -> {
                // Draw a classic golden-brown sourdough loaf
                drawOval(
                    color = Color(0xFFD4A373),
                    topLeft = Offset(centerX - 45dp.toPx(), centerY - 20dp.toPx()),
                    size = Size(90dp.toPx(), 45dp.toPx())
                )
                // Crust scores
                drawLine(
                    color = Color(0xFF8F5D38),
                    start = Offset(centerX - 20dp.toPx(), centerY - 10dp.toPx()),
                    end = Offset(centerX - 5dp.toPx(), centerY + 10dp.toPx()),
                    strokeWidth = 3dp.toPx()
                )
                drawLine(
                    color = Color(0xFF8F5D38),
                    start = Offset(centerX, centerY - 10dp.toPx()),
                    end = Offset(centerX + 15dp.toPx(), centerY + 10dp.toPx()),
                    strokeWidth = 3dp.toPx()
                )
            }
            "Cookies" -> {
                // Draw a mouth-watering chocolate chip cookie
                drawCircle(
                    color = Color(0xFFE6CCB2),
                    radius = 35dp.toPx(),
                    center = Offset(centerX, centerY)
                )
                // Chocolate chips
                drawCircle(color = Color(0xFF432818), radius = 5dp.toPx(), center = Offset(centerX - 15dp.toPx(), centerY - 10dp.toPx()))
                drawCircle(color = Color(0xFF432818), radius = 4dp.toPx(), center = Offset(centerX + 15dp.toPx(), centerY + 8dp.toPx()))
                drawCircle(color = Color(0xFF432818), radius = 6dp.toPx(), center = Offset(centerX - 2dp.toPx(), centerY + 18dp.toPx()))
                drawCircle(color = Color(0xFF432818), radius = 4dp.toPx(), center = Offset(centerX + 5dp.toPx(), centerY - 15dp.toPx()))
            }
            "Beverages" -> {
                // Draw a cozy hot cup of caramel latte
                drawRoundRect(
                    color = Color(0xFFDEC9E9),
                    topLeft = Offset(centerX - 25dp.toPx(), centerY - 20dp.toPx()),
                    size = Size(50dp.toPx(), 50dp.toPx()),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(8dp.toPx())
                )
                // Cup handle
                drawArc(
                    color = Color(0xFFDEC9E9),
                    startAngle = -90f,
                    sweepAngle = 180f,
                    useCenter = false,
                    topLeft = Offset(centerX + 12dp.toPx(), centerY - 12dp.toPx()),
                    size = Size(24dp.toPx(), 24dp.toPx()),
                    style = Stroke(width = 5dp.toPx())
                )
                // Warm froth surface
                drawOval(
                    color = Color(0xFFFFF2D8),
                    topLeft = Offset(centerX - 20dp.toPx(), centerY - 23dp.toPx()),
                    size = Size(40dp.toPx(), 8dp.toPx())
                )
            }
            else -> {
                // General lovely treat box
                drawRoundRect(
                    color = Color(0xFFA8E6CF),
                    topLeft = Offset(centerX - 30dp.toPx(), centerY - 30dp.toPx()),
                    size = Size(60dp.toPx(), 60dp.toPx()),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(10dp.toPx())
                )
                drawCircle(
                    color = Color(0xFFFFD700),
                    radius = 8dp.toPx(),
                    center = Offset(centerX, centerY)
                )
            }
        }
    }
}

@Composable
fun HomeScreen(
    onNavigateToDetail: (String) -> Unit,
    onAddToCart: (Product) -> Unit,
    onNavigateToCart: () -> Unit,
    onNavigateToProfile: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("All") }
    var recommendationsState by remember { mutableStateOf<String?>(null) }
    var isRecommending by remember { mutableStateOf(false) }

    val filteredProducts = MockData.products.filter {
        (selectedCategory == "All" || it.category == selectedCategory) &&
        (searchQuery.isEmpty() || it.name.contains(searchQuery, ignoreCase = true) || it.description.contains(searchQuery, ignoreCase = true))
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // App header spacing
        item { Spacer(modifier = Modifier.height(24.dp)) }

        // Hero Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "FROSTY BITE",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        color = GoldAccent,
                        letterSpacing = 2.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Artisan Bakery",
                        fontSize = 28.sp,
                        fontFamily = FontFamily.SansSerif,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.5).sp
                    )
                }

                // Profile and Cart fast actions
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = onNavigateToProfile,
                        modifier = Modifier
                            .size(44.dp)
                            .background(DarkSurface, CircleShape)
                    ) {
                        Text("👤", fontSize = 18.sp)
                    }
                    IconButton(
                        onClick = onNavigateToCart,
                        modifier = Modifier
                            .size(44.dp)
                            .background(DarkSurface, CircleShape)
                    ) {
                        Text("🛒", fontSize = 18.sp)
                    }
                }
            }
        }

        // Search bar
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(12.dp)),
                placeholder = { Text("Search treats, cakes & pastries...", color = TextSecondary) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = GoldAccent) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GoldAccent,
                    unfocusedBorderColor = BoardBorder,
                    focusedContainerColor = DarkSurface,
                    unfocusedContainerColor = DarkSurface,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )
        }

        // Categories selector
        item {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 4.dp)
            ) {
                items(MockData.categories) { category ->
                    val isSelected = category == selectedCategory
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) GoldAccent else DarkSurface)
                            .clickable { selectedCategory = category }
                            .padding(horizontal = 18.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = category,
                            color = if (isSelected) DarkBackground else TextSecondary,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }

        // AI Butler Assistant Banner
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, GoldAccent.copy(alpha = 0.2f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("🤖", fontSize = 22.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Ask AI Butler",
                                style = MaterialTheme.typography.titleMedium,
                                color = GoldAccent,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        if (isRecommending) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = GoldAccent,
                                strokeWidth = 2.dp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Not sure what to satisfy your sweet tooth with? Let our AI Butler curate a magical culinary combo for you!",
                        color = TextSecondary,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )

                    Spacer(modifier = Modifier.height(12.dp))
                    
                    if (recommendationsState == null) {
                        Button(
                            onClick = {
                                isRecommending = true
                                // Simulate smart, personalized curation
                                recommendationsState = "🧁 *Butler Recommendation*:\nOur Chef suggests a fresh, buttery croissant paired with a warm Caramel Latte, followed by a luscious slice of Red Velvet Cake for the perfect sweet finish!"
                                isRecommending = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Curate Match", color = DarkBackground, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(DarkBackground, RoundedCornerShape(8.dp))
                                .padding(12.dp)
                        ) {
                            Column {
                                Text(
                                    text = recommendationsState!!,
                                    color = TextPrimary,
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Reset Suggestions",
                                    fontSize = 12.sp,
                                    color = GoldAccent,
                                    modifier = Modifier
                                        .align(Alignment.End)
                                        .clickable { recommendationsState = null },
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        // Products header
        item {
            Text(
                text = "Premium Menu",
                style = MaterialTheme.typography.titleLarge,
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        // Product grid list
        if (filteredProducts.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No treats found matching description.", color = TextSecondary)
                }
            }
        } else {
            // Display products in custom stylized list
            items(filteredProducts) { item ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToDetail(item.id) },
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, BoardBorder)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Custom Drawn Vector product illustration
                        Box(
                            modifier = Modifier
                                .size(88.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(DarkSurfaceVariant)
                                .padding(4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            ProductVisual(category = item.category)
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = item.name,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (item.tag != null) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Box(
                                        modifier = Modifier
                                            .background(GoldAccent.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = item.tag,
                                            fontSize = 9.sp,
                                            color = GoldAccent,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = item.description,
                                color = TextSecondary,
                                fontSize = 12.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                lineHeight = 16.sp
                            )

                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "₹${item.price.toInt()}",
                                    color = GoldAccent,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.Star,
                                        contentDescription = null,
                                        tint = GoldAccent,
                                        modifier = Modifier.size(13.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = item.rating.toString(),
                                        color = TextPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        // Fast Add to Cart Button
                        IconButton(
                            onClick = { onAddToCart(item) },
                            modifier = Modifier
                                .size(36.dp)
                                .background(GoldAccent, RoundedCornerShape(8.dp))
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = DarkBackground)
                        }
                    }
                }
            }
        }

        // Bottom space padding
        item { Spacer(modifier = Modifier.height(32.dp)) }
    }
}
