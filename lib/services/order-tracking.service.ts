import { supabase } from "@/lib/supabase/client";
import { WAREHOUSE_LOCATION, PROVINCE_COORDINATES, Coordinates } from "./shipping.service";

export interface OrderTrackingEvent {
  id: string;
  order_id: string;
  sequence_order: number;
  status: "pending" | "confirmed" | "hub_transit" | "out_for_delivery" | "delivered" | "failed" | "cancelled" | string;
  title: string;
  description?: string | null;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  is_current: boolean;
  is_completed: boolean;
  completed_at?: string | null;
  created_at?: string;
}

export interface MilestoneTemplateParams {
  orderId: string;
  distanceKm: number;
  customerCity?: string;
  customerAddress?: string;
  customerCoords?: Coordinates | null;
}

/**
 * Tự động sinh chuỗi mốc hành trình mẫu dựa trên cự ly đơn hàng
 * - Dưới 25km (Nội thành): 4 mốc tinh gọn
 * - Trên 25km (Liên tỉnh): 6 mốc vận chuyển chặng trung chuyển
 */
export function generateMilestoneTemplates(params: MilestoneTemplateParams): Omit<OrderTrackingEvent, "id" | "created_at">[] {
  const { orderId, distanceKm, customerCity = "Khách hàng", customerAddress = "", customerCoords } = params;
  const isInterProvincial = distanceKm > 25;

  const originCoords = WAREHOUSE_LOCATION;
  const destCoords = customerCoords || { lat: 10.7769, lng: 106.7009 };

  if (!isInterProvincial) {
    // Kịch bản 1: Nội thành / Cùng tỉnh (< 25km)
    return [
      {
        order_id: orderId,
        sequence_order: 1,
        status: "pending",
        title: "Đơn hàng đã được tiếp nhận",
        description: "Kiện hàng đang được nhân viên kho kiểm tra và đóng gói cẩn thận.",
        location_name: WAREHOUSE_LOCATION.name,
        latitude: originCoords.lat,
        longitude: originCoords.lng,
        is_current: true,
        is_completed: true,
        completed_at: new Date().toISOString(),
      },
      {
        order_id: orderId,
        sequence_order: 2,
        status: "confirmed",
        title: "Đã xuất kho - Chuyển sang Bưu cục phát",
        description: "Đơn hàng đã rời kho trung tâm và đang trên đường đến bưu cục gần bạn.",
        location_name: "Bưu cục phát nội thành",
        latitude: (originCoords.lat + destCoords.lat) / 2,
        longitude: (originCoords.lng + destCoords.lng) / 2,
        is_current: false,
        is_completed: false,
        completed_at: null,
      },
      {
        order_id: orderId,
        sequence_order: 3,
        status: "out_for_delivery",
        title: "Đang phát hàng chặng cuối",
        description: "Bưu tá đã nhận hàng và đang di chuyển đến địa chỉ của bạn. Vui lòng để ý điện thoại.",
        location_name: customerCity,
        latitude: destCoords.lat,
        longitude: destCoords.lng,
        is_current: false,
        is_completed: false,
        completed_at: null,
      },
      {
        order_id: orderId,
        sequence_order: 4,
        status: "delivered",
        title: "Giao hàng thành công",
        description: `Đã giao thành công tại: ${customerAddress || customerCity}. Cảm ơn quý khách!`,
        location_name: customerAddress || customerCity,
        latitude: destCoords.lat,
        longitude: destCoords.lng,
        is_current: false,
        is_completed: false,
        completed_at: null,
      },
    ];
  }

  // Kịch bản 2: Vận chuyển liên tỉnh (> 25km)
  return [
    {
      order_id: orderId,
      sequence_order: 1,
      status: "pending",
      title: "Đơn hàng đã tiếp nhận & đóng gói",
      description: "Đơn hàng đã sẵn sàng xuất bến tại kho trung tâm xuất phát.",
      location_name: WAREHOUSE_LOCATION.name,
      latitude: originCoords.lat,
      longitude: originCoords.lng,
      is_current: true,
      is_completed: true,
      completed_at: new Date().toISOString(),
    },
    {
      order_id: orderId,
      sequence_order: 2,
      status: "hub_transit",
      title: "Rời Kho Tổng - Vận chuyển trục chính",
      description: "Kiện hàng đang được xe tải chuyên tuyến vận chuyển trên trục liên tỉnh.",
      location_name: "Trung tâm Khai thác Liên tỉnh",
      latitude: originCoords.lat + (destCoords.lat - originCoords.lat) * 0.25,
      longitude: originCoords.lng + (destCoords.lng - originCoords.lng) * 0.25,
      is_current: false,
      is_completed: false,
      completed_at: null,
    },
    {
      order_id: orderId,
      sequence_order: 3,
      status: "hub_transit",
      title: "Đã nhập Hub trung chuyển khu vực",
      description: `Đã đến Hub phân loại khu vực ${customerCity}. Đang phân loại về bưu cục sở tại.`,
      location_name: `Hub Trung Chuyển ${customerCity}`,
      latitude: originCoords.lat + (destCoords.lat - originCoords.lat) * 0.65,
      longitude: originCoords.lng + (destCoords.lng - originCoords.lng) * 0.65,
      is_current: false,
      is_completed: false,
      completed_at: null,
    },
    {
      order_id: orderId,
      sequence_order: 4,
      status: "confirmed",
      title: "Đã đến Bưu cục phát địa phương",
      description: `Kiện hàng đã nhập bưu cục sở tại và được phân công cho nhân viên phát hàng.`,
      location_name: `Bưu cục phát ${customerCity}`,
      latitude: destCoords.lat + 0.008,
      longitude: destCoords.lng + 0.008,
      is_current: false,
      is_completed: false,
      completed_at: null,
    },
    {
      order_id: orderId,
      sequence_order: 5,
      status: "out_for_delivery",
      title: "Bưu tá đang phát hàng",
      description: "Bưu tá đang trên đường giao kiện hàng đến bạn. Vui lòng giữ liên lạc.",
      location_name: customerAddress || customerCity,
      latitude: destCoords.lat,
      longitude: destCoords.lng,
      is_current: false,
      is_completed: false,
      completed_at: null,
    },
    {
      order_id: orderId,
      sequence_order: 6,
      status: "delivered",
      title: "Giao hàng thành công",
      description: `Đã giao thành công tại địa chỉ ${customerAddress || customerCity}. Cảm ơn quý khách!`,
      location_name: customerAddress || customerCity,
      latitude: destCoords.lat,
      longitude: destCoords.lng,
      is_current: false,
      is_completed: false,
      completed_at: null,
    },
  ];
}

