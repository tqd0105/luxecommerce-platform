import { NextRequest, NextResponse } from "next/server";

export function normalizeVietnamese(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

const VIETNAMESE_STOP_WORDS = new Set([
  "duong", "pho", "ngo", "ngach", "hem", "so", "nha", "ap", "to", "khu",
  "phuong", "xa", "quan", "huyen", "thi", "thanh", "tinh", "tp",
  "viet", "nam", "vn", "toa", "tang", "can", "ho", "chung", "cu", "q", "p"
]);

export function extractCoreStreetKeywords(street: string): string[] {
  const cleaned = cleanStreetName(street);
  const normalized = normalizeVietnamese(cleaned).replace(/[,\.\-\/\\#]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  
  // Lọc bỏ các stop words thông thường
  const filtered = tokens.filter(t => !VIETNAMESE_STOP_WORDS.has(t));
  if (filtered.length > 0) return filtered;

  // Nếu bị lọc hết (ví dụ chỉ có "duong", "so", "3"), giữ lại số hoặc token nhận diện chính
  return tokens.filter(t => t !== "duong" && t !== "pho");
}

function cleanStreetName(street: string): string {
  return street
    .replace(/^((số|so|nhà|nha|hẻm|hem|ngõ|ngo|ngách|ngach)\s+)?\d+[\w\/\-\.]*\s*/i, "")
    .trim();
}

const EXCLUDED_OSM_TYPES = new Set([
  "bus_stop", "subway", "tram", "railway", "platform", "stop_position",
  "memorial", "monument", "speed_camera", "city", "administrative", "country", "state",
  "office", "moving_company", "shop", "convenience", "supermarket", "pharmacy"
]);

import { isGoongConfigured, goongGeocode } from "@/lib/services/goong.service";

/**
 * Bảng từ điển đơn vị hành chính và các đợt sáp nhập tại Việt Nam:
 * - TP. Thủ Đức sáp nhập từ Quận 2, Quận 9, Quận Thủ Đức cũ (2021).
 * - Các quận/huyện trực thuộc TP.HCM, Hà Nội, Đà Nẵng...
 * Đảm bảo OpenStreetMap / Photon không bị từ chối oan khi dữ liệu chưa cập nhật kịp tên mới.
 */
const HCM_ALIASES = [
  "ho chi minh", "hcm", "sai gon", "thu duc", "quan 1", "quan 2", "quan 3", "quan 4", "quan 5",
  "quan 6", "quan 7", "quan 8", "quan 9", "quan 10", "quan 11", "quan 12", "binh thanh",
  "tan binh", "tan phu", "phu nhuan", "go vap", "binh tan", "cu chi", "hoc mon", "binh chanh",
  "nha be", "can gio"
];

const HN_ALIASES = [
  "ha noi", "hn", "ba dinh", "hoan kiem", "hai ba trung", "dong da", "tay ho", "cau giay",
  "thanh xuan", "hoang mai", "long bien", "nam tu liem", "bac tu liem", "ha dong", "son tay"
];

const DN_ALIASES = [
  "da nang", "hai chau", "thanh khe", "son tra", "ngu hanh son", "lien chieu", "cam le", "hoa vang"
];

const VIETNAM_MERGER_ALIASES: Record<string, string[]> = {
  "thu duc": HCM_ALIASES,
  "quan 2": HCM_ALIASES,
  "quan 9": HCM_ALIASES,
  "ho chi minh": HCM_ALIASES,
  "hcm": HCM_ALIASES,
  "sai gon": HCM_ALIASES,
  "ha noi": HN_ALIASES,
  "hn": HN_ALIASES,
  "da nang": DN_ALIASES,
};

/**
 * Kiểm tra xem địa điểm trả về có thực sự nằm trong Tỉnh/Thành phố/Quận mà khách yêu cầu không.
 * Ngăn chặn tình trạng khách chọn "Thủ Đức" mà API lại trả về kết quả ở "Gia Lai" hay "Hà Nội".
 */
function isCityMatch(queryCity: string, item: any): boolean {
  if (!queryCity) return false;
  const cleanCity = normalizeVietnamese(queryCity).replace(/[,\.\-\/\\#\(\)]/g, " ").trim();
  const queryTokens = cleanCity.split(/\s+/).filter(t => !VIETNAMESE_STOP_WORDS.has(t) && t.length > 0);

  const addr = item.address || {};
  const props = item.properties || {};

  const candidateLocation = [
    addr.city,
    addr.state,
    addr.province,
    addr.county,
    addr.city_district,
    addr.district,
    addr.suburb,
    addr.quarter,
    addr.town,
    props.city,
    props.state,
    props.district,
    props.county,
    item.display_name,
  ]
    .filter(Boolean)
    .map((p: string) => normalizeVietnamese(p).replace(/[,\.\-\/\\#\(\)]/g, " ").trim())
    .filter(Boolean)
    .join(" | ");

  const normalizedCandidate = candidateLocation;

  // 1. Kiểm tra đối chiếu qua Bảng từ điển sáp nhập hành chính Việt Nam
  let matchedMergerKey = false;
  for (const [key, aliases] of Object.entries(VIETNAM_MERGER_ALIASES)) {
    if (cleanCity === key || cleanCity.includes(key) || queryTokens.includes(key)) {
      matchedMergerKey = true;
      if (aliases.some(alias => {
        const regex = new RegExp(`(^|[\\s\\|])${alias}([\\s\\|]|$)`, "i");
        return regex.test(normalizedCandidate);
      })) {
        return true;
      }
    }
  }

  // Nếu thuộc các thành phố lớn trong danh mục sáp nhập nhưng không khớp bất kỳ alias nào -> Từ chối
  if (matchedMergerKey) return false;

  // 2. Đối với các tỉnh thành phố khác (Hải Phòng, Cần Thơ, Nha Trang, Huế...)
  if (queryTokens.length === 0) return true;
  return queryTokens.every(token => {
    const regex = new RegExp(`(^|[\\s\\|])${token}([\\s\\|]|$)`, "i");
    return regex.test(normalizedCandidate);
  });
}

/**
 * Tách địa chỉ người dùng nhập thành:
 * - specificParts: Tên địa danh, Chung cư, Tòa nhà, Tên đường (Ví dụ: "Chung cư EhomeS", "Đường Đỗ Xuân Hợp")
 * - wardParts: Tên Phường, Xã, Thị trấn (Ví dụ: "phường Bình Trưng", "xã Phú Hữu")
 */
function parseAddressInput(street: string): { specificParts: string[]; wardParts: string[] } {
  const rawParts = street.split(",").map(p => p.trim()).filter(Boolean);
  const specificParts: string[] = [];
  const wardParts: string[] = [];

  for (const part of rawParts) {
    const norm = normalizeVietnamese(part);
    if (/^(phuong|xa|thi tran|tt|p|p\.)(\s+|$)/i.test(norm) || /^(quan|huyen|q|q\.)(\s+|$)/i.test(norm)) {
      wardParts.push(part);
    } else {
      const subParts = part.split(/\s+(?:phuong|phường|xa|xã|thi tran|thị trấn|p\.|p\b)\s*/i);
      if (subParts.length > 1) {
        if (subParts[0].trim()) specificParts.push(subParts[0].trim());
        if (subParts[1]?.trim()) wardParts.push(subParts[1].trim());
      } else {
        specificParts.push(part);
      }
    }
  }

  if (specificParts.length === 0) {
    specificParts.push(street);
  }

  return { specificParts, wardParts };
}

/**
 * Tách các từ khóa đại diện cho Phường/Xã nếu người dùng nhập kèm trong ô địa chỉ
 */
function extractWardTokens(wardParts: string[]): string[] {
  if (!wardParts || wardParts.length === 0) return [];
  const normalized = normalizeVietnamese(wardParts.join(" ")).replace(/[,\.\-\/\\#\(\)]/g, " ");
  return normalized.split(/\s+/).filter(t => !VIETNAMESE_STOP_WORDS.has(t) && t.length > 0);
}

/**
 * Kiểm tra xem kết quả trả về có thực sự khớp với địa danh / địa điểm / tên đường khách nhập không.
 * - Khớp tên đường (candidateRoad)
 * - HOẶC khớp tên địa danh / Chung cư / Tòa nhà / Bệnh viện / Trường học / POI (candidatePoiName)
 * - Nếu người dùng nhập kèm Phường/Xã: Bắt buộc vị trí trả về phải thuộc Phường/Xã đó.
 * - TUYỆT ĐỐI từ chối tên đường/địa điểm giả mạo (ví dụ: 'Trần Quang Dũng', 'Tòa nhà Songoku').
 */
function isLocationMatch(queryStreet: string, item: any): boolean {
  if (!queryStreet || !item) return false;

  const addr = item.address || {};
  const props = item.properties || {};

  // 1. Tên đường thực tế từ OSM/Photon
  const candidateRoad =
    addr.road ||
    props.street ||
    (item.class === "highway" ? item.name : "") ||
    (props.osm_key === "highway" ? props.name : "") ||
    "";

  // 2. Tên địa danh / Địa điểm / Chung cư / POI từ OSM/Photon
  const candidatePoiName =
    item.name ||
    props.name ||
    addr.building ||
    addr.residential ||
    addr.amenity ||
    addr.leisure ||
    addr.tourism ||
    "";

  const { specificParts, wardParts } = parseAddressInput(queryStreet);

  let hasMatchedSegment = false;

  for (const segment of specificParts) {
    const segmentKeywords = extractCoreStreetKeywords(segment);
    if (segmentKeywords.length === 0) continue;

    // A. Khớp tên đường thực tế
    if (candidateRoad) {
      const roadWords = extractCoreStreetKeywords(candidateRoad);
      const roadWordSet = new Set(roadWords);
      if (segmentKeywords.every(w => roadWordSet.has(w))) {
        hasMatchedSegment = true;
        break;
      }
    }

    // B. Khớp tên địa danh / POI / Chung cư / Tòa nhà
    if (candidatePoiName) {
      const poiWords = extractCoreStreetKeywords(candidatePoiName);
      const poiWordSet = new Set(poiWords);
      const normPoi = normalizeVietnamese(candidatePoiName);
      const cleanSeg = normalizeVietnamese(cleanStreetName(segment));

      const isPhraseMatch = cleanSeg.length > 3 && normPoi.includes(cleanSeg);
      const isAllWordsMatch = segmentKeywords.every(w => poiWordSet.has(w));

      if (isPhraseMatch || isAllWordsMatch) {
        // Nếu là trạm xe buýt hoặc hạ tầng phụ, bắt buộc phải khớp cụm từ liên tục để tránh gom nhầm từ rời rạc
        const isTransportOrWay = addr.highway || props.osm_key === "highway" || props.osm_value === "bus_stop" || item.class === "highway";
        if (isTransportOrWay && !isPhraseMatch) {
          continue;
        }
        hasMatchedSegment = true;
        break;
      }
    }
  }

  if (!hasMatchedSegment) return false;

  // Nếu người dùng nhập kèm Phường/Xã ở phần đuôi
  const wardTokens = extractWardTokens(wardParts);
  if (wardTokens.length > 0) {
    const fullCandidateText = normalizeVietnamese([
      candidateRoad,
      candidatePoiName,
      addr.suburb,
      addr.neighbourhood,
      addr.quarter,
      addr.district,
      addr.city,
      item.display_name,
    ].filter(Boolean).join(" ")).replace(/[,\.\-\/\\#\(\)]/g, " ");

    const matchedWardTokens = wardTokens.filter(t => fullCandidateText.includes(t));
    if (matchedWardTokens.length === 0) {
      return false;
    }
  }

  return true;
}

// Bộ nhớ đệm In-Memory Cache (24h) giảm tải hoàn toàn cho OSM Nominatim
interface GeocodeCacheItem {
  coords: { lat: number; lng: number };
  source: string;
  displayName: string;
  matchedName: string;
  timestamp: number;
  hasMultipleBranches?: boolean;
  branches?: BranchOption[];
  message?: string;
}
const geocodeMemoryCache = new Map<string, GeocodeCacheItem>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface KnownPoi {
  keywords: string[];
  name: string;
  displayName: string;
  coords: { lat: number; lng: number };
  cityTokens: string[];
}

/**
 * Danh bạ các địa danh, khu phức hợp, tòa nhà và chung cư nổi bật nhất tại Việt Nam.
 * Đảm bảo phản hồi tức thì (0ms latency), độ chính xác tuyệt đối 100% và không phụ thuộc mạng/rate-limit.
 */
const PROMINENT_VIETNAM_POIS: KnownPoi[] = [
  {
    keywords: ["ehomes"],
    name: "Chung cư EhomeS Phú Hữu",
    displayName: "Chung cư EhomeS, Đường Đỗ Xuân Hợp, Phường Phú Hữu, TP. Thủ Đức, TP.HCM",
    coords: { lat: 10.797528, lng: 106.7852347 },
    cityTokens: ["hcm", "ho chi minh", "thu duc", "quan 9", "sai gon"],
  },
  {
    keywords: ["cho", "ben"],
    name: "Chợ Bến Thành",
    displayName: "Chợ Bến Thành, Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM",
    coords: { lat: 10.7725301, lng: 106.6980365 },
    cityTokens: ["hcm", "ho chi minh", "quan 1", "sai gon"],
  },
  {
    keywords: ["benh", "vien", "cho", "ray"],
    name: "Bệnh viện Chợ Rẫy",
    displayName: "Bệnh viện Chợ Rẫy, 201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM",
    coords: { lat: 10.7566964, lng: 106.6597263 },
    cityTokens: ["hcm", "ho chi minh", "quan 5", "sai gon"],
  },
  {
    keywords: ["landmark", "81"],
    name: "Vincom Landmark 81",
    displayName: "Vincom Landmark 81, 720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM",
    coords: { lat: 10.7951, lng: 106.7218 },
    cityTokens: ["hcm", "ho chi minh", "binh thanh", "sai gon"],
  },
  {
    keywords: ["vinhomes", "central", "park"],
    name: "Vinhomes Central Park",
    displayName: "Vinhomes Central Park, 208 Nguyễn Hữu Cảnh, Phường 22, Bình Thạnh, TP.HCM",
    coords: { lat: 10.7937, lng: 106.7225 },
    cityTokens: ["hcm", "ho chi minh", "binh thanh", "sai gon"],
  },
  {
    keywords: ["sala"],
    name: "Khu đô thị Sala",
    displayName: "Khu đô thị Sala, 10 Mai Chí Thọ, Phường An Lợi Đông, TP. Thủ Đức, TP.HCM",
    coords: { lat: 10.7718613, lng: 106.7247815 },
    cityTokens: ["hcm", "ho chi minh", "thu duc", "quan 2", "sai gon"],
  },
  {
    keywords: ["masteri", "thao", "dien"],
    name: "Chung cư Masteri Thảo Điền",
    displayName: "Chung cư Masteri Thảo Điền, 159 Xa Lộ Hà Nội, Thảo Điền, TP. Thủ Đức, TP.HCM",
    coords: { lat: 10.8028, lng: 106.7412 },
    cityTokens: ["hcm", "ho chi minh", "thu duc", "quan 2", "sai gon"],
  },
  {
    keywords: ["masteri", "an", "phu"],
    name: "Chung cư Masteri An Phú",
    displayName: "Chung cư Masteri An Phú, 179 Xa Lộ Hà Nội, An Phú, TP. Thủ Đức, TP.HCM",
    coords: { lat: 10.8038, lng: 106.7461 },
    cityTokens: ["hcm", "ho chi minh", "thu duc", "quan 2", "sai gon"],
  },
  {
    keywords: ["tan", "son", "nhat"],
    name: "Sân bay Quốc tế Tân Sơn Nhất",
    displayName: "Sân bay Quốc tế Tân Sơn Nhất, Phường 2, Tân Bình, TP.HCM",
    coords: { lat: 10.8179793, lng: 106.6562645 },
    cityTokens: ["hcm", "ho chi minh", "tan binh", "sai gon"],
  },
  {
    keywords: ["noi", "bai"],
    name: "Sân bay Quốc tế Nội Bài",
    displayName: "Sân bay Quốc tế Nội Bài, Phú Minh, Sóc Sơn, Hà Nội",
    coords: { lat: 21.2187, lng: 105.8042 },
    cityTokens: ["ha noi", "hn", "soc son"],
  },
  {
    keywords: ["ho", "hoan", "kiem"],
    name: "Hồ Hoàn Kiếm (Hồ Gươm)",
    displayName: "Hồ Hoàn Kiếm, Hàng Trống, Hoàn Kiếm, Hà Nội",
    coords: { lat: 21.0287, lng: 105.8523 },
    cityTokens: ["ha noi", "hn", "hoan kiem"],
  },
  {
    keywords: ["ho", "con", "rua"],
    name: "Hồ Con Rùa",
    displayName: "Hồ Con Rùa, Phường Võ Thị Sáu, Quận 3, TP.HCM",
    coords: { lat: 10.7827, lng: 106.6958 },
    cityTokens: ["hcm", "ho chi minh", "quan 3", "sai gon"],
  },
  {
    keywords: ["cau", "rong"],
    name: "Cầu Rồng Đà Nẵng",
    displayName: "Cầu Rồng, Phước Ninh, Hải Châu, Đà Nẵng",
    coords: { lat: 16.0611, lng: 108.2272 },
    cityTokens: ["da nang", "hai chau", "son tra"],
  },
];

export interface BranchOption {
  branchName: string;
  street: string;
  district?: string;
  city: string;
  displayName: string;
  coords: { lat: number; lng: number };
  isPoi?: boolean;
}

interface MultiBranchPoi {
  mainKeywords: string[];
  aliases?: string[];
  name: string;
  cityTokens: string[];
  branches: {
    branchName: string;
    branchKeywords: string[];
    street: string;
    district?: string;
    city: string;
    displayName: string;
    coords: { lat: number; lng: number };
  }[];
}

/**
 * Danh mục các trường đại học, bệnh viện, cơ quan hoặc chuỗi dịch vụ có NHIỀU CƠ SỞ tại Việt Nam.
 * Tự động phân luồng:
 * 1. Nếu người dùng chỉ định rõ tên cơ sở/quận/tên đường (ví dụ "cơ sở 2" hoặc "Võ Oanh") -> Chọn chuẩn xác cơ sở đó ngay lập tức.
 * 2. Nếu người dùng chỉ gõ tên trường chung chung -> Trả về cờ hasMultipleBranches: true kèm danh sách cơ sở để người dùng chọn.
 */
const MULTI_BRANCH_POIS: MultiBranchPoi[] = [
  {
    mainKeywords: ["giao", "thong", "van", "tai"],
    aliases: ["uth", "dh gtvt", "gtvt", "giao thong van tai"],
    name: "Trường Đại học Giao thông Vận tải TP.HCM (UTH)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon"],
    branches: [
      {
        branchName: "Cơ sở 1 (Trụ sở chính - Bình Thạnh)",
        branchKeywords: ["co so 1", "cs1", "chinh", "vo oanh", "d3", "binh thanh", "thanh my tay", "p25", "phuong 25"],
        street: "Số 2 Đường Võ Oanh, Phường 25, Quận Bình Thạnh",
        district: "Bình Thạnh",
        city: "TP.HCM",
        displayName: "Trường ĐH Giao thông Vận tải - Cơ sở chính, 2 Võ Oanh, Phường 25, Bình Thạnh, TP.HCM",
        coords: { lat: 10.8048584, lng: 106.7167612 },
      },
      {
        branchName: "Cơ sở 2 (TP. Thủ Đức - Q.9 cũ)",
        branchKeywords: ["co so 2", "cs2", "tang nhon phu", "le van viet", "quan 9", "thu duc", "duong so 12", "tran thi dieu"],
        street: "Số 10 Đường số 12, P. Tăng Nhơn Phú B, TP. Thủ Đức",
        district: "TP. Thủ Đức",
        city: "TP.HCM",
        displayName: "Trường ĐH Giao thông Vận tải - Cơ sở 2, 10 Đường số 12, Tăng Nhơn Phú B, TP. Thủ Đức",
        coords: { lat: 10.8452193, lng: 106.7939485 },
      },
      {
        branchName: "Cơ sở 3 (Quận 12)",
        branchKeywords: ["co so 3", "cs3", "to ky", "quan 12", "q12", "tan chanh hiep"],
        street: "Hẻm 70 Tô Ký, P. Tân Chánh Hiệp, Quận 12",
        district: "Quận 12",
        city: "TP.HCM",
        displayName: "Trường ĐH Giao thông Vận tải - Cơ sở 3, Hẻm 70 Tô Ký, P. Tân Chánh Hiệp, Quận 12, TP.HCM",
        coords: { lat: 10.8654, lng: 106.6189 },
      },
    ],
  },
  {
    mainKeywords: ["bach", "khoa"],
    aliases: ["hcmut", "dh bach khoa", "bach khoa"],
    name: "Trường Đại học Bách Khoa TP.HCM (HCMUT)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon"],
    branches: [
      {
        branchName: "Cơ sở 1 (Quận 10)",
        branchKeywords: ["co so 1", "cs1", "ly thuong kiet", "quan 10", "q10", "p14"],
        street: "268 Lý Thường Kiệt, Phường 14, Quận 10",
        district: "Quận 10",
        city: "TP.HCM",
        displayName: "Đại học Bách Khoa - Cơ sở 1, 268 Lý Thường Kiệt, Phường 14, Quận 10, TP.HCM",
        coords: { lat: 10.7721, lng: 106.6579 },
      },
      {
        branchName: "Cơ sở 2 (KĐT ĐHQG Thủ Đức)",
        branchKeywords: ["co so 2", "cs2", "thu duc", "linh trung", "di an", "dhqg"],
        street: "Khu đô thị ĐHQG TP.HCM, Phường Linh Trung, TP. Thủ Đức",
        district: "TP. Thủ Đức",
        city: "TP.HCM",
        displayName: "Đại học Bách Khoa - Cơ sở 2, KĐT ĐHQG TP.HCM, Phường Linh Trung, TP. Thủ Đức",
        coords: { lat: 10.8804, lng: 106.8054 },
      },
    ],
  },
  {
    mainKeywords: ["kinh", "te"],
    aliases: ["ueh", "dh kinh te", "dai hoc kinh te", "ktx ueh"],
    name: "Trường Đại học Kinh tế TP.HCM (UEH)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon", "vinh long"],
    branches: [
      {
        branchName: "Cơ sở A (Trụ sở chính - Quận 3)",
        branchKeywords: ["co so a", "csa", "59c nguyen dinh chieu", "nguyen dinh chieu", "vo thi sau", "quan 3", "q3", "tru so chinh", "hoi truong a"],
        street: "59C Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3",
        district: "Quận 3",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở A (Trụ sở chính), 59C Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP.HCM",
        coords: { lat: 10.782806, lng: 106.696123 },
      },
      {
        branchName: "Cơ sở B (Quận 10)",
        branchKeywords: ["co so b", "csb", "279 nguyen tri phuong", "nguyen tri phuong", "quan 10", "q10", "p5", "toa b1", "toa b2", "thu vien thong minh"],
        street: "279 Nguyễn Tri Phương, Phường 5, Quận 10",
        district: "Quận 10",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở B, 279 Nguyễn Tri Phương, Phường 5, Quận 10, TP.HCM",
        coords: { lat: 10.760814, lng: 106.667232 },
      },
      {
        branchName: "Cơ sở C (Quận 10)",
        branchKeywords: ["co so c", "csc", "91 ba thang hai", "ba thang hai", "3 thang 2", "3/2", "quan 10", "q10", "p11"],
        street: "91 Đường 3 Tháng 2, Phường 11, Quận 10",
        district: "Quận 10",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở C, 91 Đường 3 Tháng 2, Phường 11, Quận 10, TP.HCM",
        coords: { lat: 10.771954, lng: 106.674936 },
      },
      {
        branchName: "Cơ sở D (Quận 1)",
        branchKeywords: ["co so d", "csd", "196 tran quang khai", "tran quang khai", "tan dinh", "quan 1", "q1"],
        street: "196 Trần Quang Khải, Phường Tân Định, Quận 1",
        district: "Quận 1",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở D, 196 Trần Quang Khải, Phường Tân Định, Quận 1, TP.HCM",
        coords: { lat: 10.791559, lng: 106.691721 },
      },
      {
        branchName: "Cơ sở E (Quận 1)",
        branchKeywords: ["co so e", "cse", "54 nguyen van thu", "nguyen van thu", "da kao", "dakao", "quan 1", "q1"],
        street: "54 Nguyễn Văn Thủ, Phường Đa Kao, Quận 1",
        district: "Quận 1",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở E, 54 Nguyễn Văn Thủ, Phường Đa Kao, Quận 1, TP.HCM",
        coords: { lat: 10.787728, lng: 106.697662 },
      },
      {
        branchName: "Cơ sở H (Phú Nhuận)",
        branchKeywords: ["co so h", "csh", "1a hoang dieu", "hoang dieu", "phu nhuan", "p10"],
        street: "1A Hoàng Diệu, Phường 10, Quận Phú Nhuận",
        district: "Phú Nhuận",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở H, 1A Hoàng Diệu, Phường 10, Quận Phú Nhuận, TP.HCM",
        coords: { lat: 10.796720, lng: 106.679234 },
      },
      {
        branchName: "Cơ sở I (Viện Đào tạo Quốc tế ISB - Quận 3)",
        branchKeywords: ["co so i", "csi", "isb", "vien isb", "pham ngoc thach", "17 pham ngoc thach", "ho con rua", "quan 3", "q3"],
        street: "17 Phạm Ngọc Thạch, Phường Võ Thị Sáu, Quận 3",
        district: "Quận 3",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở I (Viện ISB), 17 Phạm Ngọc Thạch, Phường Võ Thị Sáu, Quận 3, TP.HCM",
        coords: { lat: 10.782015, lng: 106.695340 },
      },
      {
        branchName: "Cơ sở N (Phân hiệu Nam Sài Gòn - Bình Chánh)",
        branchKeywords: ["co so n", "csn", "nguyen van linh", "nam sai gon", "binh chanh", "phong phu", "khu chuc nang 15"],
        street: "Nguyễn Văn Linh, Khu chức năng số 15, Đô thị mới Nam TP, Xã Phong Phú, Huyện Bình Chánh",
        district: "Bình Chánh",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Phân hiệu Nam Sài Gòn (Cơ sở N), Nguyễn Văn Linh, Phong Phú, Bình Chánh, TP.HCM",
        coords: { lat: 10.716254, lng: 106.663187 },
      },
      {
        branchName: "Cơ sở V (Viện Đổi mới sáng tạo & UEH Hotel - Quận 3)",
        branchKeywords: ["co so v", "csv", "232 vo thi sau", "vo thi sau", "khach san ueh", "ueh hotel", "doi moi sang tao"],
        street: "232/6 Võ Thị Sáu, Phường Võ Thị Sáu, Quận 3",
        district: "Quận 3",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Cơ sở V (UEH Hotel / Viện ĐMST), 232/6 Võ Thị Sáu, Phường Võ Thị Sáu, Quận 3, TP.HCM",
        coords: { lat: 10.783680, lng: 106.687420 },
      },
      {
        branchName: "Cơ sở TDTT Quận 8 (Trung tâm Thể thao)",
        branchKeywords: ["tdtt", "the duc the thao", "san the thao", "pham duc son", "144 pham duc son", "quan 8", "q8", "phu dinh"],
        street: "144 Phạm Đức Sơn, Phường 16, Quận 8",
        district: "Quận 8",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - Trung tâm Thể dục Thể thao, 144 Phạm Đức Sơn, Phường 16, Quận 8, TP.HCM",
        coords: { lat: 10.722810, lng: 106.632140 },
      },
      {
        branchName: "Ký túc xá Trần Hưng Đạo (Quận 1)",
        branchKeywords: ["tran hung dao", "ktx tran hung dao", "ky tuc xa tran hung dao", "135 tran hung dao", "cau ong lanh", "quan 1", "q1"],
        street: "135 Trần Hưng Đạo, Phường Cầu Ông Lãnh, Quận 1",
        district: "Quận 1",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - KTX Trần Hưng Đạo, 135 Trần Hưng Đạo, Phường Cầu Ông Lãnh, Quận 1, TP.HCM",
        coords: { lat: 10.764512, lng: 106.694215 },
      },
      {
        branchName: "Ký túc xá Nguyễn Chí Thanh (Quận 5)",
        branchKeywords: ["nguyen chi thanh", "ktx nguyen chi thanh", "ky tuc xa nguyen chi thanh", "43 nguyen chi thanh", "quan 5", "q5"],
        street: "43-45 Nguyễn Chí Thanh, Phường 9, Quận 5",
        district: "Quận 5",
        city: "TP.HCM",
        displayName: "ĐH Kinh tế UEH - KTX Nguyễn Chí Thanh, 43-45 Nguyễn Chí Thanh, Phường 9, Quận 5, TP.HCM",
        coords: { lat: 10.760124, lng: 106.668541 },
      },
      {
        branchName: "Phân hiệu Vĩnh Long (UEH Mekong Campus)",
        branchKeywords: ["vinh long", "phan hieu vinh long", "ueh mekong", "nguyen trung truc"],
        street: "1B Nguyễn Trung Trực, Phường 8, TP. Vĩnh Long",
        district: "TP. Vĩnh Long",
        city: "Vĩnh Long",
        displayName: "ĐH Kinh tế UEH - Phân hiệu Vĩnh Long (Mekong Campus), 1B Nguyễn Trung Trực, Phường 8, TP. Vĩnh Long",
        coords: { lat: 10.246100, lng: 105.957200 },
      },
    ],
  },
  {
    mainKeywords: ["khoa", "hoc", "tu", "nhien"],
    aliases: ["hcmus", "dh khtn", "khtn", "khoa hoc tu nhien"],
    name: "Trường Đại học Khoa học Tự nhiên (HCMUS)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon"],
    branches: [
      {
        branchName: "Cơ sở 1 (Quận 5)",
        branchKeywords: ["co so 1", "cs1", "nguyen van cu", "quan 5", "q5"],
        street: "227 Nguyễn Văn Cừ, Phường 4, Quận 5",
        district: "Quận 5",
        city: "TP.HCM",
        displayName: "ĐH Khoa học Tự nhiên - Cơ sở 1, 227 Nguyễn Văn Cừ, Quận 5, TP.HCM",
        coords: { lat: 10.7628, lng: 106.6825 },
      },
      {
        branchName: "Cơ sở 2 (KĐT ĐHQG Thủ Đức)",
        branchKeywords: ["co so 2", "cs2", "thu duc", "linh trung", "dhqg"],
        street: "Khu đô thị ĐHQG TP.HCM, Phường Linh Trung, TP. Thủ Đức",
        district: "TP. Thủ Đức",
        city: "TP.HCM",
        displayName: "ĐH Khoa học Tự nhiên - Cơ sở 2, KĐT ĐHQG, Linh Trung, TP. Thủ Đức",
        coords: { lat: 10.8758, lng: 106.7994 },
      },
    ],
  },
  {
    mainKeywords: ["khoa", "hoc", "xa", "hoi"],
    aliases: ["hcmussh", "ussh", "dh nhan van", "nhan van", "khoa hoc xa hoi"],
    name: "Trường Đại học Khoa học Xã hội và Nhân văn (HCMUSSH)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon"],
    branches: [
      {
        branchName: "Cơ sở 1 (Quận 1)",
        branchKeywords: ["co so 1", "cs1", "dinh tien hoang", "quan 1", "q1", "ben nghe"],
        street: "10-12 Đinh Tiên Hoàng, Phường Bến Nghé, Quận 1",
        district: "Quận 1",
        city: "TP.HCM",
        displayName: "ĐH KHXH&NV - Cơ sở 1, 10-12 Đinh Tiên Hoàng, Quận 1, TP.HCM",
        coords: { lat: 10.7877, lng: 106.7005 },
      },
      {
        branchName: "Cơ sở 2 (KĐT ĐHQG Thủ Đức)",
        branchKeywords: ["co so 2", "cs2", "thu duc", "linh trung", "dhqg"],
        street: "Khu đô thị ĐHQG TP.HCM, Phường Linh Trung, TP. Thủ Đức",
        district: "TP. Thủ Đức",
        city: "TP.HCM",
        displayName: "ĐH KHXH&NV - Cơ sở 2, KĐT ĐHQG, Linh Trung, TP. Thủ Đức",
        coords: { lat: 10.8715, lng: 106.8023 },
      },
    ],
  },
  {
    mainKeywords: ["su", "pham"],
    aliases: ["hcmue", "dh su pham", "su pham tphcm"],
    name: "Trường Đại học Sư phạm TP.HCM (HCMUE)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon"],
    branches: [
      {
        branchName: "Cơ sở 1 (Trụ sở chính - Quận 5)",
        branchKeywords: ["co so 1", "cs1", "an duong vuong", "quan 5", "q5", "tru so chinh"],
        street: "280 An Dương Vương, Phường 4, Quận 5",
        district: "Quận 5",
        city: "TP.HCM",
        displayName: "ĐH Sư phạm TP.HCM - Cơ sở 1, 280 An Dương Vương, Phường 4, Quận 5, TP.HCM",
        coords: { lat: 10.7601, lng: 106.6821 },
      },
      {
        branchName: "Cơ sở 2 (Quận 3)",
        branchKeywords: ["co so 2", "cs2", "le van sy", "quan 3", "q3", "p14"],
        street: "222 Lê Văn Sỹ, Phường 14, Quận 3",
        district: "Quận 3",
        city: "TP.HCM",
        displayName: "ĐH Sư phạm TP.HCM - Cơ sở 2, 222 Lê Văn Sỹ, Phường 14, Quận 3, TP.HCM",
        coords: { lat: 10.7892, lng: 106.6749 },
      },
    ],
  },
  {
    mainKeywords: ["sai", "gon"],
    aliases: ["sgu", "dh sai gon", "dai hoc sai gon"],
    name: "Trường Đại học Sài Gòn (SGU)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon"],
    branches: [
      {
        branchName: "Cơ sở chính (Quận 5)",
        branchKeywords: ["co so chinh", "cs chinh", "an duong vuong", "quan 5", "q5"],
        street: "273 An Dương Vương, Phường 3, Quận 5",
        district: "Quận 5",
        city: "TP.HCM",
        displayName: "Đại học Sài Gòn - Cơ sở chính, 273 An Dương Vương, Phường 3, Quận 5, TP.HCM",
        coords: { lat: 10.7598, lng: 106.6814 },
      },
      {
        branchName: "Cơ sở 1 (Quận 3)",
        branchKeywords: ["co so 1", "cs1", "ba huyen thanh quan", "quan 3", "q3"],
        street: "105 Bà Huyện Thanh Quan, Phường Võ Thị Sáu, Quận 3",
        district: "Quận 3",
        city: "TP.HCM",
        displayName: "Đại học Sài Gòn - Cơ sở 1, 105 Bà Huyện Thanh Quan, Quận 3, TP.HCM",
        coords: { lat: 10.7785, lng: 106.6836 },
      },
      {
        branchName: "Cơ sở 2 (Quận 1)",
        branchKeywords: ["co so 2", "cs2", "ton duc thang", "quan 1", "q1"],
        street: "04 Tôn Đức Thắng, Phường Bến Nghé, Quận 1",
        district: "Quận 1",
        city: "TP.HCM",
        displayName: "Đại học Sài Gòn - Cơ sở 2, 04 Tôn Đức Thắng, Quận 1, TP.HCM",
        coords: { lat: 10.7749, lng: 106.7051 },
      },
    ],
  },
  {
    mainKeywords: ["luat"],
    aliases: ["ulaw", "dh luat", "dai hoc luat tphcm"],
    name: "Trường Đại học Luật TP.HCM (ULAW)",
    cityTokens: ["hcm", "ho chi minh", "thu duc", "sai gon"],
    branches: [
      {
        branchName: "Cơ sở 1 (Trụ sở chính - Quận 4)",
        branchKeywords: ["co so 1", "cs1", "nguyen tat thanh", "quan 4", "q4", "cau khanh hoi"],
        street: "02 Nguyễn Tất Thành, Phường 12, Quận 4",
        district: "Quận 4",
        city: "TP.HCM",
        displayName: "ĐH Luật TP.HCM - Cơ sở 1, 02 Nguyễn Tất Thành, Phường 12, Quận 4, TP.HCM",
        coords: { lat: 10.7681, lng: 106.7067 },
      },
      {
        branchName: "Cơ sở 2 (TP. Thủ Đức)",
        branchKeywords: ["co so 2", "cs2", "quoc lo 13", "hiep binh chanh", "thu duc", "ql13"],
        street: "123 Quốc lộ 13, Phường Hiệp Bình Chánh, TP. Thủ Đức",
        district: "TP. Thủ Đức",
        city: "TP.HCM",
        displayName: "ĐH Luật TP.HCM - Cơ sở 2, 123 Quốc lộ 13, Hiệp Bình Chánh, TP. Thủ Đức",
        coords: { lat: 10.8285, lng: 106.7161 },
      },
    ],
  },
];

function matchMultiBranchPoi(street: string, city: string): {
  matchedBranch: BranchOption;
  hasMultipleBranches: boolean;
  branches: BranchOption[];
  poiName: string;
} | null {
  const normCity = normalizeVietnamese(city);
  const normStreet = normalizeVietnamese(street);

  for (const poi of MULTI_BRANCH_POIS) {
    const isCityOk =
      poi.cityTokens.some((ct) => normCity.includes(ct) || normStreet.includes(ct)) ||
      normCity.length === 0;
    if (!isCityOk) continue;

    const isMainMatch =
      poi.mainKeywords.every((kw) => normStreet.includes(kw)) ||
      (poi.aliases &&
        poi.aliases.some((alias) => {
          const regex = new RegExp(`(^|[\\s,.-])${alias}([\\s,.-]|$)`, "i");
          return regex.test(normStreet);
        }));
    if (!isMainMatch) continue;

    const formattedBranches: BranchOption[] = poi.branches.map(b => ({
      branchName: b.branchName,
      street: b.street,
      district: b.district,
      city: b.city,
      displayName: b.displayName,
      coords: b.coords,
    }));

    // 1. Kiểm tra xem người dùng có chỉ định rõ cơ sở/đường/quận cụ thể trong input không
    for (const b of poi.branches) {
      if (b.branchKeywords.some(bk => normStreet.includes(bk))) {
        return {
          matchedBranch: {
            branchName: b.branchName,
            street: b.street,
            district: b.district,
            city: b.city,
            displayName: b.displayName,
            coords: b.coords,
          },
          hasMultipleBranches: false,
          branches: formattedBranches,
          poiName: poi.name,
        };
      }
    }

    // 2. Người dùng chỉ nhập chung chung -> Trả về danh sách tất cả các cơ sở để chọn
    return {
      matchedBranch: formattedBranches[0],
      hasMultipleBranches: true,
      branches: formattedBranches,
      poiName: poi.name,
    };
  }

  return null;
}

function matchKnownPoi(street: string, city: string): KnownPoi | null {
  const normCity = normalizeVietnamese(city);
  const { specificParts } = parseAddressInput(street);

  for (const poi of PROMINENT_VIETNAM_POIS) {
    const isCityOk = poi.cityTokens.some(ct => normCity.includes(ct));
    if (!isCityOk) continue;

    for (const part of specificParts) {
      const partTokens = extractCoreStreetKeywords(part);
      const partSet = new Set(partTokens);
      if (poi.keywords.every(kw => partSet.has(kw))) {
        return poi;
      }
    }
  }
  return null;
}

function calculateDistanceMeters(c1: { lat: number; lng: number }, c2: { lat: number; lng: number }): number {
  const R = 6371e3;
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLon = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1.lat * Math.PI) / 180) * Math.cos((c2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addUniqueDynamicBranch(
  list: BranchOption[],
  newBranch: BranchOption,
  minDistMeters = 350
): boolean {
  const exists = list.some(b => calculateDistanceMeters(b.coords, newBranch.coords) < minDistMeters);
  if (!exists) {
    list.push(newBranch);
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const street = searchParams.get("street")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";

  if (!street || !city) {
    return NextResponse.json({ coords: null, error: "MISSING_INPUT" });
  }

  // 1. Kiểm tra cache trong bộ nhớ trước tiên
  const cacheKey = `${normalizeVietnamese(street)}__${normalizeVietnamese(city)}`;
  const cached = geocodeMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      coords: cached.coords,
      source: `${cached.source}_cached`,
      displayName: cached.displayName,
      matchedName: cached.matchedName,
      hasMultipleBranches: cached.hasMultipleBranches,
      branches: cached.branches,
      message: cached.message,
    });
  }

  // 2. Kiểm tra các địa điểm có NHIỀU CƠ SỞ (Multi-Branch POIs)
  const multiBranchResult = matchMultiBranchPoi(street, city);
  if (multiBranchResult) {
    const resultData = {
      coords: multiBranchResult.matchedBranch.coords,
      source: multiBranchResult.hasMultipleBranches ? "multi_branch_selection_needed" : "multi_branch_specific",
      displayName: multiBranchResult.matchedBranch.displayName,
      matchedName: multiBranchResult.hasMultipleBranches
        ? multiBranchResult.poiName
        : `${multiBranchResult.poiName} - ${multiBranchResult.matchedBranch.branchName}`,
      hasMultipleBranches: multiBranchResult.hasMultipleBranches,
      branches: multiBranchResult.branches,
      message: multiBranchResult.hasMultipleBranches
        ? `Địa điểm '${multiBranchResult.poiName}' có ${multiBranchResult.branches.length} cơ sở tại ${city}. Quý khách vui lòng chọn cơ sở cần nhận hàng.`
        : undefined,
    };
    if (!multiBranchResult.hasMultipleBranches) {
      geocodeMemoryCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
    }
    return NextResponse.json(resultData);
  }

  // 3. Kiểm tra danh bạ các POI / Chung cư / Địa danh đơn lẻ nổi bật tại Việt Nam (0ms, 100% chính xác)
  const knownPoi = matchKnownPoi(street, city);
  if (knownPoi) {
    const resultData = {
      coords: knownPoi.coords,
      source: "known_poi_verified",
      displayName: knownPoi.displayName,
      matchedName: knownPoi.name,
    };
    geocodeMemoryCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
    return NextResponse.json(resultData);
  }

  let isOsmRateLimited = false;

  try {
    const { specificParts, wardParts } = parseAddressInput(street);
    const wardString = wardParts.join(", ");


    const searchCandidates: string[] = [
      [street, city, "Việt Nam"].filter(Boolean).join(", "),
    ];

    const cleaned = cleanStreetName(street);
    if (cleaned && cleaned !== street) {
      searchCandidates.push([cleaned, city, "Việt Nam"].filter(Boolean).join(", "));
    }

    // Đưa từng phân đoạn địa danh / chung cư / tên đường vào danh sách tìm kiếm
    for (const part of specificParts) {
      const cleanedPart = cleanStreetName(part);
      if (cleanedPart) {
        if (wardString) {
          searchCandidates.push([cleanedPart, wardString, city, "Việt Nam"].join(", "));
        }
        searchCandidates.push([cleanedPart, city, "Việt Nam"].join(", "));
      }
    }

    // Mở rộng tìm kiếm cho TP.HCM và Hà Nội sau sáp nhập hành chính
    const normalizedCity = normalizeVietnamese(city).replace(/[,\.\-\/\\#\(\)]/g, " ");
    const isHcmRelated =
      normalizedCity.includes("ho chi minh") ||
      normalizedCity.includes("hcm") ||
      normalizedCity.includes("sai gon") ||
      normalizedCity.includes("thu duc") ||
      /^quan\s+[1-9]\b/.test(normalizedCity) ||
      /^quan\s+1[0-2]\b/.test(normalizedCity) ||
      normalizedCity.includes("binh thanh") ||
      normalizedCity.includes("go vap") ||
      normalizedCity.includes("tan binh") ||
      normalizedCity.includes("tan phu") ||
      normalizedCity.includes("phu nhuan");

    if (isHcmRelated) {
      searchCandidates.push([cleaned || street, "Thành phố Hồ Chí Minh, Việt Nam"].join(", "));
      for (const part of specificParts) {
        const cleanedPart = cleanStreetName(part);
        if (cleanedPart) {
          if (wardString) {
            searchCandidates.push([cleanedPart, wardString, "Thành phố Hồ Chí Minh, Việt Nam"].join(", "));
          }
          searchCandidates.push([cleanedPart, "Thành phố Hồ Chí Minh, Việt Nam"].join(", "));
        }
      }
    }

    if (
      normalizedCity.includes("ha noi") ||
      normalizedCity.includes("hn") ||
      normalizedCity.includes("ba dinh") ||
      normalizedCity.includes("cau giay")
    ) {
      searchCandidates.push([cleaned || street, "Hà Nội, Việt Nam"].join(", "));
      for (const part of specificParts) {
        const cleanedPart = cleanStreetName(part);
        if (cleanedPart) {
          searchCandidates.push([cleanedPart, "Hà Nội, Việt Nam"].join(", "));
        }
      }
    }

    // Lọc trùng lặp để tiết kiệm tối đa số lượng request
    const uniqueCandidates = Array.from(new Set(searchCandidates));

    // 0. Ưu tiên hàng đầu: Sử dụng Goong Maps API nếu đã cấu hình GOONG_API_KEY
    if (isGoongConfigured()) {
      const fullQuery = [street, city, "Việt Nam"].filter(Boolean).join(", ");
      const goongResult = await goongGeocode(fullQuery, city);
      if (goongResult && goongResult.coords) {
        const resultData = {
          coords: goongResult.coords,
          source: "goong_verified",
          displayName: goongResult.displayName,
          matchedName: goongResult.street,
        };
        geocodeMemoryCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
        return NextResponse.json(resultData);
      }

      // Nếu người dùng nhập tên đường giả mạo, Goong không tìm thấy, từ chối ngay lập tức
      return NextResponse.json({
        coords: null,
        error: "ADDRESS_NOT_FOUND",
        message: `Goong Maps không tìm thấy tên đường hoặc địa chỉ '${street}' tại '${city}'.`,
      });
    }

    // Thu thập tất cả các cơ sở phân bổ thực tế trong thành phố
    const collectedDynamicBranches: BranchOption[] = [];

    // 1. Tìm kiếm qua Nominatim OpenStreetMap với addressdetails (Fallback tiêu chuẩn)
    for (let i = 0; i < uniqueCandidates.length; i++) {
      const query = uniqueCandidates[i];
      // Nếu đã query trước đó và cần query tiếp theo, nghỉ nhẹ 600ms để tuân thủ chính sách 1 req/s của OSM
      if (i > 0) {
        await new Promise(r => setTimeout(r, 600));
      }

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=vn&addressdetails=1&limit=10&q=${encodeURIComponent(
          query
        )}`;

        const res = await fetch(url, {
          headers: {
            "Accept-Language": "vi",
            "User-Agent": "LuxeCommerce-Ecommerce-Server/1.0 (contact@luxecommerce.vn)",
          },
          signal: AbortSignal.timeout(4000),
        });

        // Xử lý khi Nominatim tạm thời bị giới hạn tần suất (HTTP 429)
        if (res.status === 429) {
          console.warn("Nominatim rate limit reached (HTTP 429).");
          isOsmRateLimited = true;
          break; // Thoát vòng lặp để tránh tiếp tục gửi request
        }

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const data = await res.json();
            if (Array.isArray(data)) {
              for (const item of data) {
                const isExcluded = EXCLUDED_OSM_TYPES.has(item.type) || EXCLUDED_OSM_TYPES.has(item.class);
                if (isExcluded && !isLocationMatch(street, item)) continue;

                // Bắt buộc khớp cả Tỉnh/Thành phố và Địa danh/Tên đường hợp lệ
                if (isCityMatch(city, item) && isLocationMatch(street, item)) {
                  const lat = parseFloat(item.lat);
                  const lng = parseFloat(item.lon);
                  if (!isNaN(lat) && !isNaN(lng)) {
                    const itemDistrict = item.address?.city_district || item.address?.district || item.address?.suburb || item.address?.county || "";
                    const itemStreet = [item.address?.house_number, item.address?.road].filter(Boolean).join(" ") || item.name || street;
                    const branchName = item.name || (itemDistrict ? `${street} (${itemDistrict})` : `${street} - Cơ sở ${collectedDynamicBranches.length + 1}`);
                    const normItemName = normalizeVietnamese(item.name || item.display_name || "");
                    const coreKeywords = extractCoreStreetKeywords(street);
                    const hasSpecificCoreWord = coreKeywords.length > 0 && coreKeywords.some(kw => kw.length >= 4 && normItemName.includes(kw));
                    const isPoi = (!["highway", "bus_stop", "platform"].includes(item.class || "") && item.type !== "street") || hasSpecificCoreWord;

                    addUniqueDynamicBranch(collectedDynamicBranches, {
                      branchName,
                      street: itemStreet,
                      district: itemDistrict,
                      city,
                      displayName: item.display_name,
                      coords: { lat, lng },
                      isPoi,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (osmErr) {
        console.warn("Nominatim fetch warning for query:", query, osmErr);
      }

      if (collectedDynamicBranches.length >= 3) {
        break;
      }
    }

    // 2. Thử tiếp qua Photon API nếu có thể kết nối (Photon có chỉ mục POI/Đại học/Bệnh viện cực kỳ phong phú)
    for (const query of uniqueCandidates.slice(0, 3)) {
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          query
        )}&bbox=102.14,8.18,109.46,23.39&limit=10`;
        const photonRes = await fetch(photonUrl, {
          signal: AbortSignal.timeout(3000),
        });
        if (photonRes.ok) {
          const photonData = await photonRes.json();
          if (Array.isArray(photonData?.features)) {
            for (const f of photonData.features) {
              const props = f.properties || {};

              const itemMock = {
                name: props.name || "",
                type: props.type || "",
                class: props.osm_value || "",
                address: {
                  road: props.street || (props.osm_key === "highway" ? props.name : ""),
                  city: props.city || props.state || "",
                  district: props.district || props.suburb || props.city_district || "",
                },
                properties: props,
                display_name: [props.name, props.street, props.district || props.suburb, props.city, props.state].filter(Boolean).join(", "),
              };

              const isExcluded = EXCLUDED_OSM_TYPES.has(props.osm_value) || EXCLUDED_OSM_TYPES.has(props.osm_key) || EXCLUDED_OSM_TYPES.has(props.type);
              if (isExcluded && !isLocationMatch(street, itemMock)) {
                continue;
              }

              // Bắt buộc khớp cả Tỉnh/Thành phố và Địa danh/Tên đường hợp lệ
              if (isCityMatch(city, itemMock) && isLocationMatch(street, itemMock)) {
                const coords = f.geometry?.coordinates;
                if (Array.isArray(coords) && coords.length >= 2) {
                  const lng = coords[0];
                  const lat = coords[1];
                  if (!isNaN(lat) && !isNaN(lng)) {
                    const itemDistrict = props.district || props.suburb || props.city_district || "";
                    const itemStreet = [props.housenumber, props.street].filter(Boolean).join(" ") || props.name || street;
                    const branchName = props.name || (itemDistrict ? `${street} (${itemDistrict})` : `${street} - Cơ sở ${collectedDynamicBranches.length + 1}`);
                    const normPoiName = normalizeVietnamese(props.name || itemMock.display_name || "");
                    const photonCoreWords = extractCoreStreetKeywords(street);
                    const photonHasCoreWord = photonCoreWords.length > 0 && photonCoreWords.some(kw => kw.length >= 4 && normPoiName.includes(kw));
                    const isPoi = (props.osm_key !== "highway" && props.type !== "street") || photonHasCoreWord;

                    addUniqueDynamicBranch(collectedDynamicBranches, {
                      branchName,
                      street: itemStreet,
                      district: itemDistrict,
                      city,
                      displayName: itemMock.display_name,
                      coords: { lat, lng },
                      isPoi,
                    });
                  }
                }
              }
            }
          }
        }
      } catch {
        // Photon timeout/network warning - bỏ qua êm
      }

      if (collectedDynamicBranches.length >= 3) {
        break;
      }
    }

    // 3. Đánh giá và trả về kết quả động:
    if (collectedDynamicBranches.length > 0) {
      // Nếu người dùng nhập số nhà/hẻm cụ thể (ví dụ "07/8 Nguyễn Duy Trinh"), đây là địa chỉ nhà riêng, không bao giờ mở modal nhiều cơ sở!
      const hasHouseNumber =
        /^\d+[\w\/\-\.]*\s*/i.test(street.trim()) ||
        /^(số|so|nhà|nha|hẻm|hem|ngõ|ngo|ngách|ngach)\s+\d+/i.test(street.trim());

      // Lọc các cơ sở POI thực thụ (không phải đường sá highway hay địa chỉ nhà riêng)
      const poiBranches = collectedDynamicBranches.filter(b => b.isPoi);
      const isMultiBranchEligible = !hasHouseNumber && poiBranches.length > 1;

      if (isMultiBranchEligible) {
        const resultData = {
          coords: poiBranches[0].coords,
          source: "dynamic_multi_branch_discovered",
          displayName: `${street} (${poiBranches.length} cơ sở tại ${city})`,
          matchedName: street,
          hasMultipleBranches: true,
          branches: poiBranches,
          message: `Hệ thống tìm thấy ${poiBranches.length} cơ sở/địa điểm của '${street}' tại ${city}. Quý khách vui lòng chọn đúng cơ sở nhận hàng.`,
        };
        geocodeMemoryCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
        return NextResponse.json(resultData);
      }

      // Ngược lại nếu chỉ có 1 địa điểm hoặc người dùng nhập địa chỉ đường/nhà riêng
      const primary = collectedDynamicBranches[0];
      const resultData = {
        coords: primary.coords,
        source: "exact_verified",
        displayName: primary.displayName,
        matchedName: primary.branchName || street,
        hasMultipleBranches: false,
      };
      geocodeMemoryCache.set(cacheKey, { ...resultData, timestamp: Date.now() });
      return NextResponse.json(resultData);
    }

    // Nếu OpenStreetMap bị giới hạn tần suất (HTTP 429), thông báo rõ ràng cho người dùng
    if (isOsmRateLimited) {
      return NextResponse.json({
        coords: null,
        error: "RATE_LIMITED",
        message: "Dịch vụ bản đồ OpenStreetMap tạm thời quá tải lượt truy vấn (429). Quý khách vui lòng thử lại sau vài giây hoặc bấm 'Chọn trên bản đồ' để định vị ngay lập tức.",
      });
    }

    // TUYỆT ĐỐI KHÔNG fallback vào trung tâm Tỉnh/Thành phố khi người dùng đã nhập tên đường/địa danh!
    // Trả về coords: null để thông báo rõ ràng rằng địa chỉ không tồn tại trên bản đồ.
    return NextResponse.json({
      coords: null,
      error: "ADDRESS_NOT_FOUND",
      message: `Không tìm thấy địa điểm, chung cư hoặc tên đường '${street}' tại '${city}'. Quý khách vui lòng kiểm tra lại hoặc sử dụng tính năng 'Chọn trên bản đồ'.`,
    });
  } catch (error) {
    console.error("Lỗi khi geocoding địa chỉ trên server:", error);
    return NextResponse.json({ coords: null, error: "SERVER_ERROR" });
  }
}

