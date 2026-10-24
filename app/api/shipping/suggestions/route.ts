import { NextRequest, NextResponse } from "next/server";
import { isGoongConfigured, goongPlaceAutocomplete } from "@/lib/services/goong.service";

// Danh sách các loại đối tượng không dùng để giao hàng (đường sắt, ray tàu ngầm, trạm xe bus...)
const EXCLUDED_OSM_TYPES = new Set([
  "subway",
  "railway",
  "rail",
  "tram",
  "track",
  "platform",
  "bus_stop",
  "stop_position",
  "city",
  "administrative",
  "country",
  "state",
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // 0. Ưu tiên hàng đầu: Sử dụng Goong Places Autocomplete (chuẩn từng ngõ ngách, tòa nhà VN)
    if (isGoongConfigured()) {
      const goongSuggestions = await goongPlaceAutocomplete(q, 6);
      if (goongSuggestions && goongSuggestions.length > 0) {
        return NextResponse.json({ suggestions: goongSuggestions, source: "goong" });
      }
    }

    // Lấy từ khóa chính (trước dấu phẩy) người dùng gõ
    const primaryTerm = q.split(",")[0].trim().toLowerCase();

    // 1. Thử gọi Nominatim từ Server (Có đầy đủ Server User-Agent, không bị CORS - Fallback)
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=vn&addressdetails=1&limit=8&q=${encodeURIComponent(
      q
    )}`;

    const res = await fetch(url, {
      headers: {
        "Accept-Language": "vi",
        "User-Agent": "LuxeCommerce-Ecommerce-Server/1.0 (contact@luxecommerce.vn)",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const seen = new Set<string>();
        const suggestions = data
          .map((item: any) => {
            const addr = item.address || {};
            const road = addr.road || addr.suburb || addr.quarter || "";
            const houseNumber = addr.house_number ? `${addr.house_number} ` : "";
            const district = addr.city_district || addr.district || addr.county || "";
            const city = addr.city || addr.state || addr.province || "";

            const fullStreet = [houseNumber + road, district].filter(Boolean).join(", ");
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);

            if (isNaN(lat) || isNaN(lng)) return null;

            // Bỏ qua hạ tầng giao thông công cộng không giao hàng tới được
            if (EXCLUDED_OSM_TYPES.has(item.type) || EXCLUDED_OSM_TYPES.has(item.class)) {
              return null;
            }

            const streetName = fullStreet || item.display_name.split(",")[0] || q;
            const key = `${streetName.toLowerCase()}_${city.toLowerCase()}`;
            if (seen.has(key)) return null;
            seen.add(key);

            return {
              displayName: item.display_name,
              street: streetName,
              city: city || "TP. Hồ Chí Minh",
              lat,
              lng,
            };
          })
          .filter(Boolean);

        if (suggestions.length > 0) {
          return NextResponse.json({ suggestions });
        }
      }
    }

    // 2. Fallback sang Photon API nếu Nominatim không trả về
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      q
    )}&bbox=102.14,8.18,109.46,23.39&limit=8`;
    const photonRes = await fetch(photonUrl);

    if (photonRes.ok) {
      const photonData = await photonRes.json();
      if (Array.isArray(photonData?.features)) {
        const seen = new Set<string>();
        const suggestions = photonData.features
          .map((f: any) => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates || [];
            const lng = parseFloat(coords[0]);
            const lat = parseFloat(coords[1]);

            if (isNaN(lat) || isNaN(lng)) return null;

            // Bỏ qua đường ray, ga ngầm, tàu hỏa...
            if (
              EXCLUDED_OSM_TYPES.has(props.osm_value) ||
              EXCLUDED_OSM_TYPES.has(props.osm_key) ||
              EXCLUDED_OSM_TYPES.has(props.type)
            ) {
              return null;
            }

            const name = props.name || props.street || "";
            const district = props.district || props.county || "";
            const street = [name, district].filter(Boolean).join(", ");
            const city = props.city || props.state || "TP. Hồ Chí Minh";

            // KIỂM TRA ĐỘ KHỚP: Nếu Photon bỏ rơi từ khóa chính của khách để match linh tinh sang thành phố thì loại bỏ
            const fullText = `${name} ${street} ${district}`.toLowerCase();
            if (primaryTerm.length >= 2 && !fullText.includes(primaryTerm)) {
              return null;
            }

            const key = `${street.toLowerCase()}_${city.toLowerCase()}`;
            if (seen.has(key)) return null;
            seen.add(key);

            return {
              displayName: [street, city, "Việt Nam"].filter(Boolean).join(", "),
              street: street || q,
              city: city,
              lat,
              lng,
            };
          })
          .filter(Boolean);

        return NextResponse.json({ suggestions });
      }
    }

    return NextResponse.json({ suggestions: [] });
  } catch (err) {
    console.error("Lỗi khi tìm kiếm gợi ý địa chỉ trên Server:", err);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
