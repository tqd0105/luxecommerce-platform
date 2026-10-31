
---

### 3. File `docs/business-rules.md`

```markdown
# Business Rules

Tổng hợp các quy tắc nghiệp vụ (Business Logic) hiện tại được tìm thấy trong codebase.

## Quyền hạn (Authorization)
- **Guest (Chưa đăng nhập):** Chỉ được xem Trang chủ, Danh sách danh mục, Sản phẩm, Banner. Không thể thực hiện chức năng mua hàng vì `cart_items` trong database yêu cầu phải có `auth.uid()`.
- **User (Đã đăng nhập):** Được phép thêm sản phẩm vào giỏ hàng, tiến hành thanh toán (Checkout), xem lịch sử đơn hàng của bản thân và chỉnh sửa sổ địa chỉ.
- **Admin:** Là tài khoản có `role_id` trỏ đến `admin`. Bắt buộc phải có quyền này mới truy cập được các route trong `/dashboard`. Có thể tạo, sửa, xóa toàn bộ sản phẩm, danh mục và quản lý đơn hàng.

## Quy tắc Thanh toán (Checkout) & Giỏ hàng (Cart)
- Một sản phẩm trong `cart_items` bắt buộc phải tham chiếu đến 1 `product_id` hợp lệ. Nếu sản phẩm bị xóa, `ON DELETE CASCADE` sẽ tự động xóa sản phẩm khỏi giỏ hàng.
- Khi người dùng đặt hàng, hệ thống bắt buộc tạo một bản ghi `orders` trạng thái `pending`, sau đó sao chép giá trị (price) hiện tại của sản phẩm vào `order_items` để đảm bảo không bị ảnh hưởng nếu admin đổi giá sản phẩm sau này.

## Đơn hàng (Orders) & Quản lý Kho hàng (Inventory)
- Trạng thái mặc định khi tạo là `pending`.
- Admin và Staff có quyền cập nhật trạng thái đơn hàng.
- User có thể HỦY đơn hàng của chính mình CHỈ KHI đơn đang ở trạng thái `pending`.
- Giỏ hàng (`cart_items`) sẽ bị xóa sạch ngay sau khi thanh toán thành công.
- **Trừ tồn kho khi Đặt hàng (Deduction):** Khi các mặt hàng trong đơn được thêm vào `order_items`, Database Trigger (`handle_order_item_stock_deduction`) tự động kiểm tra số lượng tồn kho (`stock_quantity`) của sản phẩm hoặc biến thể tương ứng (`product_variants`). Nếu số lượng yêu cầu vượt quá tồn kho hiện có, đơn hàng sẽ bị chặn lại (ROLLBACK) và báo lỗi hết hàng. Nếu đủ hàng, `stock_quantity` sẽ tự động bị trừ đi tương ứng.
- **Hoàn trả tồn kho khi Hủy đơn (Restoration):** Bất kể đơn hàng bị hủy từ phía Người dùng, Quản trị viên (Admin/Staff), hoặc hệ thống thanh toán tự động, khi trạng thái đơn hàng chuyển sang `cancelled`, Database Trigger (`handle_order_cancellation_stock_restore`) sẽ tự động hoàn trả lại đúng số lượng các mặt hàng trong đơn vào kho hàng. Nếu đơn hàng được phục hồi trạng thái từ `cancelled`, kho hàng sẽ tự động được trừ lại.

## Mã giảm giá (Coupons)
- Chỉ áp dụng được khi `is_active = true` và `valid_from` <= hiện tại <= `valid_until`.
- Tổng số lần đã dùng (`used_count`) phải nhỏ hơn `usage_limit`.
- Việc kiểm tra tính hợp lệ phải chạy ở phía Server (`checkout.service.ts`) trước khi tạo đơn hàng để tránh giả mạo giá trị từ Client.
- Mỗi đơn hàng chỉ được sử dụng tối đa 1 mã giảm giá.
- Khi đặt hàng thành công, `used_count` tự động tăng lên 1 (qua atomic RPC hoặc function update an toàn).

## Sổ địa chỉ (Addresses)
- Mỗi User có thể có nhiều địa chỉ giao hàng.
- Khi User tick chọn "Đặt làm mặc định" cho 1 địa chỉ, TẤT CẢ các địa chỉ khác của User đó sẽ bị set `is_default = false`.

## Yêu thích (Wishlist)
- User chỉ được quản lý danh sách yêu thích của riêng mình (RLS policy).
- Khi xem chi tiết sản phẩm, hệ thống sẽ báo đỏ biểu tượng trái tim nếu sản phẩm đã nằm trong Wishlist.
- Cho phép toggle (thêm/xóa) sản phẩm khỏi Wishlist cực nhanh mà không cần load lại trang.

## Quy tắc Sản phẩm & Danh mục
- Sản phẩm luôn phải thuộc về ít nhất 1 danh mục (`category_id` là bắt buộc).
- Hình ảnh sản phẩm và Banner bắt buộc phải được đẩy lên hệ thống Supabase Storage (Bucket: `product_images` cho sản phẩm, và `public_assets` cho banner) để sinh ra public URL lưu vào database.
- Không cho phép xóa cứng danh mục nếu vẫn còn sản phẩm tham chiếu (`ON DELETE RESTRICT` hoặc xử lý ứng dụng), tránh mồ côi dữ liệu.

## Quy tắc Banner (Promo Banners)
- Ở trang chủ của khách hàng (`Storefront`), hệ thống sẽ chỉ fetch những Banner quảng cáo thỏa mãn điều kiện `is_active = true` và sắp xếp theo thứ tự hiển thị `order_index`.

## Quy tắc Mail Hàng Loạt
- Trang `/dashboard/notifications` được dùng như một trình soạn email hàng loạt cho admin.
- Khi chọn gửi cho toàn bộ người dùng, hệ thống lấy danh sách email từ bảng `profiles` và gửi lần lượt qua API server.
- Khi chọn gửi thử cho một email cụ thể, hệ thống chỉ gửi đúng một địa chỉ để kiểm tra nội dung trước khi phát broadcast.
- Việc gửi mail phải đi qua server API để giữ `GMAIL_USER` và `GMAIL_APP_PASSWORD` ở phía môi trường, không lộ sang client.

## Quy tắc Đánh giá (Reviews)
- Mọi người đều có thể đọc đánh giá (`Anyone can view reviews`).
- Nhưng chỉ có người dùng đăng nhập mới được thêm đánh giá (`auth.uid() = user_id`) và Rating bắt buộc giới hạn `1 <= rating <= 5` (Database Check Constraint).

## Quy tắc Thanh toán Chuyển khoản tự động (Auto-Payment Verification)
- **Mã thanh toán & Thời hạn:** Khi chọn phương thức thanh toán chuyển khoản ngân hàng (`bank_transfer`), hệ thống tự động tạo mã thanh toán duy nhất theo cấu trúc `LX-[A-Z0-9]{6}` và thiết lập thời hạn hiệu lực là 10 phút (`expires_at`).
- **Idempotency (Không xử lý lặp):** Mỗi giao dịch ngân hàng vào từ email (Gmail API) chỉ được ghi nhận tối đa một lần trong bảng `bank_transactions` thông qua ràng buộc `UNIQUE(bank_tran_id)`. Nếu mã giao dịch đã tồn tại, hệ thống tự động bỏ qua để tránh cộng dồn tiền hoặc kích hoạt nhầm.
- **Quy tắc Đối chiếu (Matching Logic):**
  1. Nếu nội dung chuyển khoản chứa chính xác mã `LX-XXXXXX` và số tiền `amount >= expected_amount` của đơn đang `PENDING` chưa hết hạn, thanh toán chuyển sang trạng thái `MATCHED`, đơn hàng chuyển sang `PROCESSING` và tự động gửi email xác nhận.
  2. Nếu tìm thấy mã đơn nhưng số tiền `amount < expected_amount`, giao dịch được ghi nhận ở trạng thái `UNMATCHED` và yêu cầu admin kiểm tra thủ công.
- **Hủy thanh toán:** Người dùng có quyền bấm "Hủy thanh toán" tại màn hình VietQR. Khi đó đơn hàng sẽ được hủy (hoặc đánh dấu hủy) và toàn bộ sản phẩm sẽ được khôi phục về giỏ hàng (`cart_items`) để người dùng có thể điều chỉnh lại.

## Quy tắc Tính phí vận chuyển & Chống Bypass Vị trí (Shipping & Anti-Bypass)
- **Xác thực vị trí thủ công (Manual Verification Trigger):** Nhằm tối ưu trải nghiệm và tránh gọi API định vị liên tục khi đang gõ, khách hàng nhập Tỉnh/Thành phố và Địa chỉ cụ thể rồi nhấn nút "Xác nhận & Tìm vị trí" (hoặc nhấn phím Enter).
- **Hủy xác thực khi sửa địa chỉ:** Bất kỳ thay đổi nào trên trường Tỉnh/Thành phố hoặc Địa chỉ cụ thể sẽ lập tức thu hồi trạng thái xác thực và xóa tọa độ cũ để buộc khách xác thực lại vị trí mới, tránh gian lận phí ship.
- **Khóa nút Đặt hàng (Strict Place Order Guard):** Nút "Đặt hàng ngay" bị vô hiệu hóa hoàn toàn khi: (1) Địa chỉ chưa được xác thực tọa độ GPS chuẩn; (2) Giỏ hàng có sản phẩm vượt quá tồn kho; (3) Thông tin người nhận chưa hợp lệ.
- **Chống Bypass từ Server (Server-Side Recalculation):** Trong `checkout.service.ts`, hệ thống không tin tưởng `shippingFee` thô gửi từ client. Backend bắt buộc kiểm tra tọa độ GPS trong phạm vi lãnh thổ Việt Nam và tự động tính toán lại `shippingFee` cùng `distance_km` trước khi lưu vào bảng `orders`.
- **Ghim vị trí trực quan trên Bản đồ tương tác (Interactive Map Pinning):** Khi địa chỉ gõ tay không tìm thấy (ví dụ: số nhà trong hẻm/ngách, tên đường mới mở, hoặc địa chỉ ảo), người dùng có thể mở Bản đồ tương tác ("Chọn trên bản đồ") sử dụng Leaflet & OpenStreetMap. Người dùng có thể kéo thả ghim hoặc bấm vào vị trí chính xác của nhà mình. Hệ thống tự động kích hoạt Server Reverse Geocoding (`/api/shipping/reverse`) để đọc tên đường/quận/huyện và tính lại khoảng cách & cước phí vận chuyển chính xác 100%.
- **Đồng bộ Sổ địa chỉ (Address Book Geocoding):** Tại `/account/addresses`, người dùng cũng có thể chọn và ghim vị trí trên bản đồ tương tác khi thêm/sửa địa chỉ. Tọa độ GPS (`latitude`, `longitude`) được lưu trực tiếp vào cơ sở dữ liệu để khi vào thanh toán, hệ thống nhận diện tức thì mà không cần tra cứu lại.
- **Goong Maps Engine & Từ điển sáp nhập hành chính Việt Nam (Dual-Engine Geocoding):** 
  - Hệ thống tích hợp Goong Maps làm engine ưu tiên số một cho Geocoding, Reverse Geocoding và Places Autocomplete khi `GOONG_API_KEY` được cung cấp. Goong chuyên biệt cho thị trường Việt Nam, cập nhật tức thì dữ liệu phân cấp hành chính mới (như TP. Thủ Đức, các phường/xã sáp nhập) và nhận diện chính xác từng số nhà, ngõ ngách mà không yêu cầu thẻ tín dụng quốc tế.
  - Khi chưa cấu hình Goong Key, hệ thống tự động fallback về OpenStreetMap / Nominatim kết hợp cùng Bảng từ điển ánh xạ sáp nhập (`VIETNAM_MERGER_ALIASES`) nhằm loại bỏ tình trạng từ chối nhầm các địa chỉ hợp lệ ở các địa phương vừa sáp nhập.

## Quy tắc Theo dõi hành trình Vận chuyển (Order Tracking & Milestones)
- **Cơ chế hoạt động:** Hệ thống mô phỏng và cập nhật theo từng chặng / mốc Hub bưu cục trung chuyển (Milestone-based Tracking) tương tự GHN, Viettel Post, Shopee Xpress:
  - Cự ly ngắn / nội tỉnh (< 25km): Tạo tự động 4 mốc (Kho xuất hàng $\rightarrow$ Hub phân loại nội thành $\rightarrow$ Shipper đang giao hàng $\rightarrow$ Giao hàng thành công).
  - Cự ly dài / liên tỉnh (> 25km): Tạo tự động 6 mốc (Kho xuất hàng $\rightarrow$ Trung tâm khai thác liên tỉnh $\rightarrow$ Đang trung chuyển liên tỉnh $\rightarrow$ Bưu cục phát điểm đến $\rightarrow$ Shipper đang phát $\rightarrow$ Giao hàng thành công).
- **Đồng bộ tự động trạng thái đơn hàng (Order Status Auto-Sync):**
  - Khi Admin click chuyển mốc sang `out_for_delivery` (Đang giao hàng), trạng thái đơn hàng trong bảng `orders` tự động đồng bộ sang `shipping`.
  - Khi Admin click hoàn tất mốc cuối cùng `delivered` (Giao thành công), trạng thái đơn hàng trong bảng `orders` tự động đồng bộ sang `delivered`.
- **Cập nhật thời gian thực (Supabase Realtime):** Toàn bộ giao diện theo dõi của khách hàng (Modal cá nhân hoặc Trang tra cứu công khai) tự động cập nhật vị trí xe trên bản đồ và dòng sự kiện (Timeline) ngay trong khoảnh khắc Admin bấm chuyển mốc mà không cần reload trang.
- **Quyền tra cứu công khai (Public Tracking Accessibility):** Khách hàng vãng lai hoặc người nhận nhận được link/QR code qua SMS/Email có thể tra cứu trực tiếp hành trình đơn hàng tại `/tracking/[orderId]` mà không cần đăng nhập tài khoản.

## Quy tắc Tích Xu (Loyalty Coins) & Hạng Thành Viên (Membership Tiers)
- **Tách bạch Điểm thăng hạng trọn đời (`lifetime_coins`) & Xu khả dụng (`coins_balance`):**
  - `lifetime_coins`: Tích lũy cộng dồn trọn đời, chỉ tăng không giảm. Dùng độc quyền để tính toán và tự động thăng hạng VIP. Việc tiêu xu mua hàng không làm giảm điểm thăng hạng và **không bao giờ bị tụt hạng thành viên**.
  - `coins_balance`: Số dư xu thực tế để tiêu dùng. 1 Xu = 1 VNĐ.
- **Tiêu chuẩn Hạng thành viên & Quyền lợi:**
  - 🥉 **Đồng (Bronze)** (0 - 4.999 điểm): Hoàn 1% xu mỗi đơn, 200 xu/ngày điểm danh, phí ship tiêu chuẩn.
  - 🥈 **Bạc (Silver)** (5.000 - 19.999 điểm): Hoàn 1.5% xu mỗi đơn, 300 xu/ngày điểm danh, voucher sinh nhật 5%.
  - 🥇 **Vàng (Gold)** (20.000 - 49.999 điểm): Hoàn 2% xu mỗi đơn, 400 xu/ngày điểm danh, **giảm 50% phí vận chuyển**.
  - 💎 **Kim Cương (Diamond)** (>= 50.000 điểm): Hoàn 3% xu mỗi đơn, 500 xu/ngày điểm danh, **Freeship 100% toàn quốc mọi đơn**.
- **Quy tắc Sử dụng Xu tại Thanh toán (Checkout):**
  - Tối đa 50% giá trị tiền hàng được thanh toán bằng Xu (tránh đơn 0 đồng gian lận).
  - Khấu trừ Xu và giảm phí ship theo hạng được tính toán và xác thực nghiêm ngặt ở Server-side (`checkout.service.ts`).
  - Giao dịch tiêu xu được ghi nhận vào `coin_transactions` với type `'order_spent'`.
- **Tự động thưởng Xu khi Giao hàng (`delivered`):**
  - Khi đơn hàng chuyển trạng thái sang `delivered` (thông qua cập nhật mốc vận chuyển cuối cùng), Trigger PostgreSQL tự động tính tỷ lệ hoàn xu theo hạng thành viên của khách hàng tại thời điểm giao hàng, cộng vào cả `coins_balance` và `lifetime_coins`, và ghi nhận log `order_reward`.
  - Nếu đơn hàng bị hủy (`cancelled`) mà khách hàng đã dùng xu, toàn bộ số xu tiêu sẽ được hoàn trả tự động với log `order_refund`.
- **Điểm danh Hằng ngày (Daily Check-in):**
  - Mỗi khách hàng được điểm danh 1 lần duy nhất trong ngày lịch (`last_checkin_date = CURRENT_DATE`), kiểm soát bởi RPC `claim_daily_checkin()`.
  - Nhận ngay xu thưởng theo hạng hiện tại vào ví.
