# VocabAI - Quizlet Scraper & AI Image Finder

Ứng dụng desktop xây dựng bằng Electron, hỗ trợ quét từ vựng từ Quizlet, tự động tìm kiếm hình ảnh liên quan (không cần API Key) và viết prompt hình ảnh chuẩn AI bằng Google Gemini.

## Tính năng chính
1. **Quét dữ liệu Quizlet**: Nhập đường dẫn bộ thẻ Flashcard công khai của Quizlet để tự động cào toàn bộ từ mới và định nghĩa.
2. **Tự động tìm kiếm ảnh (DuckDuckGo)**: Tự động tìm kiếm hình ảnh phù hợp nhất từ DuckDuckGo và tải về lưu trữ offline mà không yêu cầu API Key.
3. **AI Prompt Generator (Google Gemini)**: Tạo mô tả hình ảnh tiếng Anh chi tiết cho từng từ vựng giúp dễ nhớ, hỗ trợ dịch/tinh chỉnh nghĩa tiếng Việt.
4. **Sổ từ vựng**: Quản lý, chỉnh sửa thủ công, đổi ảnh hàng loạt và xuất dữ liệu ra file CSV (Excel) hoặc JSON.

## Cách chạy ứng dụng

### Yêu cầu hệ thống
- Máy tính đã cài đặt **Node.js** (Khuyên dùng phiên bản LTS mới nhất).

### Các bước cài đặt và chạy thử:
1. Mở Terminal (PowerShell hoặc Command Prompt) tại thư mục dự án này:
   ```bash
   cd d:\code_tino_19_4\Code_Tool_Python\Tool_Slide
   ```
2. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```
3. Chạy ứng dụng ở chế độ nhà phát triển (Development):
   ```bash
   npm start
   ```

## Đóng gói ứng dụng thành file `.exe` chạy trực tiếp

Để tạo ra một file `.exe` (phiên bản Portable chạy không cần cài đặt), bạn chỉ cần chạy lệnh sau trong Terminal:
```bash
npm run dist
```
Sau khi chạy xong, file `.exe` sẽ được lưu tại thư mục `dist/VocabAI Scraper Portable.exe`. Bạn có thể sao chép file này đi bất kỳ đâu để sử dụng.

---
Được phát triển bởi **Antigravity**.
