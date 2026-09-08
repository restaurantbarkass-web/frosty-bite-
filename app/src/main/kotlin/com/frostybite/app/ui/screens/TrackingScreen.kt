package com.frostybite.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import com.frostybite.app.data.OrderItem
import com.frostybite.app.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun TrackingScreen(
    orderId: String,
    orders: List<OrderItem>,
    onUpdateStatus: (String, String) -> Unit, // passes orderId, newStatus
    onBack: () -> Unit
) {
    val order = orders.find { it.id == orderId }

    if (order == null) {
        Box(modifier = Modifier.fillMaxSize().background(DarkBackground), contentAlignment = Alignment.Center) {
            Text("Order not found.", color = TextPrimary)
        }
        return
    }

    // Coroutine simulator to transition order status
    LaunchedEffect(key1 = order.status) {
        if (order.status == "Preparing") {
            delay(12000) // 12 seconds in preparation stage
            onUpdateStatus(orderId, "Out for Delivery")
        } else if (order.status == "Out for Delivery") {
            delay(15000) // 15 seconds in delivery transit
            onUpdateStatus(orderId, "Delivered")
        }
    }

    val currentStep = when (order.status) {
        "Preparing" -> 1
        "Out for Delivery" -> 2
        "Delivered" -> 3
        else -> 1
    }

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
                "← Menu",
                color = GoldAccent,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clickable { onBack() }
                    .padding(8.dp)
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                "Track My Treats",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.width(48.dp))
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Order Summary Info Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, BoardBorder)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("ORDER IDENTIFIER", color = TextSecondary, fontSize = 11.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                    Text(orderId, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text("TOTAL COST", color = TextSecondary, fontSize = 11.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                    Text("₹${order.totalAmount.toInt()}", color = GoldAccent, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Vertical Stepper Timeline
        Text("Delivery Timeline Tracker", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Spacer(modifier = Modifier.height(16.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Step 1: Order Received / Placed
            StepTimelineRow(
                stepNumber = 1,
                isActive = currentStep >= 1,
                title = "Order Initiated & Confirmed",
                description = "Our cashiers logged and accepted your request into the kitchen queue.",
                tagSymbol = "✓"
            )

            // Step 2: Preparing in Kitchen
            StepTimelineRow(
                stepNumber = 2,
                isActive = currentStep >= 2,
                title = "Baking Fresh in Kitchen",
                description = "Our Chefs are melting Belgian cocoa, layering sponges and wrapping croissants fresh.",
                tagSymbol = "🧁"
            )

            // Step 3: Out for Delivery
            StepTimelineRow(
                stepNumber = 3,
                isActive = currentStep >= 3,
                title = "Treats Out for Delivery",
                description = "Our Delivery Valet has picked up your frosty sweets and is zooming to your address.",
                tagSymbol = "🛵"
            )

            // Step 4: Arrived / Delivered
            StepTimelineRow(
                stepNumber = 4,
                isActive = currentStep >= 3, // Shows done if status is Delivered
                title = "Delivered & Satisfied",
                description = "Your fresh treats arrived! Crack open the box and sink your teeth inside.",
                tagSymbol = "🎉"
            )
        }

        // Live delivery boy visual footer box
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = when (order.status) {
                        "Preparing" -> "👨‍🍳"
                        "Out for Delivery" -> "🛵"
                        else -> "🎁"
                    },
                    fontSize = 32.sp
                )
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        text = when (order.status) {
                            "Preparing" -> "Chef is icing your treats..."
                            "Out for Delivery" -> "Simulated valet is 1.2km away..."
                            else -> "Enjoy your sweet frosted moments!"
                        },
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "Real-time companion state listener.",
                        color = TextSecondary,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}

@Composable
fun StepTimelineRow(
    stepNumber: Int,
    isActive: Boolean,
    title: String,
    description: String,
    tagSymbol: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            // Circle node
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(
                        if (isActive) GoldAccent else DarkSurface,
                        CircleShape
                    )
                    .border(
                        BorderStroke(
                            2.dp,
                            if (isActive) GoldAccent else BoardBorder
                        ),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = tagSymbol,
                    color = if (isActive) DarkBackground else TextSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.width(16.dp))

        Column {
            Text(
                text = title,
                color = if (isActive) Color.White else TextTertiary,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = description,
                color = if (isActive) TextSecondary else TextTertiary,
                fontSize = 12.sp,
                lineHeight = 16.sp
            )
        }
    }
}
