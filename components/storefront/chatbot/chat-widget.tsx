"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  Loader2,
  Bot,
  User,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BotProduct } from "@/lib/services/chatbot.service";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: BotProduct[];
  timestamp: string;
}

const QUICK_PROMPTS = [
  {
    label: "Mã giảm giá",
    desc: "Ưu đãi & voucher hôm nay",
    icon: "🎁",
    prompt: "Hôm nay shop có những mã giảm giá nào vậy ạ?",
  },
  {
    label: "Sản phẩm mới",
    desc: "BST thời trang & công nghệ",
    icon: "📱",
    prompt: "Danh sách sản phẩm mới nhất của shop",
  },
  {
    label: "Đồ công nghệ",
    desc: "Loa, màn hình, tai nghe",
    icon: "⚡",
    prompt: "Danh sách sản phẩm đồ công nghệ mới nhất của shop",
  },
  {
    label: "Chính sách đổi trả",
    desc: "7 ngày đổi trả, freeship 500k",
    icon: "🚚",
    prompt: "Chính sách đổi trả và vận chuyển của shop thế nào?",
  },
];

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome-message",
  role: "assistant",
  content:
    "Dạ em chào anh/chị! Em là **Luxe Assistant** ✨.\nEm có thể giúp anh/chị tìm kiếm sản phẩm cao cấp, kiểm tra mã giảm giá hoặc giải đáp chính sách giao hàng và đổi trả hôm nay ạ!",
  timestamp: "Vừa xong",
};

/**
 * Hàm định dạng tin nhắn dạng Markdown tinh tế (in đậm, đường dẫn sản phẩm, gạch đầu dòng)
 */
function FormattedMessageContent({ content }: { content: string }) {
  const lines = content.split("\n");

  const renderFormattedLine = (rawLine: string) => {
    // 1. Chuẩn hóa link có khoảng trắng giữa ] và (: [Tên] (/url) -> [Tên](/url)
    let line = rawLine.replace(/\[([^\]]+)\]\s+\(([^)]+)\)/g, "[$1]($2)");

    // 2. Chuẩn hóa link bị bọc trong dấu **: **[Tên](url)** -> [Tên](url)
    line = line.replace(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g, "[$1]($2)");

    const parts = [];
    let currentIndex = 0;
    // Regex thông minh: Hấp thụ luôn icon/emoji ngay trước link (nếu có) để gắn liền vào trong thẻ chip,
    // ngăn chặn triệt để tình trạng icon ở dòng trên, tên sản phẩm rớt xuống dòng dưới!
    const combinedRegex = /((?:[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*)*)\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/gu;
    let match;

    while ((match = combinedRegex.exec(line)) !== null) {
      if (match.index > currentIndex) {
        parts.push(line.substring(currentIndex, match.index));
      }

      if (match[2] && match[3]) {
        // Link sản phẩm dạng [text](url)
        const leadingEmoji = (match[1] || "").trim();
        const text = match[2];
        let href = match[3].trim();

        // Tự động chuẩn hóa đường dẫn về đúng route Next.js: /product/[id]
        href = href.replace(/^\/products\/(product-)?/, "/product/");
        if (href.startsWith("product-")) {
          href = `/product/${href.replace(/^product-/, "")}`;
        }

        parts.push(
          <Link
            key={`link-${match.index}`}
            href={href}
            className="inline-flex items-center gap-1.5 max-w-full my-0.5 px-3 py-1 rounded-2xl bg-secondary/80 dark:bg-secondary/50 hover:bg-gradient-to-r hover:from-pink-500/10 hover:to-amber-500/10 text-foreground dark:text-foreground border border-border/70 hover:border-pink-500/40 font-bold transition-all duration-200 hover:shadow-xs group cursor-pointer align-middle text-xs sm:text-sm"
          >
            {leadingEmoji && (
              <span className="text-sm shrink-0 leading-none">{leadingEmoji}</span>
            )}
            <span className="truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
              {text}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-all ml-0.5" />
          </Link>
        );
      } else if (match[4]) {
        // In đậm **text**
        parts.push(
          <strong key={`bold-${match.index}`} className="font-bold text-foreground">
            {match[4]}
          </strong>
        );
      }

      currentIndex = match.index + match[0].length;
    }

    if (currentIndex < line.length) {
      parts.push(line.substring(currentIndex));
    }

    return parts;
  };

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const lineContent = isBullet ? trimmed.substring(2) : line;

        return (
          <div key={idx} className={isBullet ? "flex items-start gap-2.5 pl-1" : ""}>
            {isBullet && (
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 mt-2 shrink-0 shadow-xs" />
            )}
            <div className="flex-1 min-w-0">{renderFormattedLine(lineContent)}</div>
          </div>
        );
      })}
    </div>
  );
}

