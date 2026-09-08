package com.frostybite.app.data

data class Product(
    val id: String,
    val name: String,
    val description: String,
    val price: Double,
    val rating: Double,
    val imageUrl: String,
    val category: String,
    val isPremium: Boolean = false,
    val tag: String? = null
)

data class CartItem(
    val product: Product,
    val quantity: Int,
    val customNotes: String = ""
)

data class OrderItem(
    val id: String,
    val items: List<CartItem>,
    val totalAmount: Double,
    val status: String, // "Preparing", "Out for Delivery", "Delivered"
    val timestamp: String,
    val upiTxName: String? = null
)

object MockData {
    val categories = listOf("All", "Cakes", "Pastries", "Breads", "Cookies", "Beverages")

    val products = listOf(
        Product(
            id = "1",
            name = "Red Velvet Cake",
            description = "Silky smooth crimson sponge layered with rich cream cheese frosting.",
            price = 1200.0,
            rating = 4.9,
            imageUrl = "https://images.unsplash.com/photo-1586788680434-30d3246718d0?auto=format&fit=crop&q=80&w=600",
            category = "Cakes",
            isPremium = true,
            tag = "Bestseller"
        ),
        Product(
            id = "2",
            name = "Butter Croissant",
            description = "Flaky, golden-brown layers of pure buttery goodness, baked fresh daily.",
            price = 180.0,
            rating = 4.8,
            imageUrl = "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=600",
            category = "Pastries",
            tag = "Freshly Baked"
        ),
        Product(
            id = "3",
            name = "Sourdough Loaf",
            description = "Naturally leavened with a 50-year-old starter for a perfect crust and tangy crumb.",
            price = 250.0,
            rating = 4.7,
            imageUrl = "https://images.unsplash.com/photo-1585478282226-1d713204d95c?auto=format&fit=crop&q=80&w=600",
            category = "Breads"
        ),
        Product(
            id = "4",
            name = "Choco Chip Cookie",
            description = "Soft-baked with oversized chunks of premium Belgian dark chocolate.",
            price = 90.0,
            rating = 4.9,
            imageUrl = "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=600",
            category = "Cookies",
            tag = "Popular"
        ),
        Product(
            id = "5",
            name = "Caramel Latte",
            description = "Full-bodied espresso paired with frothy milk and decadent salted caramel drizzle.",
            price = 220.0,
            rating = 4.6,
            imageUrl = "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600",
            category = "Beverages"
        ),
        Product(
            id = "6",
            name = "Blueberry Danish",
            description = "Flaky puff pastry centered with rich vanilla custard and wild sweet blueberries.",
            price = 190.0,
            rating = 4.8,
            imageUrl = "https://images.unsplash.com/photo-1608686207856-001b95cf60ca?auto=format&fit=crop&q=80&w=600",
            category = "Pastries",
            tag = "Seasonal"
        ),
        Product(
            id = "7",
            name = "Belgian Chocolate Gateau",
            description = "Extravagant layers of dark chocolate ganache and chocolate cake sponge.",
            price = 1400.0,
            rating = 5.0,
            imageUrl = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600",
            category = "Cakes",
            isPremium = true,
            tag = "Signature"
        )
    )
}
