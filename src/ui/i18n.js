export const STRINGS = {
  vi: {
    cond: {
      clear: 'Trời nắng', clearNight: 'Trời quang', partly: 'Có mây, nắng nhẹ', partlyNight: 'Ít mây', overcast: 'Nhiều mây, âm u', fog: 'Sương mù',
      drizzle: 'Mưa phùn', rain: 'Mưa', heavyRain: 'Mưa to', thunderstorm: 'Mưa dông', snow: 'Tuyết rơi',
      storm: 'Bão', cyclone: 'Siêu bão',
    },
    aqi: { good: 'Tốt', moderate: 'Trung bình', usg: 'Kém', unhealthy: 'Xấu', veryUnhealthy: 'Rất xấu', hazardous: 'Nguy hại' },
    feels: 'Cảm giác', now: 'Hiện tại', wind: 'Gió', windLevel: (n) => `cấp ${n}`, humidity: 'Độ ẩm', precip: 'Lượng mưa',
    updated: (t) => `Cập nhật ${t}`, live: 'Trực tiếp', simulate: 'Mô phỏng thời tiết', simulating: 'Đang mô phỏng',
    backToLive: 'Về thời tiết thực', time: 'Thời điểm', timeLive: 'Thực', morning: 'Sáng', noon: 'Trưa', sunset: 'Hoàng hôn', night: 'Đêm',
    loading: 'Đang dựng thành phố…', offline: 'Không tải được dữ liệu thời tiết — đang hiển thị mô phỏng', hint: 'Kéo để xoay · Chụm hoặc cuộn để phóng to',
    traffic: 'Giao thông', trafficLv: { low: 'Thưa', mid: 'Vừa', high: 'Đông (giờ cao điểm)' },
    close: 'Đóng', language: 'Ngôn ngữ', uv: 'UV', aqiLabel: 'AQI', conditions: 'Điều kiện', cities: 'Thành phố',
    about: {
      cta: 'Về dự án', title: 'Thời tiết 3D · City Weather',
      description: 'Một mô hình thành phố 3D tí hon, được tạo bằng thuật toán, tái hiện Hà Nội, Đà Nẵng và TP. Hồ Chí Minh cùng thời tiết và nhịp sống đường phố.',
      source: 'Nguồn dữ liệu thời tiết & chất lượng không khí:', repo: 'Dự án mã nguồn mở', by: 'Tạo bởi',
    },
    dateLocale: 'vi-VN',
  },
  en: {
    cond: {
      clear: 'Sunny', clearNight: 'Clear', partly: 'Partly cloudy', partlyNight: 'Partly cloudy', overcast: 'Overcast', fog: 'Fog',
      drizzle: 'Drizzle', rain: 'Rain', heavyRain: 'Heavy rain', thunderstorm: 'Thunderstorm', snow: 'Snow',
      storm: 'Tropical storm', cyclone: 'Super typhoon',
    },
    aqi: { good: 'Good', moderate: 'Moderate', usg: 'Unhealthy for sensitive groups', unhealthy: 'Unhealthy', veryUnhealthy: 'Very unhealthy', hazardous: 'Hazardous' },
    feels: 'Feels like', now: 'Now', wind: 'Wind', windLevel: (n) => `Beaufort ${n}`, humidity: 'Humidity', precip: 'Precip.',
    updated: (t) => `Updated ${t}`, live: 'Live', simulate: 'Simulate weather', simulating: 'Simulation',
    backToLive: 'Back to live weather', time: 'Time of day', timeLive: 'Live', morning: 'Morning', noon: 'Noon', sunset: 'Sunset', night: 'Night',
    loading: 'Building the city…', offline: 'Weather data unavailable — showing a simulation', hint: 'Drag to rotate · Pinch or scroll to zoom',
    traffic: 'Traffic', trafficLv: { low: 'Light', mid: 'Moderate', high: 'Heavy (rush hour)' },
    close: 'Close', language: 'Language', uv: 'UV', aqiLabel: 'AQI', conditions: 'Conditions', cities: 'Cities',
    about: {
      cta: 'About this project', title: 'Thời tiết 3D · City Weather',
      description: 'A tiny procedural 3D city experience featuring Hanoi, Da Nang and Ho Chi Minh City, with live weather and animated street life.',
      source: 'Weather & air quality data:', repo: 'Open-source project', by: 'Made by',
    },
    dateLocale: 'en-GB',
  },
};

let lang = localStorage.getItem('cw-lang') || (navigator.language?.startsWith('vi') ? 'vi' : 'vi');
export const getLang = () => lang;
export const setLang = (l) => { lang = l; localStorage.setItem('cw-lang', l); document.documentElement.lang = l; };
export const t = () => STRINGS[lang];
document.documentElement.lang = lang;

export function formatDate(date, l = lang) {
  // `date` is a Date whose UTC fields hold the city's wall-clock time.
  const wd = new Intl.DateTimeFormat(STRINGS[l].dateLocale, { weekday: 'long', timeZone: 'UTC' }).format(date);
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  const cap = wd.charAt(0).toUpperCase() + wd.slice(1);
  if (l === 'vi') return `${cap}, ${d}.${m}.${y}`;
  const mon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date);
  return `${cap}, ${+d} ${mon} ${y}`;
}

export function formatClock(date) {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
