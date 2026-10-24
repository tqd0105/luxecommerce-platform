import { NextResponse } from "next/server";
import {
  geminiClient,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
} from "@/lib/gemini/client";
import {
  searchProductsForBot,
  getActiveCouponsForBot,
  buildStoreSystemPrompt,
  BotProduct,
} from "@/lib/services/chatbot.service";

interface IncomingMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

interface ChatRequestBody {
  messages: IncomingMessage[];
}

// Hàm lọc các từ dừng thông dụng trong tiếng Việt để trích xuất từ khóa tìm kiếm sản phẩm
function extractSearchKeyword(text: string): string {
  const stopWords = [
    "tôi", "mình", "em", "anh", "chị", "bạn", "cần", "muốn", "tìm", "mua",
    "có", "không", "nào", "mẫu", "loại", "gì", "cho", "hỏi", "shop", "cửa hàng",
    "xem", "tư vấn", "với", "nhé", "ạ", "ơi", "giá", "bao nhiêu", "dưới", "khoảng",
  ];

  let cleaned = text.toLowerCase();
  for (const word of stopWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(regex, " ");
  }

  return cleaned.replace(/[^\w\s\u00C0-\u1EF9]/g, " ").trim();
}

export async function POST(req: Request) {
  try {
    const body: ChatRequestBody = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Danh sách tin nhắn không hợp lệ" },
        { status: 400 }
      );
    }

    // Kiểm tra cấu hình API Key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        reply: "Dạ em chào anh/chị! Hiện tại hệ thống trợ lý AI đang gặp vấn đề kết nối với hệ thống ChatBot. Anh/chị có thể liên hệ hotline 1900 6868 để được hỗ trợ tức thì ạ!",
        recommendedProducts: [],
      });
    }

    // Lấy tin nhắn mới nhất của người dùng
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const userQuery = lastUserMessage?.content || "";

    // 1. Trích xuất từ khóa & tìm kiếm sản phẩm phù hợp trong Supabase
    const keyword = extractSearchKeyword(userQuery);
    let matchedProducts: BotProduct[] = [];

    if (keyword.length >= 2) {
      matchedProducts = await searchProductsForBot({ keyword, limit: 4 });
    }

    // Nếu không khớp từ khóa cụ thể, lấy các sản phẩm nổi bật mới nhất làm gợi ý
    if (matchedProducts.length === 0) {
      matchedProducts = await searchProductsForBot({ limit: 4 });
    }

    // 2. Lấy mã giảm giá còn hạn
    const coupons = await getActiveCouponsForBot();

    // 3. Xây dựng System Instruction từ chatbot.service
    const systemInstruction = buildStoreSystemPrompt(coupons, matchedProducts);

    // 4. Chuẩn bị định dạng contents cho Gemini API (giới hạn tối đa 10 tin nhắn gần nhất để tối ưu tốc độ)
    const recentMessages = messages.slice(-10);
    const geminiContents = recentMessages.map((msg) => ({
      role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    }));

    // 5. Gọi Gemini API với cơ chế tự động chuyển đổi mô hình dự phòng
    let replyText = "";
    try {
      const response = await geminiClient.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: geminiContents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        },
      });
      replyText = response.text || "";
    } catch (primaryErr) {
      console.warn("⚠️ Chuyển sang mô hình Gemini dự phòng:", primaryErr);
      const fallbackResponse = await geminiClient.models.generateContent({
        model: FALLBACK_GEMINI_MODEL,
        contents: geminiContents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        },
      });
      replyText = fallbackResponse.text || "";
    }

    if (!replyText) {
      replyText = "Dạ em có thể giúp gì thêm cho anh/chị nữa không ạ?";
    }

    return NextResponse.json({
      reply: replyText,
      recommendedProducts: matchedProducts.slice(0, 3),
    });
  } catch (error: any) {
    console.error("Lỗi trong API /api/chat:", error);
    return NextResponse.json({
      reply: "Dạ xin lỗi anh/chị, đường truyền kết nối tới AI đang gián đoạn một chút. Anh/chị có thể tải lại trang hoặc nhắn lại để em tư vấn nhé!",
      recommendedProducts: [],
    });
  }
}

