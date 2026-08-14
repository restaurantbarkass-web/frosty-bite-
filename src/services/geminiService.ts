
export const getFoodRecommendations = async (userPreferences: string) => {
  const fallback = ['Bento Cakes', 'Artisan Bread', 'Chocolate Truffle', 'Custom Pastries'];
  try {
    const response = await fetch('/api/butler/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerm: userPreferences || 'popular products', items: [] })
    });
    
    if (!response.ok) {
      console.warn('AI Recommendation API returned non-OK status, utilizing client fallback');
      return fallback;
    }
    const data = await response.json();
    return (data.suggestions && data.suggestions.length > 0) ? data.suggestions : fallback;
  } catch (error) {
    console.warn("Failed to fetch food recommendations, using fallback:", error);
    return fallback;
  }
};

export const getRestaurantInfo = async (location: { lat: number; lng: number }) => {
  // This originally used Google Maps grounding which is not directly exposed yet in our custom API.
  // We'll return a helpful static response or implement a simplified version.
  return {
    text: "Frosty Bite is located in the heart of the city, specializing in artisan breads and custom celebration cakes. We deliver across the region.",
    grounding: []
  };
};

export const getComplexMealPlan = async (dietaryGoals: string) => {
  try {
    const response = await fetch('/api/butler/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `Create a meal plan for: ${dietaryGoals}`, items: [] })
    });
    if (!response.ok) throw new Error('Meal plan API failed');
    const data = await response.json();
    return data.butlerResponse || "I can help you craft the perfect selection of treats for your week. Please contact our concierge for a detailed plan.";
  } catch (error) {
    console.error("Failed to get meal plan:", error);
    return "Meal plan generation is currently unavailable. Please try again later.";
  }
};
