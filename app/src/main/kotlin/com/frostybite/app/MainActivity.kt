package com.frostybite.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.frostybite.app.data.CartItem
import com.frostybite.app.data.OrderItem
import com.frostybite.app.data.Product
import com.frostybite.app.ui.screens.*
import com.frostybite.app.ui.theme.FrostyBiteTheme
import java.text.SimpleDateFormat
import java.util.*

sealed class Screen {
    object Home : Screen()
    data class Detail(val productId: String) : Screen()
    object Cart : Screen()
    object Profile : Screen()
    data class OrderTracking(val orderId: String) : Screen()
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            FrostyBiteTheme {
                MainNavigationView()
            }
        }
    }
}

@Composable
fun MainNavigationView() {
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Home) }
    
    // Global reactive states for the applet session
    val cartItems = remember { mutableStateListOf<CartItem>() }
    val orderHistory = remember { mutableStateListOf<OrderItem>() }

    // Navigation back stack mapping representing standard Android flow
    val backStack = remember { mutableStateListOf<Screen>(Screen.Home) }

    fun navigateTo(screen: Screen) {
        if (backStack.lastOrNull() != screen) {
            backStack.add(screen)
        }
        currentScreen = screen
    }

    fun handleBack() {
        if (backStack.size > 1) {
            backStack.removeAt(backStack.size - 1)
            currentScreen = backStack.last()
        } else {
            currentScreen = Screen.Home
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val screen = currentScreen) {
            is Screen.Home -> {
                HomeScreen(
                    onNavigateToDetail = { productId -> navigateTo(Screen.Detail(productId)) },
                    onAddToCart = { product -> 
                        val existingIndex = cartItems.indexOfFirst { it.product.id == product.id && it.customNotes.isEmpty() }
                        if (existingIndex != -1) {
                            val oldItem = cartItems[existingIndex]
                            cartItems[existingIndex] = oldItem.copy(quantity = oldItem.quantity + 1)
                        } else {
                            cartItems.add(CartItem(product, 1, ""))
                        }
                    },
                    onNavigateToCart = { navigateTo(Screen.Cart) },
                    onNavigateToProfile = { navigateTo(Screen.Profile) }
                )
            }
            is Screen.Detail -> {
                DetailScreen(
                    productId = screen.productId,
                    onBack = { handleBack() },
                    onAddToCart = { product, notes ->
                        val existingIndex = cartItems.indexOfFirst { it.product.id == product.id && it.customNotes == notes }
                        if (existingIndex != -1) {
                            val oldItem = cartItems[existingIndex]
                            cartItems[existingIndex] = oldItem.copy(quantity = oldItem.quantity + 1)
                        } else {
                            cartItems.add(CartItem(product, 1, notes))
                        }
                    }
                )
            }
            is Screen.Cart -> {
                CartScreen(
                    cartItems = cartItems,
                    onRemoveItem = { index -> cartItems.removeAt(index) },
                    onCheckout = { orderId ->
                        // Gather subtotal
                        val total = cartItems.sumOf { it.product.price * it.quantity } + 60.0
                        val formatter = SimpleDateFormat("MMM dd, yyyy - hh:mm a", Locale.getDefault())
                        val dateStr = formatter.format(Date())

                        // Log order history
                        val newOrder = OrderItem(
                            id = orderId,
                            items = cartItems.toList(),
                            totalAmount = total,
                            status = "Preparing",
                            timestamp = dateStr
                        )
                        orderHistory.add(0, newOrder)

                        // Clear cart
                        cartItems.clear()

                        // Route into active tracker
                        navigateTo(Screen.OrderTracking(orderId))
                    },
                    onBack = { handleBack() }
                )
            }
            is Screen.Profile -> {
                ProfileScreen(
                    orderHistory = orderHistory,
                    onBack = { handleBack() }
                )
            }
            is Screen.OrderTracking -> {
                TrackingScreen(
                    orderId = screen.orderId,
                    orders = orderHistory,
                    onUpdateStatus = { ordId, status ->
                        val index = orderHistory.indexOfFirst { it.id == ordId }
                        if (index != -1) {
                            val oldOrder = orderHistory[index]
                            orderHistory[index] = oldOrder.copy(status = status)
                        }
                    },
                    onBack = { handleBack() }
                )
            }
        }
    }
}
