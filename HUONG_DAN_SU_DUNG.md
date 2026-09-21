# Hướng Dẫn Sử Dụng Hệ Thống Quản Trị Thiết Bị DUE

Hệ thống Quản trị Thiết bị DUE được thiết kế với 3 nhóm quyền riêng biệt, mỗi nhóm quyền sẽ có các tính năng tương ứng với nghiệp vụ của mình.

---

## 1. Dành Cho Quản Trị Viên (Admin)
Quản trị viên có toàn quyền truy cập tất cả các tính năng trên hệ thống.

**Tính năng nổi bật:**
- **Quản lý Tài Khoản:** 
  - Tại tab "Quản Lý Tài Khoản", có thể thêm, sửa, xóa và phân quyền (Admin, Technician, Staff) cho các người dùng khác.
- **Cấu Hình Hệ Thống & Cảnh Báo:**
  - Cấu hình Telegram Bot Token và Chat ID để nhận tin nhắn tự động khi có sự cố mới, hoặc cập nhật tiến độ sửa chữa.
  - Cấu hình N8N Webhook (tuỳ chọn) để kết nối hệ thống tự động hoá bên ngoài.
- **Quản lý Thiết Bị:**
  - Thêm mới, chỉnh sửa thông tin, cập nhật trạng thái, xóa thiết bị.
  - Nhập hàng loạt thiết bị (Import Excel) hoặc xuất dữ liệu (Export).
  - Tạo và in mã QR dán lên thiết bị.
- **Quản lý Sự Cố & Bảo Trì:**
  - Lên lịch kiểm tra, bảo trì định kỳ cho thiết bị.
  - Quản lý linh kiện, vật tư thay thế.
  - Tạo mã QR báo cáo sự cố bằng Tiếng Việt (chỉ Admin mới có chức năng tạo mã QR này để in và dán).
- **Quét Camera Nhanh:** 
  - Sử dụng nút "Quét Camera" trên thanh điều hướng (Header) để tìm kiếm nhanh thông tin một thiết bị hoặc báo hỏng.
- **Điều Chuyển & Thu Hồi:**
  - Ghi nhận lịch sử luân chuyển thiết bị giữa các phòng ban, giảng đường.
- **Thống Kê Báo Cáo (Dashboard):**
  - Xem tổng quan số lượng thiết bị, biểu đồ tình trạng, và danh sách các sự cố chưa được xử lý.

---

## 2. Dành Cho Kỹ Thuật Viên (Technician)
Kỹ thuật viên tập trung vào việc bảo dưỡng, xử lý sự cố và theo dõi tình trạng thiết bị.

**Tính năng nổi bật:**
- **Quản lý Thiết Bị:**
  - Xem danh sách, tìm kiếm, lọc thiết bị.
  - Cập nhật tình trạng thiết bị (Ví dụ: Chuyển sang "Cần bảo trì", "Đang sửa chữa").
- **Kiểm Tra & Thay Vật Tư (Bảo Trì):**
  - **Tiếp nhận sự cố:** Xem danh sách sự cố do Cán bộ báo cáo, nhấn "Tiếp nhận" để bắt đầu xử lý (Hệ thống sẽ gửi thông báo đến Telegram).
  - **Khắc phục sự cố:** Điền ghi chú sửa chữa và nhấn "Đã khắc phục xong" khi hoàn thành (Hệ thống tiếp tục thông báo tiến độ).
  - Tạo biên bản kiểm tra thiết bị định kỳ.
  - Ghi nhận thay thế linh kiện (Chi phí, loại linh kiện, thời gian bảo hành).
- **Điều Chuyển & Thu Hồi:**
  - Lập biên bản điều chuyển thiết bị sang phòng khác hoặc thu hồi về kho bảo hành.
- **Thống Kê Báo Cáo:**
  - Theo dõi danh sách thiết bị và tần suất hỏng hóc để lên kế hoạch bảo trì.

*(Kỹ thuật viên sẽ không có tính năng Quản lý Tài khoản, Tạo mã QR báo hỏng, và Cấu hình Telegram Bot).*

---

## 3. Dành Cho Cán Bộ Khoa / Giảng Đường (Staff)
Tài khoản Cán bộ có giao diện tối giản, tập trung vào tính năng báo cáo sự cố nhanh chóng.

**Tính năng nổi bật:**
- **Báo Cáo Sự Cố Thiết Bị:**
  - Khi phát hiện thiết bị hỏng, cán bộ chọn thiết bị từ danh sách (hoặc quét mã QR được dán sẵn trên thiết bị bằng ứng dụng Camera của điện thoại).
  - Điền mô tả lỗi, chọn mức độ nghiêm trọng (Thấp, Cao, Khẩn Cấp) và gửi báo cáo.
  - Báo cáo sẽ lập tức được gửi đến Telegram của bộ phận Kỹ thuật.
- **Theo Dõi Tiến Độ Sự Cố:**
  - Cán bộ có thể xem lại danh sách các sự cố **do chính mình đã báo cáo**.
  - Theo dõi trạng thái: Mới báo cáo -> Kỹ thuật đang tiếp nhận -> Đã khắc phục xong.
- **Cài Đặt PWA (Tuỳ chọn):**
  - Cán bộ có thể cài đặt hệ thống như một ứng dụng trên điện thoại (Thêm vào Màn hình chính) và cấp quyền nhận thông báo Push Notification để biết khi nào thiết bị được sửa xong.

---

## Hướng dẫn quét QR Báo Hỏng Nhanh (Dành cho mọi người dùng)
1. Sử dụng ứng dụng Camera mặc định (trên iOS/Android) hoặc Zalo để quét mã QR vuông được dán trên thiết bị.
2. Điện thoại sẽ mở ra một đường link dẫn đến Hệ thống Quản trị.
3. Nếu đã đăng nhập, hệ thống tự động điền sẵn thông tin thiết bị (Mã máy, Phòng, Khoa). Người dùng chỉ cần nhập mô tả lỗi và bấm Gửi.

*(Ghi chú: Quản trị viên sử dụng tính năng in mã QR báo sự cố để dán lên thiết bị trước).*
