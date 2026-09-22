# HƯỚNG DẪN CHẠY CỤC BỘ (LOCAL SETUP) - HỆ THỐNG QUẢN TRỊ THIẾT BỊ DUE & n8n

Hướng dẫn này giúp bạn chạy đồng thời **Hệ thống Quản trị Thiết bị DUE** và **n8n Workflow** (tích hợp Telegram Bot **@hotrogiangday_bot**) trên máy tính cá nhân.

---

### Cách 1: Chạy n8n qua NPM toàn cục (`npm install n8n -g`)

Nếu máy bạn đã cài sẵn Node.js và muốn chạy n8n trực tiếp trên terminal mà không cần Docker:

1. **Cài đặt n8n toàn cục:**
   ```bash
   npm install n8n -g
   ```
2. **Khởi động n8n:**
   ```bash
   n8n start
   ```
   n8n sẽ chạy tại: [http://localhost:5678](http://localhost:5678)

3. **Chạy ứng dụng Quản trị Thiết bị DUE:**
   Mở terminal mới tại thư mục dự án:
   ```bash
   npm install
   npm run dev
   ```
   Ứng dụng chạy tại: [http://localhost:3000](http://localhost:3000)

---

### Cách 2: Chạy n8n qua Docker (Khuyên dùng)

1. **Tạo Volume và chạy container n8n:**
   ```bash
   docker volume create n8n_data
   docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
   ```
2. **Truy cập n8n:** [http://localhost:5678](http://localhost:5678)

---

### Cách 3: Chạy tự động toàn bộ bằng Docker Compose

1. **Khởi chạy ứng dụng và n8n cùng lúc:**
   ```bash
   docker compose up --build
   ```
2. **Truy cập:**
   - **Hệ thống Quản trị Thiết bị DUE:** [http://localhost:3000](http://localhost:3000)
   - **n8n Workflow Automation:** [http://localhost:5678](http://localhost:5678)

---

### Cấu Hình Tích Hợp n8n với Telegram Bot `@hotrogiangday_bot`

1. **Tải File Template n8n:**
   - Vào tab **Tích Hợp n8n Workflow** trên ứng dụng quản trị (`http://localhost:3000`).
   - Bấm nút tải xuống file JSON template n8n.
2. **Import vào n8n:**
   - Truy cập `http://localhost:5678`, chọn **Import from File** và chọn file JSON vừa tải.
3. **Cấu hình Telegram Bot `@hotrogiangday_bot`:**
   - Lấy Bot Token của `@hotrogiangday_bot` (`8611136413:AAHYvr_pXyA6sjC-2SlVI0WPUcqq5K8S5iI`) từ `@BotFather` trên Telegram.
   - Thêm vào Node Telegram trong n8n.
   - Điền Chat ID của nhóm Kỹ thuật / Cơ sở vật chất.
   - Webhook URL nhận sự cố từ App sẽ là: `http://localhost:3000/api/n8n/webhook` (hoặc domain ngrok khi chạy thử nghiệm ngoài mạng LAN).
