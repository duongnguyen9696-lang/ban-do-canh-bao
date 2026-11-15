# Máy chủ riêng cho Bản đồ cảnh báo

Bộ này chạy đủ 3 phần mà ứng dụng đang dùng nhờ máy chủ cộng đồng, để có thể đem bán:

| Phần | Thay cho | Đường dẫn |
| --- | --- | --- |
| Chỉ đường ô tô, xe máy (Valhalla, dữ liệu Việt Nam) | valhalla1.openstreetmap.de | `https://TEN-MIEN/route` |
| Biển tốc độ, camera, biển cấm, địa điểm (Overpass) | overpass-api.de | `https://TEN-MIEN/overpass/api/interpreter` |
| Camera, kẹt xe, tai nạn do người dùng báo (dùng chung) | chưa có | `https://TEN-MIEN/api/reports` |

## Cài đặt (khoảng 1–2 giờ, chủ yếu là chờ tải dữ liệu)

1. Thuê một máy chủ Ubuntu 22.04 trở lên, 8–16 GB RAM, ổ 60 GB (Hetzner, Vultr, DigitalOcean hoặc nhà cung cấp trong nước).
2. Trỏ một tên miền (ví dụ `api.bandocanhbao.vn`) về địa chỉ IP của máy.
3. Trên máy chủ chạy:

```
curl -fsSL https://get.docker.com | sh
git clone https://github.com/duongnguyen9696-lang/ban-do-canh-bao.git
cd ban-do-canh-bao/server
echo "DOMAIN=api.bandocanhbao.vn" > .env
docker compose up -d
```

4. Lần đầu, Valhalla và Overpass tự tải dữ liệu Việt Nam và dựng chỉ mục (30–90 phút). Sau đó Overpass tự cập nhật mỗi giờ từ OpenStreetMap.
5. Mở `https://TEN-MIEN` thấy dòng "may chu dang chay" là xong. Báo lại để chuyển ứng dụng sang dùng máy chủ này.

## API báo cáo

- `GET /api/reports?bbox=minLon,minLat,maxLon,maxLat` → danh sách báo cáo còn hiệu lực.
- `POST /api/reports` với `{"kind":"camera|mobile|jam|accident|police","lat":..,"lon":..,"limit":50,"note":"..."}`.
- `POST /api/reports/{id}/up` hoặc `/down` để xác nhận hoặc báo sai.

Báo cáo kẹt xe tự hết hạn sau 1 giờ, tai nạn và CSGT sau 2 giờ, camera di động sau 3 giờ, camera cố định không hết hạn. Báo cáo bị báo sai nhiều hơn xác nhận 3 lần thì bị ẩn. Mỗi địa chỉ IP gửi tối đa 20 lần mỗi phút.
