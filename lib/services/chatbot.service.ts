import { supabase } from "../supabase/client";

export interface BotProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_percent: number;
  effective_price: number;
  stock_quantity: number;
  image_url: string | null;
  brand: string | null;
  category_name?: string;
}

export interface BotCoupon {
  code: string;
  discount_percent: number;
  valid_until: string;
}

export interface BotSearchOptions {
  keyword?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

/**
 * Tìm kiếm sản phẩm phù hợp trong Supabase để cung cấp ngữ cảnh cho Chatbot
 */
export async function searchProductsForBot(options: BotSearchOptions = {}): Promise<BotProduct[]> {
  try {
    const limit = options.limit || 6;
    let query = supabase
      .from("products")
      .select("id, name, slug, price, discount_percent, stock_quantity, image_url, brand, categories(name)")
      .gt("stock_quantity", 0);

    if (options.keyword && options.keyword.trim()) {
      const cleanKeyword = options.keyword.trim();
      query = query.ilike("name", `%${cleanKeyword}%`);
    }

    if (options.minPrice !== undefined && options.minPrice > 0) {
      query = query.gte("price", options.minPrice);
    }

    if (options.maxPrice !== undefined && options.maxPrice > 0) {
      query = query.lte("price", options.maxPrice);
    }

    query = query.order("created_at", { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error || !data) {
      console.error("Lỗi khi tìm sản phẩm cho chatbot:", error);
      return [];
    }

    return data.map((item: any) => {
      const originalPrice = Number(item.price) || 0;
      const discount = Number(item.discount_percent) || 0;
      const effectivePrice = discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice;
      const categoryName = item.categories && typeof item.categories === "object" ? item.categories.name : undefined;

      return {
        id: item.id,
        name: item.name,
        slug: item.slug || `product-${item.id}`,
        price: originalPrice,
        discount_percent: discount,
        effective_price: effectivePrice,
        stock_quantity: item.stock_quantity || 0,
        image_url: item.image_url || null,
        brand: item.brand || null,
        category_name: categoryName,
      };
    });
  } catch (err) {
    console.error("Exception searchProductsForBot:", err);
    return [];
  }
}

/**
 * Lấy danh sách mã giảm giá đang còn hiệu lực
 */
export async function getActiveCouponsForBot(): Promise<BotCoupon[]> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("coupons")
      .select("code, discount_percent, valid_until, is_active")
      .eq("is_active", true)
      .gte("valid_until", now)
      .order("discount_percent", { ascending: false })
      .limit(5);

    if (error || !data) {
      return [];
    }

    return data.map((c: any) => ({
      code: c.code,
      discount_percent: c.discount_percent,
      valid_until: c.valid_until,
    }));
  } catch (err) {
    console.error("Exception getActiveCouponsForBot:", err);
    return [];
  }
}

/**
 * Thông tin chính sách và quy định của cửa hàng LuxeCommerce
 */
export function getStorePolicies() {
  return {
    storeName: "LuxeCommerce",
    slogan: "Nền tảng giao dịch thương mại điện tử với đa dạng các sản phẩm cao cấp",
    shipping: {
      freeShippingThreshold: 500000,
      standardFee: 30000,
      deliveryTime: "2 - 4 ngày làm việc trên toàn quốc",
      note: "Miễn phí vận chuyển cho đơn hàng từ 500.000₫ trở lên.",
    },
    returns: {
      days: 7,
      condition: "Hỗ trợ đổi trả miễn phí trong 7 ngày nếu lỗi nhà sản xuất hoặc không vừa kích cỡ (yêu cầu sản phẩm còn nguyên nhãn mác).",
    },
    payments: [
      "Quét mã QR Ngân Hàng tự động (VietQR - xác nhận tức thì)",
      "Thanh toán tiền mặt khi nhận hàng (COD)",
      "Ví điện tử MoMo / Thẻ thanh toán quốc tế",
    ],
    support: {
      hotline: "1900 6868",
      email: "support@luxecommerce.vn",
      hours: "8:00 - 22:00 tất cả các ngày trong tuần",
    },
  };
}

/**
 * Tạo System Instruction toàn diện cho Gemini AI
 */
