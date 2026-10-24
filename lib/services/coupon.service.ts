import { supabase } from "../supabase/client";

export interface Coupon {
  id: string;
  code: string;
  title?: string;
  discount_percent: number;
  min_order_amount?: number;
  valid_until: string;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
}

export async function getCoupons() {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching coupons:", error);
    return { data: null, error };
  }

  return { data: data as Coupon[], error: null };
}

export async function getFeaturedCoupon() {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error
    console.error("Error fetching featured coupon:", error);
    return { data: null, error };
  }

  return { data: data as Coupon | null, error: null };
}

export async function createCoupon(payload: Partial<Coupon>) {
  const { data, error } = await supabase
    .from("coupons")
    .insert([payload])
    .select()
    .single();

  return { data: data as Coupon | null, error };
}

export async function updateCoupon(id: string, payload: Partial<Coupon>) {
  const { data, error } = await supabase
    .from("coupons")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  return { data: data as Coupon | null, error };
}

export async function deleteCoupon(id: string) {
  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", id);

  return { error };
}

export async function setFeaturedCoupon(id: string) {
  // First, unset all featured coupons
  await supabase
    .from("coupons")
    .update({ is_featured: false })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Just to update all rows

  // Then set the specific one
  const { data, error } = await supabase
    .from("coupons")
    .update({ is_featured: true })
    .eq("id", id)
    .select()
    .single();

  return { data: data as Coupon | null, error };
}

export async function validateCoupon(code: string, currentOrderAmount?: number) {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return { data: null, error: new Error("Mã giảm giá không hợp lệ hoặc không tồn tại") };
  }

  const coupon = data as Coupon;

  // Check valid_until
  if (new Date(coupon.valid_until) < new Date()) {
    return { data: null, error: new Error("Mã giảm giá đã hết hạn") };
  }

  // Check usage_limit
  if (coupon.usage_limit && coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
    return { data: null, error: new Error("Mã giảm giá đã hết lượt sử dụng") };
  }

  // Check min_order_amount (giá trị đơn hàng tối thiểu)
  if (currentOrderAmount !== undefined && coupon.min_order_amount && coupon.min_order_amount > 0) {
    if (currentOrderAmount < coupon.min_order_amount) {
      const formattedMin = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(coupon.min_order_amount);
      return {
        data: null,
        error: new Error(`Mã này chỉ áp dụng cho đơn hàng từ ${formattedMin} trở lên`),
      };
    }
  }

  return { data: coupon, error: null };
}

export async function getActiveCoupons() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .gt("valid_until", now)
    .order("discount_percent", { ascending: false });

  if (error) {
    console.error("Lỗi khi lấy danh sách mã giảm giá khả dụng:", error);
    return { data: [] as Coupon[], error };
  }

  // Lọc thêm các mã chưa vượt quá usage_limit
  const validCoupons = (data as Coupon[]).filter((c) => {
    if (c.usage_limit && c.usage_limit > 0 && c.used_count >= c.usage_limit) {
      return false;
    }
    return true;
  });

  return { data: validCoupons, error: null };
}

