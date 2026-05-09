interface Place {
  name: string;
  type: string;
  vicinity?: string;
}

export interface NeighborhoodData {
  nearbyPlaces: Place[];
}

export async function getNeighborhoodData(city: string): Promise<NeighborhoodData> {
  if (!process.env.GOOGLE_PLACES_API_KEY || !city) {
    return { nearbyPlaces: [] };
  }

  try {
    // Search for restaurants, parks, grocery stores near city center
    const types = ["restaurant", "park", "grocery_or_supermarket"];
    const allPlaces: Place[] = [];

    for (const type of types.slice(0, 2)) {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(type + " in " + city)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json() as { results: { name: string; types: string[]; vicinity?: string }[] };
      const places = (data.results || []).slice(0, 3).map((p) => ({
        name: p.name,
        type: p.types?.[0]?.replace(/_/g, " ") || type,
        vicinity: p.vicinity,
      }));
      allPlaces.push(...places);
    }

    return { nearbyPlaces: allPlaces.slice(0, 6) };
  } catch {
    return { nearbyPlaces: [] };
  }
}