/**
 * Đảm bảo danh sách mốc không bị trùng lặp sequence_order (giữ mốc có tiến độ mới hơn)
 */
export function deduplicateEvents(events: OrderTrackingEvent[]): OrderTrackingEvent[] {
  const map = new Map<number, OrderTrackingEvent>();
  for (const ev of events) {
    const existing = map.get(ev.sequence_order);
    if (!existing) {
      map.set(ev.sequence_order, ev);
    } else {
      if ((ev.is_current && !existing.is_current) || (ev.is_completed && !existing.is_completed)) {
        map.set(ev.sequence_order, ev);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.sequence_order - b.sequence_order);
}

/**
 * Lấy toàn bộ danh sách mốc hành trình của một đơn hàng
 */
export async function getOrderTrackingEvents(orderId: string): Promise<{ data: OrderTrackingEvent[] | null; error: any }> {
  const { data, error } = await supabase
    .from("order_tracking_events")
    .select("*")
    .eq("order_id", orderId)
    .order("sequence_order", { ascending: true });

  return { data: data ? deduplicateEvents(data) : null, error };
}

/**
 * Khởi tạo chuỗi mốc mẫu cho đơn hàng nếu chưa có trong Database
 */
export async function initOrderTrackingEvents(
  params: MilestoneTemplateParams
): Promise<{ data: OrderTrackingEvent[] | null; error: any }> {
  // 1. Ưu tiên gọi RPC get_public_order_tracking (tự động sinh mốc trong database qua SECURITY DEFINER)
  const { data: publicData, error: rpcError } = await getPublicOrderTracking(params.orderId);
  if (!rpcError && publicData?.tracking_events && publicData.tracking_events.length > 0) {
    return { data: deduplicateEvents(publicData.tracking_events), error: null };
  }

  // 2. Kiểm tra nếu đã có mốc trong bảng
  const { data: directEvents, error: checkError } = await getOrderTrackingEvents(params.orderId);
  if (!checkError && directEvents && directEvents.length > 0) {
    return { data: deduplicateEvents(directEvents), error: null };
  }

  // 3. Fallback in-memory: Đảm bảo giao diện luôn luôn có dữ liệu mốc hiển thị ngay cả khi mạng chậm
  const inMemoryTemplates = generateMilestoneTemplates(params).map((t, idx) => ({
    ...t,
    id: `temp_${params.orderId}_${idx + 1}`,
    created_at: new Date().toISOString(),
  }));

  return { data: inMemoryTemplates, error: null };
}

/**
 * 1-Click: Chuyển sang mốc hành trình tiếp theo (dành cho Admin / Shipper)
 */
export async function advanceToNextMilestone(orderId: string): Promise<{
  success: boolean;
  currentEvent?: OrderTrackingEvent | null;
  error?: any;
}> {
  const { data: events, error } = await getOrderTrackingEvents(orderId);
  if (error || !events || events.length === 0) {
    return { success: false, error: error || new Error("Không tìm thấy mốc hành trình") };
  }

  const currentIndex = events.findIndex((e) => e.is_current);
  const targetIndex = currentIndex === -1 ? 0 : currentIndex + 1;

  if (targetIndex >= events.length) {
    // Đã ở mốc cuối cùng (Đã giao hàng)
    return { success: true, currentEvent: events[events.length - 1] };
  }

  const currentEvent = currentIndex !== -1 ? events[currentIndex] : null;
  const nextEvent = events[targetIndex];

  // 1. Đánh dấu mốc cũ là đã hoàn tất
  if (currentEvent) {
    await supabase
      .from("order_tracking_events")
      .update({
        is_current: false,
        is_completed: true,
        completed_at: currentEvent.completed_at || new Date().toISOString(),
      })
      .eq("id", currentEvent.id);
  }

  // 2. Kích hoạt mốc mới
  const { data: updatedNext, error: updateError } = await supabase
    .from("order_tracking_events")
    .update({
      is_current: true,
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("id", nextEvent.id)
    .select()
    .single();

  if (updateError) {
    return { success: false, error: updateError };
  }

  // 3. Đồng bộ trạng thái đơn hàng chính trong bảng orders
  if (nextEvent.status === "out_for_delivery") {
    await supabase.from("orders").update({ status: "shipping" }).eq("id", orderId);
  } else if (nextEvent.status === "delivered") {
    await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
  }

  return { success: true, currentEvent: updatedNext };
}

/**
 * Lắng nghe thay đổi hành trình đơn hàng thời gian thực qua Supabase Realtime WebSocket
 */
export function subscribeOrderTracking(orderId: string, onUpdate: () => void) {
  const channel = supabase
    .channel(`tracking_events_${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_tracking_events",
        filter: `order_id=eq.${orderId}`,
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export interface PublicOrderTrackingData {
  id: string;
  status: string;
  total_amount: number;
  shipping_fee: number;
  distance_km: number;
  created_at: string;
  addresses: {
    full_name?: string;
    phone?: string;
    street?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  order_items: {
    id: string;
    quantity: number;
    price: number;
    products?: {
      id: string;
      name: string;
      image_url?: string | null;
    } | null;
    product_variants?: {
      name: string;
    } | null;
  }[];
  tracking_events: OrderTrackingEvent[];
}

/**
 * Tra cứu công khai hành trình đơn hàng bằng mã ngắn (#XXXXXXXX), UUID đầy đủ, hoặc mã thanh toán
 */
export async function getPublicOrderTracking(searchCode: string): Promise<{
  data: PublicOrderTrackingData | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc("get_public_order_tracking", {
      p_search_code: searchCode,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as PublicOrderTrackingData) || null, error: null };
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

