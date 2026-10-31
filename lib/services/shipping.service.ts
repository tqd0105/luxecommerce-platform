/**
 * Service tính toán khoảng cách và chi phí vận chuyển thông minh
 * Dựa trên tọa độ GPS Kho hàng và Địa chỉ nhận hàng của khách.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ShippingCalculationResult {
  distanceKm: number;
  shippingFee: number;
  originalFee: number;
  isFreeShipping: boolean;
  freeShippingThreshold: number;
  estimatedDeliveryText: string;
  warehouseLocation: {
    lat: number;
    lng: number;
    name: string;
    address: string;
  };
}

// Tọa độ kho hàng trung tâm LuxeCommerce (Mặc định: Trung tâm Quận 1, TP. Hồ Chí Minh)
export const WAREHOUSE_LOCATION = {
  lat: 10.7769,
  lng: 106.7009,
  name: "Kho Tổng LuxeCommerce ",
  address: "Quận 1, TP. Hồ Chí Minh",
};

// Hạn mức đơn hàng được miễn phí vận chuyển (Freeship)
export const FREE_SHIPPING_THRESHOLD = 500000; // 500.000 VNĐ

// Phí ship mặc định khi chưa xác định được vị trí GPS
export const DEFAULT_SHIPPING_FEE = 25000; // 25.000 VNĐ

/**
 * Công thức Haversine tính khoảng cách đường bộ tương đối giữa 2 cặp tọa độ (km)
 */
export function calculateDistanceKm(
  point1: Coordinates,
  point2: Coordinates = WAREHOUSE_LOCATION
): number {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistance = R * c;

  // Nhân hệ số 1.35 mô phỏng đường sá quanh co thực tế tại đô thị Việt Nam
  const roadDistance = straightDistance * 1.35;
  return Math.round(roadDistance * 10) / 10;
}

/**
 * Tính chi phí vận chuyển dựa trên khoảng cách và giá trị đơn hàng
 * @param subtotal Giá trị đơn hàng trước phí vận chuyển
 * @param customerCoords Tọa độ khách hàng (tùy chọn)
 */
export function calculateShippingFee(
  subtotal: number,
  customerCoords?: Coordinates | null
): ShippingCalculationResult {
  // 1. Tính khoảng cách
  let distanceKm = 5; // Mặc định 5km nội thành nếu chưa có GPS
  if (customerCoords && customerCoords.lat && customerCoords.lng) {
    distanceKm = calculateDistanceKm(customerCoords, WAREHOUSE_LOCATION);
  }

  // 2. Tính biểu phí vận chuyển theo khoảng cách
  let originalFee = 0;
  let estimatedDeliveryText = "1 - 2 ngày";

  if (distanceKm <= 5) {
    // Siêu gần (Nội thành < 5km): Giao hỏa tốc trong ngày
    originalFee = 15000;
    estimatedDeliveryText = "Hỏa tốc (2 - 4 giờ)";
  } else if (distanceKm <= 15) {
    // Nội thành mở rộng (5 - 15km)
    originalFee = 25000 + Math.round((distanceKm - 5) * 1500);
    estimatedDeliveryText = "Trong ngày (4 - 8 giờ)";
  } else if (distanceKm <= 35) {
    // Ngoại thành (15 - 35km)
    originalFee = 35000 + Math.round((distanceKm - 15) * 1200);
    estimatedDeliveryText = "1 - 2 ngày";
  } else {
    // Liên tỉnh (> 35km)
    originalFee = 45000 + Math.round((distanceKm - 35) * 800);
    // Giới hạn trần phí ship tối đa 80.000₫ để khách không bị quá đắt
    originalFee = Math.min(originalFee, 80000);
    estimatedDeliveryText = "2 - 3 ngày";
  }

  // Làm tròn đến hàng nghìn gần nhất (ví dụ: 26.300 -> 26.000)
  originalFee = Math.round(originalFee / 1000) * 1000;

  // 3. Kiểm tra điều kiện miễn phí vận chuyển (Freeship)
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shippingFee = isFreeShipping ? 0 : originalFee;

  return {
    distanceKm,
    shippingFee,
    originalFee,
    isFreeShipping,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    estimatedDeliveryText,
    warehouseLocation: WAREHOUSE_LOCATION,
  };
}

