package com.frostybite.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.frostybite.app.data.CartItem
import com.frostybite.app.ui.theme.*

@Composable
fun CartScreen(
    cartItems: List<CartItem>,
    onRemoveItem: (Int) -> Unit,
    onCheckout: (String) -> Unit, // passes final upi status or orderId
    onBack: () -> Unit
) {
    val subtotal = cartItems.sumOf { it.product.price * it.quantity }
    val taxAndDelivery = if (subtotal > 0) 60.0 else 0.0
    val totalAmount = subtotal + taxAndDelivery

    var couponCode by remember { mutableStateOf("") }
    var discountAmount by remember { mutableDoubleStateOf(0.0) }
    var couponAppliedMessage by remember { mutableStateOf("") }

    val finalTotal = (totalAmount - discountAmount).coerceAtLeast(0.0)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Spacer(modifier = Modifier.height(24.dp))

        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "← Menu",
                color = GoldAccent,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clickable { onBack() }
                    .padding(8.dp)
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                "My Baker's Cart",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.width(48.dp))
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (cartItems.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🥐", fontSize = 48.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Your cart is empty!",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "Go back to the menu and select your treats.",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                itemsIndexed(cartItems) { index, item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = DarkSurface),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, BoardBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Small colored visual slot
                            Box(
                                modifier = Modifier
                                    .size(60.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(DarkSurfaceVariant),
                                contentAlignment = Alignment.Center
                            ) {
                                ProductVisual(category = item.product.category, modifier = Modifier.size(36.dp))
                            }

                            Spacer(modifier = Modifier.width(16.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    item.product.name,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp
                                )
                                if (item.customNotes.isNotEmpty()) {
                                    Text(
                                        "Note: \"${item.customNotes}\"",
                                        color = GoldAccent,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                                Text(
                                    "₹${item.product.price.toInt()} × ${item.quantity}",
                                    color = TextSecondary,
                                    fontSize = 13.sp
                                )
                            }

                            IconButton(
                                onClick = { onRemoveItem(index) },
                                modifier = Modifier
                                    .background(Color.Red.copy(alpha = 0.15f), CircleShape)
                                    .size(32.dp)
                            ) {
                                Text("❌", fontSize = 11.sp)
                            }
                        }
                    }
                }

                // Coupon application codes
                item {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Apply Promotional Codes", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = couponCode,
                            onValueChange = { couponCode = it },
                            modifier = Modifier
                                .weight(1f)
                                .height(56.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            placeholder = { Text("E.g. FROSTY20", color = TextSecondary, fontSize = 13.sp) },
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

                        Button(
                            onClick = {
                                if (couponCode.trim().equals("FROSTY20", ignoreCase = true)) {
                                    discountAmount = subtotal * 0.2
                                    couponAppliedMessage = "Success! Promo applied (20% Off)"
                                } else if (couponCode.trim().equals("FREE60", ignoreCase = true)) {
                                    discountAmount = 60.0
                                    couponAppliedMessage = "Success! Free Delivery applied (₹60 Off)"
                                } else {
                                    couponAppliedMessage = "Invalid coupon code."
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldAccent),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(48.dp)
                        ) {
                            Text("Apply", color = DarkBackground, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (couponAppliedMessage.isNotEmpty()) {
                        Text(
                            text = couponAppliedMessage,
                            color = if (couponAppliedMessage.startsWith("Success")) MintIceCream else Color.Red,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 4.dp, start = 4.dp)
                        )
                    }
                }

                // Totals box
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Items Subtotal", color = TextSecondary, fontSize = 13.sp)
                                Text("₹${subtotal.toInt()}", color = TextPrimary, fontSize = 13.sp)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Delivery & Packaging Taxes", color = TextSecondary, fontSize = 13.sp)
                                Text("₹${taxAndDelivery.toInt()}", color = TextPrimary, fontSize = 13.sp)
                            }
                            if (discountAmount > 0) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Discounts / Offers", color = MintIceCream, fontSize = 13.sp)
                                    Text("-₹${discountAmount.toInt()}", color = MintIceCream, fontSize = 13.sp)
                                }
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Divider(color = BoardBorder)
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Grand Total", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Text("₹${finalTotal.toInt()}", color = GoldAccent, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            }
                        }
                    }
                }
            }

            // Checkout row
            Button(
                onClick = {
                    val genOrderId = "ORDER-${(100000..999999).random()}"
                    onCheckout(genOrderId)
                },
                colors = ButtonDefaults.buttonColors(containerColor = GoldAccent),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .padding(top = 12.dp)
            ) {
                Text(
                    "Place Instant UPI Order",
                    color = DarkBackground,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }
    }
}
