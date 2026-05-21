package com.frostybite.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.frostybite.app.data.OrderItem
import com.frostybite.app.ui.theme.*

@Composable
fun ProfileScreen(
    orderHistory: List<OrderItem>,
    onBack: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Spacer(modifier = Modifier.height(24.dp)) }

        // Header
        item {
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
                    "My Foodie Profile",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                Spacer(modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.width(48.dp))
            }
        }

        // Profile Avatar Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, BoardBorder)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Big decorative emoji placeholder avatar inside stylized circle
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .background(GoldAccent.copy(alpha = 0.15f), CircleShape)
                            .border(BorderStroke(2.dp, GoldAccent), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("🧑‍🍳", fontSize = 48.sp)
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Gourmet Connoisseur",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "customer@frostybite.com",
                        fontSize = 13.sp,
                        color = TextSecondary
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Tier Status badge
                    Box(
                        modifier = Modifier
                            .background(GoldAccent, RoundedCornerShape(20.dp))
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "👑 Certified Frosty Master",
                            color = DarkBackground,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }

        // Gamer-Style Foodie Points progress section
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, BoardBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Foodie Score Levels", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Level 4", color = GoldAccent, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    // Simulated Progress Bar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(12.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(DarkSurfaceVariant)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(0.74f) // 74% completed
                                .fillMaxHeight()
                                .background(GoldAccent, RoundedCornerShape(6.dp))
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("740 / 1000 XP to Level 5", color = TextSecondary, fontSize = 11.sp)
                        Text("+20 XP awarded per order", color = MintIceCream, fontSize = 11.sp)
                    }
                }
            }
        }

        // Order history list
        item {
            Text(
                text = "Order History Log",
                fontSize = 16.sp,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        if (orderHistory.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No past orders logged yet.", color = TextSecondary, fontSize = 13.sp)
                }
            }
        } else {
            items(orderHistory) { order ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, BoardBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = order.id,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = order.timestamp,
                                    color = TextSecondary,
                                    fontSize = 11.sp
                                )
                            }

                            // Order Status chip
                            Box(
                                modifier = Modifier
                                    .background(
                                        when (order.status) {
                                            "Preparing" -> DustyLavender.copy(alpha = 0.15f)
                                            "Out for Delivery" -> BerryPink.copy(alpha = 0.15f)
                                            else -> MintIceCream.copy(alpha = 0.15f)
                                        },
                                        RoundedCornerShape(8.dp)
                                    )
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = order.status,
                                    color = when (order.status) {
                                        "Preparing" -> DustyLavender
                                        "Out for Delivery" -> BerryPink
                                        else -> MintIceCream
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        Divider(color = BoardBorder)
                        Spacer(modifier = Modifier.height(12.dp))

                        // Items list subline
                        order.items.forEach { cartItem ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "${cartItem.product.name} × ${cartItem.quantity}",
                                    color = TextSecondary,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "₹${(cartItem.product.price * cartItem.quantity).toInt()}",
                                    color = TextSecondary,
                                    fontSize = 13.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Total Paid Amount", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text("₹${order.totalAmount.toInt()}", color = GoldAccent, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                    }
                }
            }
        }

        item { Spacer(modifier = Modifier.height(32.dp)) }
    }
}
