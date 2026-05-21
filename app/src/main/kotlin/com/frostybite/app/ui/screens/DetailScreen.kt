package com.frostybite.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.frostybite.app.data.MockData
import com.frostybite.app.data.Product
import com.frostybite.app.ui.theme.*

@Composable
fun DetailScreen(
    productId: String,
    onBack: () -> Unit,
    onAddToCart: (Product, String) -> Unit
) {
    val product = MockData.products.find { it.id == productId }

    if (product == null) {
        Box(modifier = Modifier.fillMaxSize().background(DarkBackground), contentAlignment = Alignment.Center) {
            Text("Product not found.", color = TextPrimary)
        }
        return
    }

    var quantity by remember { mutableIntStateOf(1) }
    var selectedSize by remember { mutableStateOf("Regular") }
    var customMessage by remember { mutableStateOf("") }

    val sizes = if (product.category == "Cakes") {
        listOf("Regular (500g)", "Large (1kg)", "Colossal (2kg)")
    } else if (product.category == "Beverages") {
        listOf("Regular", "Grande", "Venti")
    } else {
        listOf("Regular", "Baker's Dozen (13pcs)")
    }

    val priceMultiplier = when (selectedSize) {
        "Large (1kg)" -> 1.8
        "Colossal (2kg)" -> 3.2
        "Baker's Dozen (13pcs)" -> 10.0
        "Grande" -> 1.3
        "Venti" -> 1.6
        else -> 1.0
    }
    val finalUnitPrice = product.price * priceMultiplier
    val finalTotalPrice = finalUnitPrice * quantity

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Spacer(modifier = Modifier.height(24.dp))

        // Navigation header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "← Back",
                color = GoldAccent,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clickable { onBack() }
                    .padding(8.dp)
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "Treat Details",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.width(48.dp)) // balance
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Dynamic Product illustration box
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(DarkSurface),
            contentAlignment = Alignment.Center
        ) {
            ProductVisual(
                category = product.category,
                modifier = Modifier.size(140.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Product Details Info
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = product.name,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Star,
                    contentDescription = null,
                    tint = GoldAccent,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = product.rating.toString(),
                    color = TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Text(
            text = product.category,
            fontSize = 13.sp,
            color = GoldAccent,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 2.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = product.description,
            color = TextSecondary,
            fontSize = 14.sp,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Size customization select
        Text(
            text = "Choose Portion / Size",
            fontSize = 14.sp,
            color = TextPrimary,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            sizes.forEach { size ->
                val isSelected = size == selectedSize
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isSelected) GoldAccent.copy(alpha = 0.15f) else DarkSurface)
                        .clickable { selectedSize = size }
                        .border(
                            BorderStroke(
                                1.dp,
                                if (isSelected) GoldAccent else BoardBorder
                            ),
                            RoundedCornerShape(8.dp)
                        )
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = size,
                        color = if (isSelected) GoldAccent else TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Customized message
        Text(
            text = "Custom Instructions (e.g. 'Happy Birthday Neo' for Cakes)",
            fontSize = 14.sp,
            color = TextPrimary,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = customMessage,
            onValueChange = { customMessage = it },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .clip(RoundedCornerShape(8.dp)),
            placeholder = { Text("Add writing details or custom requests...", color = TextSecondary) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = GoldAccent,
                unfocusedBorderColor = BoardBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedContainerColor = DarkSurface,
                unfocusedContainerColor = DarkSurface
            ),
            shape = RoundedCornerShape(8.dp),
            singleLine = true
        )

        Spacer(modifier = Modifier.weight(1f))

        // Quantity selector & Purchase action rows
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Total Price", color = TextSecondary, fontSize = 12.sp)
                Text(
                    "₹${finalTotalPrice.toInt()}",
                    color = GoldAccent,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Quantity increment control
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier
                    .background(DarkSurface, RoundedCornerShape(24.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "-",
                    color = GoldAccent,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clickable { if (quantity > 1) quantity-- }
                        .padding(horizontal = 8.dp)
                )
                Text(
                    text = "$quantity",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "+",
                    color = GoldAccent,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clickable { quantity++ }
                        .padding(horizontal = 8.dp)
                )
            }
        }

        Button(
            onClick = {
                // Add exact multi-quantities with note
                for (i in 1..quantity) {
                    onAddToCart(product.copy(price = finalUnitPrice), customMessage)
                }
                onBack()
            },
            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
        ) {
            Text(
                "Add to Cart",
                color = DarkBackground,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }
    }
}