/**
 * Tra cứu địa chỉ từ Tọa độ GPS bằng Server Reverse Geocoding
 */
export async function reverseGeocode(
  coords: Coordinates
): Promise<{ street: string; city: string; formattedAddress: string } | null> {
  if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
    return null;
  }

  try {
    const res = await fetch(`/api/shipping/reverse?lat=${coords.lat}&lng=${coords.lng}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.city) {
      return {
        street: data.street || "",
        city: data.city || "",
        formattedAddress: data.formattedAddress || "",
      };
    }
    return null;
  } catch (err) {
    console.error("Lỗi khi chuyển đổi tọa độ GPS sang địa chỉ:", err);
    return null;
  }
}

/**
 * Hàm loại bỏ dấu tiếng Việt để tìm kiếm không dấu
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

/**
 * Bảng tọa độ trung tâm các Tỉnh/Thành phố lớn tại Việt Nam (Tra cứu tức thì 0ms)
 */
export const PROVINCE_COORDINATES: Record<string, Coordinates> = {
  // Miền Nam
  "ho chi minh": { lat: 10.7769, lng: 106.7009 },
  "hcm": { lat: 10.7769, lng: 106.7009 },
  "sai gon": { lat: 10.7769, lng: 106.7009 },
  "binh duong": { lat: 10.9805, lng: 106.6519 },
  "dong nai": { lat: 10.9574, lng: 106.8427 },
  "ba ria - vung tau": { lat: 10.4114, lng: 107.1362 },
  "vung tau": { lat: 10.4114, lng: 107.1362 },
  "long an": { lat: 10.5336, lng: 106.4116 },
  "tien giang": { lat: 10.3599, lng: 106.3615 },
  "can tho": { lat: 10.0452, lng: 105.7469 },
  "an giang": { lat: 10.3831, lng: 105.4216 },
  "dong thap": { lat: 10.4578, lng: 105.6324 },
  "ben tre": { lat: 10.2415, lng: 106.3759 },
  "vinh long": { lat: 10.2537, lng: 105.9722 },
  "tra vinh": { lat: 9.9348, lng: 106.3455 },
  "hau giang": { lat: 9.7844, lng: 105.4701 },
  "soc trang": { lat: 9.6035, lng: 105.9749 },
  "bac lieu": { lat: 9.2941, lng: 105.7278 },
  "ca mau": { lat: 9.1769, lng: 105.1524 },
  "kien giang": { lat: 10.0125, lng: 105.0809 },
  "phu quoc": { lat: 10.2289, lng: 103.9572 },
  "tay ninh": { lat: 11.3101, lng: 106.0984 },
  "binh phuoc": { lat: 11.7512, lng: 106.9048 },

  // Miền Trung & Tây Nguyên
  "da nang": { lat: 16.0544, lng: 108.2022 },
  "thua thien hue": { lat: 16.4637, lng: 107.5909 },
  "hue": { lat: 16.4637, lng: 107.5909 },
  "quang nam": { lat: 15.5654, lng: 108.2616 },
  "quang ngai": { lat: 15.1205, lng: 108.7923 },
  "binh dinh": { lat: 13.7820, lng: 109.2197 },
  "quy nhon": { lat: 13.7820, lng: 109.2197 },
  "phu yen": { lat: 13.0882, lng: 109.0924 },
  "khanh hoa": { lat: 12.2388, lng: 109.1967 },
  "nha trang": { lat: 12.2388, lng: 109.1967 },
  "ninh thuan": { lat: 11.5644, lng: 108.9882 },
  "binh thuan": { lat: 10.9333, lng: 108.1000 },
  "phan thiet": { lat: 10.9333, lng: 108.1000 },
  "kon tum": { lat: 14.3533, lng: 108.0000 },
  "gia lai": { lat: 13.9833, lng: 108.0000 },
  "dak lak": { lat: 12.6667, lng: 108.0500 },
  "buon ma thuot": { lat: 12.6667, lng: 108.0500 },
  "dak nong": { lat: 12.0000, lng: 107.6833 },
  "lam dong": { lat: 11.9404, lng: 108.4583 },
  "da lat": { lat: 11.9404, lng: 108.4583 },
  "quang tri": { lat: 16.7500, lng: 107.1833 },
  "quang binh": { lat: 17.4833, lng: 106.6000 },
  "ha tinh": { lat: 18.3333, lng: 105.9000 },
  "nghe an": { lat: 18.6667, lng: 105.6667 },
  "vinh": { lat: 18.6667, lng: 105.6667 },
  "thanh hoa": { lat: 19.8000, lng: 105.7833 },

  // Miền Bắc
  "ha noi": { lat: 21.0285, lng: 105.8542 },
  "hai phong": { lat: 20.8449, lng: 106.6881 },
  "quang ninh": { lat: 20.9500, lng: 107.0833 },
  "ha long": { lat: 20.9500, lng: 107.0833 },
  "hai duong": { lat: 20.9372, lng: 106.3145 },
  "hung yen": { lat: 20.6464, lng: 106.0511 },
  "bac ninh": { lat: 21.1861, lng: 106.0763 },
  "bac giang": { lat: 21.2731, lng: 106.1946 },
  "vinh phuc": { lat: 21.3089, lng: 105.6049 },
  "phu tho": { lat: 21.3228, lng: 105.2280 },
  "thai nguyen": { lat: 21.5942, lng: 105.8482 },
  "nam dinh": { lat: 20.4200, lng: 106.1683 },
  "thai binh": { lat: 20.4463, lng: 106.3366 },
  "ha nam": { lat: 20.5453, lng: 105.9122 },
  "ninh binh": { lat: 20.2506, lng: 105.9745 },
  "hoa binh": { lat: 20.8136, lng: 105.3383 },
  "son la": { lat: 21.3256, lng: 103.9188 },
  "dien bien": { lat: 21.3853, lng: 103.0188 },
  "lai chau": { lat: 22.3964, lng: 103.4686 },
  "lao cai": { lat: 22.4856, lng: 103.9707 },
  "sa pa": { lat: 22.3364, lng: 103.8438 },
  "yen bai": { lat: 21.7168, lng: 104.8974 },
  "lang son": { lat: 21.8537, lng: 106.7618 },
  "tuyen quang": { lat: 21.8234, lng: 105.2180 },
  "ha giang": { lat: 22.8233, lng: 104.9839 },
  "cao bang": { lat: 22.6667, lng: 106.2500 },
  "bac kan": { lat: 22.1471, lng: 105.8348 },
};

/**
 * Tra cứu tọa độ nhanh từ Tên tỉnh / thành phố (0ms)
 */
export function getCoordinatesFromCity(cityName: string): Coordinates | null {
  if (!cityName) return null;
  const clean = removeVietnameseTones(cityName)
    .replace(/^(tinh|thanh pho|tp\.|tp)\s+/i, "")
    .trim();

  // 1. Tìm chính xác
  if (PROVINCE_COORDINATES[clean]) {
    return PROVINCE_COORDINATES[clean];
  }

  // 2. Tìm gần đúng (fuzzy includes)
  for (const [key, coords] of Object.entries(PROVINCE_COORDINATES)) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }

  return null;
}

/**
 * Tự động chuyển đổi Địa chỉ chữ thành Tọa độ GPS (Forward Geocoding)
 * Kết hợp tra cứu Nominatim + Bảng tọa độ Tỉnh/Thành fallback 100% an toàn.
 */
export interface BranchOption {
  branchName: string;
  street: string;
  district?: string;
  city: string;
  displayName: string;
  coords: Coordinates;
  isPoi?: boolean;
}

export interface GeocodeResponse {
  coords: Coordinates | null;
  error?: string;
  message?: string;
  displayName?: string;
  matchedName?: string;
  source?: string;
  hasMultipleBranches?: boolean;
  branches?: BranchOption[];
}

/**
 * Geocoding chi tiết có trả về message và trạng thái lỗi từ máy chủ
 */
export async function forwardGeocodeDetailed(
  street: string,
  city: string
): Promise<GeocodeResponse> {
  const cleanCity = city?.trim() || "";
  const cleanStreet = street?.trim() || "";

  if (!cleanCity && !cleanStreet) {
    return { coords: null, error: "MISSING_INPUT" };
  }

  try {
    const res = await fetch(
      `/api/shipping/geocode?street=${encodeURIComponent(cleanStreet)}&city=${encodeURIComponent(cleanCity)}`
    );
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.error("Lỗi khi geocoding địa chỉ:", err);
  }

  // Chỉ fallback theo Tỉnh/Thành phố khi người dùng KHÔNG nhập tên đường cụ thể
  if (!cleanStreet && cleanCity) {
    const fallback = getCoordinatesFromCity(cleanCity);
    return { coords: fallback, source: "city_fallback" };
  }

  return { coords: null, error: "NETWORK_ERROR" };
}

export async function forwardGeocode(
  street: string,
  city: string
): Promise<Coordinates | null> {
  const res = await forwardGeocodeDetailed(street, city);
  return res.coords;
}


export interface AddressSuggestion {
  displayName: string;
  street: string;
  city: string;
  lat: number;
  lng: number;
}

/**
 * Gợi ý địa chỉ tự động (Autocomplete) khi khách gõ tìm kiếm (Việt Nam)
 * Gọi qua internal Server Route để tránh lỗi CORS và chặn User-Agent trên browser.
 */
export async function searchAddressSuggestions(
  query: string
): Promise<AddressSuggestion[]> {
  const clean = query?.trim();
  if (!clean || clean.length < 2) return [];

  try {
    const res = await fetch(`/api/shipping/suggestions?q=${encodeURIComponent(clean)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch (err) {
    console.error("Lỗi khi tìm gợi ý địa chỉ:", err);
    return [];
  }
}

/**
 * Tạo liên kết Google Maps dẫn đường cho Shipper hoặc mở xem vị trí cho Khách hàng.
 * @param options.lat Vĩ độ GPS
 * @param options.lng Kinh độ GPS
 * @param options.address Địa chỉ dạng chuỗi (Số nhà, Tên đường, Phường, Quận, TP)
 * @param options.mode 'dir' (Mở chỉ đường lái xe cho shipper) | 'search' (Mở ghim vị trí cho khách)
 */
export function getGoogleMapsUrl(options: {
  lat?: number | null;
  lng?: number | null;
  address?: string;
  mode?: "dir" | "search";
}): string {
  const { lat, lng, address, mode = "dir" } = options;
  const cleanAddress = address?.trim();

  // ƯU TIÊN HÀNG ĐẦU: Lấy đúng chuỗi text địa chỉ cụ thể người dùng nhập (số nhà, ngõ/hẻm, đường, phường, TP)
  // để Google Maps dùng thuật toán tìm kiếm và dẫn đường đến đúng vị trí ngôi nhà/số hẻm cụ thể của khách.
  if (cleanAddress) {
    if (mode === "dir") {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddress)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`;
  }

  // Fallback: Sử dụng tọa độ GPS nếu không có chuỗi text địa chỉ
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    if (mode === "dir") {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return "https://www.google.com/maps";
}
