import { NextRequest, NextResponse } from "next/server";
import { isGoongConfigured, goongReverseGeocode } from "@/lib/services/goong.service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: "MISSING_COORDINATES" }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < 8.0 || lat > 24.5 || lng < 102.0 || lng > 110.5) {
    return NextResponse.json({ error: "INVALID_COORDINATES" }, { status: 400 });
  }

  try {
    // 0. Ưu tiên hàng đầu: Sử dụng Goong Reverse Geocoding (chuẩn địa chỉ & sáp nhập VN)
    if (isGoongConfigured()) {
      const goongResult = await goongReverseGeocode(lat, lng);
      if (goongResult) {
        return NextResponse.json({
          street: goongResult.street,
          city: goongResult.city,
          formattedAddress: goongResult.formattedAddress,
          source: "goong",
        });
      }
    }

    // 1. Nominatim Reverse Geocoding (chính xác cao tại Việt Nam - Fallback)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "vi",
        "User-Agent": "LuxeCommerce-Ecommerce-Server/1.0 (contact@luxecommerce.vn)",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const houseNumber = addr.house_number ? `${addr.house_number} ` : "";
        const road = addr.road || addr.suburb || addr.quarter || "";
        const district = addr.city_district || addr.district || addr.county || "";
        const city = addr.city || addr.state || addr.province || "TP. Hồ Chí Minh";

        const street = [houseNumber + road, district].filter(Boolean).join(", ");
        return NextResponse.json({
          street: street || data.display_name.split(",")[0] || "",
          city: city,
          formattedAddress: data.display_name,
        });
      }
    }

    // 2. Photon Reverse Geocoding Fallback
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const photonRes = await fetch(photonUrl);
    if (photonRes.ok) {
      const photonData = await photonRes.json();
      const firstFeature = photonData?.features?.[0];
      if (firstFeature?.properties) {
        const props = firstFeature.properties;
        const name = props.name || props.street || "";
        const district = props.district || props.county || "";
        const street = [name, district].filter(Boolean).join(", ");
        const city = props.city || props.state || "TP. Hồ Chí Minh";

        return NextResponse.json({
          street: street || "Vị trí đã chọn",
          city: city,
          formattedAddress: [street, city, "Việt Nam"].filter(Boolean).join(", "),
        });
      }
    }

    return NextResponse.json({
      street: `Tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      city: "Việt Nam",
      formattedAddress: `Tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    });
  } catch (error) {
    console.error("Lỗi khi reverse geocode trên Server:", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