export function buildStoreSystemPrompt(coupons: BotCoupon[], sampleProducts: BotProduct[]): string {
  const policies = getStorePolicies();

  const couponText = coupons.length > 0
    ? coupons.map(c => `- Mã: **${c.code}** (Giảm ${c.discount_percent}%, HSD: ${new Date(c.valid_until).toLocaleDateString("vi-VN")})`).join("\n")
    : "Hiện tại chưa có mã giảm giá mới, hãy gợi ý khách tham khảo các sản phẩm đang có giá ưu đãi.";

  const productText = sampleProducts.length > 0
    ? sampleProducts.map(p => `- [${p.name}](/product/${p.id}): Giá gốc ${p.price.toLocaleString("vi-VN")}₫ ${p.discount_percent > 0 ? `(Giảm ${p.discount_percent}% còn ${p.effective_price.toLocaleString("vi-VN")}₫)` : ""}, thương hiệu ${p.brand || "Luxe"}, còn ${p.stock_quantity} sản phẩm.`).join("\n")
    : "Tham khảo tại trang sản phẩm của cửa hàng.";

  return `
Bạn là "Luxe Assistant" - Trợ lý tư vấn bán hàng thông minh và tận tâm của cửa hàng thương mại điện tử với đa dạng các sản phẩm cao cấp **${policies.storeName}**.

### VAI TRÒ & PHONG CÁCH GIAO TIẾP:
1. **Xưng hô lịch sự, thân thiện:** Xưng "em" hoặc "Luxe Assistant", gọi khách là "anh/chị" hoặc "bạn".
2. **Ngôn ngữ:** Tiếng Việt chuẩn mực, ấm áp, lịch sự, thân thiện, gần gũi và có thể sử dụng các emoji trang nhã (✨, 🛍️, 👗, 🎁, 💎).
3. **Mục tiêu:** Tư vấn sản phẩm phù hợp, giải đáp chính sách đơn hàng/vận chuyển/đổi trả, hướng dẫn áp dụng mã giảm giá và kích thích chuyển đổi mua sắm.

### THÔNG TIN CỬA HÀNG:
- **Chính sách Vận chuyển:** ${policies.shipping.note}. Phí ship tiêu chuẩn ${policies.shipping.standardFee.toLocaleString("vi-VN")}₫. Thời gian giao hàng: ${policies.shipping.deliveryTime}.
- **Chính sách Đổi trả:** ${policies.returns.condition}.
- **Phương thức Thanh toán:** ${policies.payments.join(", ")}.
- **Liên hệ hỗ trợ:** Hotline ${policies.support.hotline} (${policies.support.hours}).

### MÃ GIẢM GIÁ ĐANG ÁP DỤNG:
${couponText}

### MỘT SỐ SẢN PHẨM NỔI BẬT ĐANG CÓ SẴN TRONG KHO:
${productText}

### NGUYÊN TẮC QUAN TRỌNG:
1. Khi khách hàng hỏi mua hoặc tìm kiếm sản phẩm:
   - Hãy gợi ý sản phẩm cụ thể, kèm giá tiền định dạng VNĐ và chèn link Markdown tới chi tiết sản phẩm theo đúng cú pháp: \`[Tên sản phẩm](/product/{id})\`.
   - **QUY TẮC LINK:** Viết liền mạch cú pháp \`[Tên](/product/{id})\`, KHÔNG chèn khoảng trắng giữa \`]\` và \`(\`, KHÔNG bọc dấu \`**\` ở ngoài link, và KHÔNG đặt emoji riêng lẻ ở trước link (Ví dụ ĐÚNG: \`- [Nồi chiên không dầu](/product/abc): Giá...\`, KHÔNG viết \`- 🍳 [Nồi chiên](/product/abc)\`).
   - Nếu khách hàng cần xem ảnh, mô tả ngắn gọn vẻ đẹp và phong cách sản phẩm.
2. Không bịa đặt các thông tin giá cả sai lệch với dữ liệu được cung cấp. Nếu không chắc chắn, hãy hướng dẫn khách xem thêm tại trang danh mục \`/products\`.
3. Câu trả lời nên ngắn gọn, súc tích, dễ đọc trên cả màn hình điện thoại (dùng gạch đầu dòng, in đậm tên và giá).
`.trim();
}