const CHAT_STORAGE_KEY = "luxe_ai_chat_history_v1";
const CHAT_STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000; // Tự động làm mới sau 24 giờ

interface StoredChatData {
  messages: ChatMessage[];
  savedAt: number;
}

function getChatTimestamp() {
  const now = new Date();
  const time = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${time} - ${date}`;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // 1. Phục hồi lịch sử chat từ localStorage khi người dùng vào trang / tải lại trang (F5)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed: StoredChatData = JSON.parse(saved);
        const isExpired = Date.now() - parsed.savedAt > CHAT_STORAGE_EXPIRY_MS;
        if (!isExpired && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        } else {
          localStorage.removeItem(CHAT_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn("Không thể khôi phục lịch sử chat:", e);
    }
  }, []);

  // 2. Tự động lưu lịch sử chat vào localStorage (giới hạn tối đa 30 tin gần nhất)
  useEffect(() => {
    if (messages.length > 1) {
      try {
        const dataToSave: StoredChatData = {
          messages: messages.slice(-30),
          savedAt: Date.now(),
        };
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (e) {
        console.warn("Không thể lưu lịch sử chat:", e);
      }
    }
  }, [messages]);

  // 3. Khi mở hộp thoại chat: Lập tức hiển thị ở đáy tin nhắn (instant), không cuộn từ trên xuống
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);

      const jumpToBottom = () => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }
      };

      // Nhảy ngay lập tức và đồng bộ sau khi khung chat mount hoàn tất
      jumpToBottom();
      const frameId = requestAnimationFrame(jumpToBottom);
      const timer = setTimeout(jumpToBottom, 60);

      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 200);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timer);
        clearTimeout(focusTimer);
      };
    }
  }, [isOpen]);

  // 4. Khi ĐANG MỞ CHAT và có TIN NHẮN MỚI hoặc AI đang gõ phản hồi: Cuộn mượt mà (smooth)
  useEffect(() => {
    if (!isOpen) return;

    if (messages.length > prevMessagesLengthRef.current || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isLoading, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: getChatTimestamp(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const payload = {
        messages: newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "Dạ em có thể giúp gì thêm cho anh/chị nữa không ạ?",
        products: data.recommendedProducts || [],
        timestamp: getChatTimestamp(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn chat:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "Dạ xin lỗi anh/chị, đường truyền kết nối tới AI đang gián đoạn một chút. Anh/chị có thể tải lại trang hoặc nhắn lại để em tư vấn nhé!",
        timestamp: getChatTimestamp(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    // Xóa bộ nhớ đệm cục bộ khi khách chủ động làm mới cuộc hội thoại
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (e) {
      console.warn("Không thể xóa bộ nhớ chat:", e);
    }

    setMessages([
      {
        ...INITIAL_MESSAGE,
        id: `welcome-${Date.now()}`,
        timestamp: getChatTimestamp(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Nút bấm nổi Floating Action Button (FAB) phong cách Futuristic */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Bong bóng chào mừng kính mờ ảo diệu */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="hidden md:flex items-center gap-2.5 bg-background/80 dark:bg-card/75 backdrop-blur-2xl border border-white/30 dark:border-white/10 text-foreground px-4 py-2.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-all duration-300 hover:scale-105 hover:border-primary/40 group text-sm font-semibold"
          >
            <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-amber-400 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            </div>
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
              Trợ lý Luxe AI 
            </span>
          </button>
        )}

        {/* Nút tròn chính với quầng sáng quang phổ (Ambient Glow Orb) */}
        <div className="relative group">
          {/* Lớp hào quang ambient glow phía sau */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-amber-400 opacity-60 blur-md group-hover:opacity-90 group-hover:blur-lg transition-all duration-500 -z-10 animate-pulse" />

          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Đóng hộp thoại chat" : "Mở trợ lý ảo Luxe AI"}
            className={`relative flex items-center justify-center h-14 w-14 rounded-full text-white shadow-2xl transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-pink-500/20 cursor-pointer ${
              isOpen
                ? "bg-card/90 dark:bg-card/90 text-foreground border border-white/20 rotate-90 shadow-lg"
                : "bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-amber-400 hover:from-fuchsia-500 hover:to-amber-300 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
            }`}
          >
            {isOpen ? (
              <X className="h-6 w-6 text-foreground transition-transform duration-300" />
            ) : (
              <>
                <MessageCircle className="h-6 w-6 drop-shadow-sm" />
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-background" />
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cửa sổ Chatbot Popup: Kính mờ siêu thực, bo cong 32px, bóng sâu */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Khung chat hỗ trợ trực tuyến"
          className="fixed bottom-24 right-4 sm:right-6 z-[60] w-[calc(100vw-32px)] sm:w-[420px] h-[600px] max-h-[calc(100vh-120px)] bg-background/90 dark:bg-card/90 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[32px] shadow-[0_25px_70px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 animate__animated animate__bounceIn"
        >
          {/* Vầng sáng tương lai ẩn trong nền (Background Glow Mesh) */}
          <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 bg-fuchsia-500/15 dark:bg-fuchsia-500/20 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 -left-20 w-48 h-48 bg-amber-400/15 dark:bg-amber-400/15 rounded-full blur-3xl" />

          {/* Header kính mờ với viền ánh kim */}
          <div className="relative bg-card/60 dark:bg-card/40 backdrop-blur-xl p-4 flex items-center justify-between border-b border-border/40 shadow-xs z-10">
            <div className="flex items-center gap-3">
              <div className="relative group">
                {/* Vầng hào quang quang phổ dịu nhẹ phía sau */}
                <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-300 opacity-35 blur-xs -z-10 group-hover:opacity-60 transition-opacity duration-300" />

                {/* Khối nền Trắng ngọc trai đa lớp tương phản cao */}
                <div className="h-12 w-12 rounded-full bg-white/95 dark:bg-card/90 backdrop-blur-xl flex items-center justify-center border border-purple-200/80 dark:border-purple-400/30 shadow-[0_4px_20px_rgba(124,58,237,0.18)] dark:shadow-[0_4px_20px_rgba(124,58,237,0.35)] p-2 transition-all duration-300 group-hover:scale-105">
                  <Image
                    unoptimized
                    src="/icons/aichat.png"
                    alt="Luxe Assistant"
                    width={100}
                    height={100}
                    className="h-12 w-12 object-contain drop-shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
                  />
                </div>
                {/* Radar pulse online status */}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-background" />
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base tracking-tight bg-gradient-to-r from-fuchsia-600 via-pink-500 to-amber-500 dark:from-fuchsia-400 dark:via-pink-400 dark:to-amber-300 bg-clip-text text-transparent drop-shadow-xs">
                    Luxe Assistant
                  </h3>
                  <Badge
                    variant="secondary"
                    className="bg-gradient-to-r from-fuchsia-500/15 via-pink-500/15 to-amber-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-xs shadow-2xs"
                  >
                    Latest 4.0
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 mt-0.5">
                  {/* <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" /> */}
                  Sẵn sàng tư vấn mua sắm 24/7
                </p>
              </div>
            </div>

            {/* Nút hành động trên Header */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetChat}
                title="Làm mới cuộc trò chuyện"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                title="Thu nhỏ"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full transition-colors cursor-pointer"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Vùng tin nhắn chat cuộn mượt mà */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10"
          >
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center  mt-1.5 text-pink-600 dark:text-pink-400 shadow-xs">
                      <Image
                        unoptimized
                        src="/icons/chatbot.png"
                        alt="chatbot"
                        width={18}
                        height={18}
                        className="h-8 w-8 object-contain  "
                      />
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-2.5`}>
                    <div
                      className={`p-4 transition-all duration-300 ${
                        isUser
                          ? "bg-gradient-to-r from-fuchsia-600 via-pink-500 to-amber-500 text-white rounded-[20px] rounded-br-[1px] shadow-lg shadow-pink-300"
                          : "bg-card/75 dark:bg-secondary/40 text-card-foreground border border-white/40 dark:border-white/5 backdrop-blur-xl rounded-[24px] rounded-bl-[4px] shadow-md"
                      }`}
                    >
                      <FormattedMessageContent content={message.content} />

                      {/* Lưới 2x2 thẻ gợi ý tinh tế tích hợp ngay trong tin nhắn chào mừng (thay thế thanh trượt ngang) */}
                      {message.id.startsWith("welcome") && (
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-1">
                          {QUICK_PROMPTS.map((item, index) => (
                            <button
                              key={index}
                              onClick={() => handleSendMessage(item.prompt)}
                              disabled={isLoading}
                              className="group/card flex flex-col items-start gap-1 p-2.5 rounded-[18px] bg-background/80 dark:bg-secondary/40 hover:bg-gradient-to-br hover:from-pink-500/5 hover:to-amber-500/5 dark:hover:bg-secondary/70 border border-border/60 hover:border-pink-500/40 text-left transition-all duration-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-base">{item.icon}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover/card:text-pink-600 dark:group-hover/card:text-pink-400 group-hover/card:translate-x-0.5 transition-all" />
                              </div>
                              <div className="font-bold text-xs text-foreground group-hover/card:text-pink-600 dark:group-hover/card:text-pink-400 transition-colors line-clamp-1 mt-0.5">
                                {item.label}
                              </div>
                              <div className="text-[10px] text-muted-foreground line-clamp-1">
                                {item.desc}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      <div
                        className={`text-[10px] mt-1.5 text-right font-medium ${
                          isUser ? "text-white/80" : "text-muted-foreground/70"
                        }`}
                      >
                        {message.timestamp}
                      </div>
                    </div>

                    {/* Thẻ sản phẩm gợi ý dạng Micro-Card Kính mờ */}
                    {!isUser && message.products && message.products.length > 0 && (
                      <div className="pt-1.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-gray-500" />
                          <span>Gợi ý độc quyền:</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {message.products.map((product) => (
                            <Link
                              key={product.id}
                              href={`/product/${product.id}`}
                              className="group flex items-center gap-3 p-2.5 bg-card/60 dark:bg-background/40 border border-border/50 hover:border-pink-500/40 rounded-[20px] backdrop-blur-xl shadow-xs hover:shadow-xl hover:shadow-pink-500/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                            >
                              <div className="relative h-14 w-14 rounded-[14px] overflow-hidden bg-secondary/30 shrink-0 border border-border/40 group-hover:border-pink-500/30 transition-colors">
                                {product.image_url ? (
                                  <Image
                                    src={product.image_url}
                                    alt={product.name}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                    sizes="56px"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                    <ShoppingBag className="h-5 w-5" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                  {product.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-extrabold text-pink-600 dark:text-pink-400">
                                    {product.effective_price.toLocaleString("vi-VN")}₫
                                  </span>
                                  {product.discount_percent > 0 && (
                                    <span className="text-[10px] text-muted-foreground line-through">
                                      {product.price.toLocaleString("vi-VN")}₫
                                    </span>
                                  )}
                                  {product.discount_percent > 0 && (
                                    <span className="text-[10px] font-extrabold text-rose-500 bg-rose-500/10 px-1.5 py-0.2 rounded-full border border-rose-500/20">
                                      -{product.discount_percent}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="h-8 w-8 mt-1.5 text-xs font-bold ">
                      <Image unoptimized src="/icons/user1.png" alt="user" width={18} height={18} className="h-8 w-8 object-contain  " />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Hiệu ứng gõ phím AI Breathing Dots */}
            {isLoading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="h-8 w-8 flex items-center justify-center text-pink-600 dark:text-pink-400 ">
                  <Image unoptimized  src="/icons/chatbot.png" alt="user" width={18} height={18} className="h-8 w-8 object-contain  " />
                </div>
                <div className="bg-card/75 dark:bg-secondary/40 border border-white/30 dark:border-white/5 backdrop-blur-xl px-4 py-3 rounded-[20px] rounded-bl-[4px] flex items-center gap-1.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 animate-ping [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 animate-ping [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 animate-ping" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Khung nhập liệu Capsule Bar nổi bật */}
          <div className="p-3 bg-card/60 dark:bg-card/30 backdrop-blur-xl border-t border-border/40 relative z-10">
            <div className="flex items-center gap-2 bg-secondary/50 dark:bg-muted/30 border-2 border-border/60 focus-within:border-pink-500 focus-within:ring-4 focus-within:ring-pink-500/20 rounded-[24px] p-1.5 pl-4 transition-all shadow-md">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi Luxe Assistant bất kỳ điều gì..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-all disabled:opacity-50"
              />
              <Button
                size="icon"
                disabled={!input.trim() || isLoading}
                onClick={() => handleSendMessage()}
                className="h-9 w-9 rounded-full shrink-0 bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-amber-400 hover:from-fuchsia-500 hover:to-amber-300 text-white hover:opacity-95 hover:scale-105 active:scale-95 transition-all shadow-md shadow-pink-500/30 hover:shadow-pink-500/50 disabled:opacity-40 cursor-pointer"
                aria-label="Gửi tin nhắn"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Image
                    src="/icons/send.png"
                    alt="Gửi tin nhắn"
                    width={18}
                    height={18}
                    className="h-4 w-4 object-contain brightness-0 invert"
                  />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
