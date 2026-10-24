/**
 * Goong Maps Service - Bản đồ và Định vị chuyên dụng cho Việt Nam
 * Tài liệu API: https://docs.goong.io/
 * Đăng ký tài khoản miễn phí tại: https://account.goong.io/
 */

export interface GoongLocation {
  lat: number;
  lng: number;
}

export interface GoongGeocodeResult {
  coords: GoongLocation;
  displayName: string;
  street: string;
  city: string;
  isStreetLevel: boolean;
}

export interface GoongAddressSuggestion {
  displayName: string;
  street: string;
  city: string;
  lat: number;
  lng: number;
}

/**
 * Kiểm tra xem GOONG_API_KEY đã được thiết lập trong biến môi trường hay chưa
 */
export function isGoongConfigured(): boolean {
  return Boolean(process.env.GOONG_API_KEY && process.env.GOONG_API_KEY.trim() !== "");
}

/**
 * Lấy Map Key dùng cho Leaflet Tile Layer trên Frontend
 */
export function getGoongMapKey(): string {
  return process.env.NEXT_PUBLIC_GOONG_MAP_KEY || "";
}

/**
 * Geocoding địa chỉ qua Goong Maps API
 * Hỗ trợ nhận diện số nhà, ngõ ngách, tên đường và các đơn vị hành chính sau sáp nhập tại Việt Nam
 */
export async function goongGeocode(
  queryAddress: string,
  targetCity?: string
): Promise<GoongGeocodeResult | null> {
  const apiKey = process.env.GOONG_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const url = `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(
      queryAddress
    )}&api_key=${apiKey}`;

    const res = await fetch(url, {
      next: { revalidate: 3600 }, // Cache 1 giờ để tiết kiệm quota
    });

    if (!res.ok) {
      console.warn(`Goong Geocode HTTP Error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    const firstResult = data.results[0];
    const loc = firstResult.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      return null;
    }

    // Phân tích các thành phần địa chỉ trả về từ Goong
    const components = firstResult.address_components || [];
    let streetName = "";
    let districtName = "";
    let cityName = "";
    let isStreetLevel = false;

    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes("route") || types.includes("street_address")) {
        streetName = comp.long_name || "";
        isStreetLevel = true;
      } else if (types.includes("sublocality_level_1") || types.includes("administrative_area_level_2")) {
        districtName = comp.long_name || "";
      } else if (types.includes("administrative_area_level_1")) {
        cityName = comp.long_name || "";
      }
    }

    // Nếu người dùng nhập tên đường cụ thể nhưng Goong chỉ trả về cấp Tỉnh/Thành hoặc Quận/Huyện chung chung
    // nghĩa là tên đường đó không có thật ở địa phương này!
    const queryHasSpecificStreet = queryAddress.includes(",") 
      ? queryAddress.split(",")[0].trim().length > 3
      : queryAddress.trim().length > 3;

    if (queryHasSpecificStreet && !isStreetLevel) {
      // Kiểm tra xem tên đường có nằm trong formatted_address hay không
      const firstChunk = queryAddress.split(",")[0].trim().toLowerCase();
      const formattedLower = (firstResult.formatted_address || "").toLowerCase();
      if (!formattedLower.includes(firstChunk)) {
        return null; // Tên đường giả mạo, chỉ trả về tâm thành phố -> từ chối!
      }
    }

    return {
      coords: { lat: loc.lat, lng: loc.lng },
      displayName: firstResult.formatted_address || queryAddress,
      street: streetName || districtName || queryAddress.split(",")[0].trim(),
      city: cityName || targetCity || "Việt Nam",
      isStreetLevel,
    };
  } catch (error) {
    console.error("Lỗi khi gọi Goong Geocode API:", error);
    return null;
  }
}

/**
 * Reverse Geocoding: Đổi tọa độ (lat, lng) thành tên đường & địa chỉ Việt Nam qua Goong
 */
export async function goongReverseGeocode(
  lat: number,
  lng: number
): Promise<{ street: string; city: string; formattedAddress: string } | null> {
  const apiKey = process.env.GOONG_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const url = `https://rsapi.goong.io/Geocode?latlng=${lat},${lng}&api_key=${apiKey}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    const first = data.results[0];
    const components = first.address_components || [];
    let street = "";
    let district = "";
    let city = "";

    for (const comp of components) {
      const types: string[] = comp.types || [];
      if (types.includes("route")) {
        street = comp.long_name || "";
      } else if (types.includes("administrative_area_level_2") || types.includes("sublocality_level_1")) {
        district = comp.long_name || "";
      } else if (types.includes("administrative_area_level_1")) {
        city = comp.long_name || "";
      }
    }

    const combinedStreet = [street, district].filter(Boolean).join(", ");

    return {
      street: combinedStreet || first.formatted_address.split(",")[0] || "Vị trí đã chọn",
      city: city || "Việt Nam",
      formattedAddress: first.formatted_address || "Vị trí đã chọn",
    };
  } catch (error) {
    console.error("Lỗi khi gọi Goong Reverse Geocode API:", error);
    return null;
  }
}

/**
 * Lấy tọa độ chi tiết của một địa điểm từ place_id của Goong
 */
export async function goongPlaceDetail(
  placeId: string
): Promise<GoongLocation | null> {
  const apiKey = process.env.GOONG_API_KEY?.trim();
  if (!apiKey || !placeId) return null;

  try {
    const url = `https://rsapi.goong.io/Place/Detail?place_id=${encodeURIComponent(
      placeId
    )}&api_key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== "OK" || !data.result?.geometry?.location) return null;

    return {
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
    };
  } catch (error) {
    console.error("Lỗi khi lấy Goong Place Detail:", error);
    return null;
  }
}

/**
 * Gợi ý địa chỉ tự động (Autocomplete) qua Goong Places
 */
export async function goongPlaceAutocomplete(
  query: string,
  limit: number = 6
): Promise<GoongAddressSuggestion[]> {
  const apiKey = process.env.GOONG_API_KEY?.trim();
  if (!apiKey || !query || query.trim().length < 2) return [];

  try {
    const url = `https://rsapi.goong.io/Place/AutoComplete?api_key=${apiKey}&input=${encodeURIComponent(
      query.trim()
    )}&limit=${limit}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (data.status !== "OK" || !Array.isArray(data.predictions)) return [];

    const predictions = data.predictions.slice(0, limit);

    // Lấy tọa độ song song cho các gợi ý hàng đầu
    const detailedSuggestions = await Promise.all(
      predictions.map(async (item: any) => {
        let coords: GoongLocation | null = null;
        if (item.place_id) {
          coords = await goongPlaceDetail(item.place_id);
        }

        const mainText = item.structured_formatting?.main_text || item.description.split(",")[0];
        const secondaryText = item.structured_formatting?.secondary_text || "";

        return {
          displayName: item.description,
          street: mainText,
          city: secondaryText.split(",").pop()?.trim() || "Việt Nam",
          lat: coords?.lat ?? 10.7769,
          lng: coords?.lng ?? 106.7009,
        };
      })
    );

    return detailedSuggestions;
  } catch (error) {
    console.error("Lỗi khi gợi ý địa chỉ qua Goong:", error);
    return [];
  }
}
