import sqlite3
import requests
from bs4 import BeautifulSoup
import re
import random
import os
import json
from urllib.parse import urlparse, quote
from dotenv import load_dotenv
from query_parser import parse_query

load_dotenv()

DB_NAME = "influencer.db"
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# ---------- City config: lat/lng + valid address keywords ----------
CITY_CONFIG = {
    # 台灣
    '台北': {'lat': 25.0330, 'lng': 121.5654, 'radius': 15000, 'en_name': 'Taipei',
             'address_keywords': ['台北', '北市', '新北', '信義', '大安', '中山', '松山',
                                  '萬華', '中正', '士林', '內湖', '南港', '文山', '北投',
                                  '大同', '板橋', '永和', '新店', 'Taipei']},
    '台中': {'lat': 24.1477, 'lng': 120.6736, 'radius': 15000, 'en_name': 'Taichung',
             'address_keywords': ['台中', '中市', 'Taichung']},
    '高雄': {'lat': 22.6273, 'lng': 120.3014, 'radius': 15000, 'en_name': 'Kaohsiung',
             'address_keywords': ['高雄', '高市', 'Kaohsiung']},
    '台南': {'lat': 22.9998, 'lng': 120.2270, 'radius': 15000, 'en_name': 'Tainan',
             'address_keywords': ['台南', '南市', 'Tainan']},
    '花蓮': {'lat': 23.9910, 'lng': 121.6111, 'radius': 20000, 'en_name': 'Hualien',
             'address_keywords': ['花蓮', 'Hualien']},
    '宜蘭': {'lat': 24.7570, 'lng': 121.7533, 'radius': 20000, 'en_name': 'Yilan',
             'address_keywords': ['宜蘭', 'Yilan']},
    # 日本
    '東京': {'lat': 35.6762, 'lng': 139.6503, 'radius': 25000, 'en_name': 'Tokyo',
             'address_keywords': ['東京', 'Tokyo', '渋谷', '新宿', '銀座', '六本木', 'Japan', '日本']},
    '大阪': {'lat': 34.6937, 'lng': 135.5023, 'radius': 20000, 'en_name': 'Osaka',
             'address_keywords': ['大阪', 'Osaka', '難波', '梅田', '心斎橋', 'Japan', '日本']},
    '京都': {'lat': 35.0116, 'lng': 135.7681, 'radius': 15000, 'en_name': 'Kyoto',
             'address_keywords': ['京都', 'Kyoto', 'Japan', '日本']},
    '北海道': {'lat': 43.0642, 'lng': 141.3469, 'radius': 30000, 'en_name': 'Hokkaido',
              'address_keywords': ['北海道', '札幌', 'Sapporo', 'Hokkaido', 'Japan']},
    '沖繩': {'lat': 26.3344, 'lng': 127.8056, 'radius': 30000, 'en_name': 'Okinawa',
             'address_keywords': ['沖繩', '那覇', 'Okinawa', 'Naha', 'Japan']},
    '福岡': {'lat': 33.5904, 'lng': 130.4017, 'radius': 15000, 'en_name': 'Fukuoka',
             'address_keywords': ['福岡', 'Fukuoka', 'Japan']},
    '名古屋': {'lat': 35.1815, 'lng': 136.9066, 'radius': 15000, 'en_name': 'Nagoya',
              'address_keywords': ['名古屋', 'Nagoya', 'Japan']},
    # 韓國
    '首爾': {'lat': 37.5665, 'lng': 126.9780, 'radius': 20000, 'en_name': 'Seoul',
             'address_keywords': ['서울', 'Seoul', 'Korea', '韓國']},
    '釜山': {'lat': 35.1796, 'lng': 129.0756, 'radius': 15000, 'en_name': 'Busan',
             'address_keywords': ['부산', 'Busan', 'Korea']},
    # 東南亞
    '曼谷': {'lat': 13.7563, 'lng': 100.5018, 'radius': 25000, 'en_name': 'Bangkok',
             'address_keywords': ['Bangkok', 'กรุงเทพ', 'Thailand', '泰國']},
    '新加坡': {'lat': 1.3521, 'lng': 103.8198, 'radius': 15000, 'en_name': 'Singapore',
              'address_keywords': ['Singapore', '新加坡']},
    '吉隆坡': {'lat': 3.1390, 'lng': 101.6869, 'radius': 15000, 'en_name': 'Kuala Lumpur',
              'address_keywords': ['Kuala Lumpur', 'KL', 'Malaysia']},
    '峇里島': {'lat': -8.3405, 'lng': 115.0920, 'radius': 30000, 'en_name': 'Bali',
              'address_keywords': ['Bali', 'Indonesia']},
    '河內': {'lat': 21.0278, 'lng': 105.8342, 'radius': 15000, 'en_name': 'Hanoi',
             'address_keywords': ['Hanoi', 'Hà Nội', 'Vietnam']},
    '胡志明': {'lat': 10.8231, 'lng': 106.6297, 'radius': 20000, 'en_name': 'Ho Chi Minh',
              'address_keywords': ['Ho Chi Minh', 'Hồ Chí Minh', 'Saigon', 'Vietnam']},
    '清邁': {'lat': 18.7883, 'lng': 98.9853, 'radius': 15000, 'en_name': 'Chiang Mai',
             'address_keywords': ['Chiang Mai', 'เชียงใหม่', 'Thailand']},
    '馬尼拉': {'lat': 14.5995, 'lng': 120.9842, 'radius': 15000, 'en_name': 'Manila',
              'address_keywords': ['Manila', 'Philippines']},
    # 港澳中國
    '香港': {'lat': 22.3193, 'lng': 114.1694, 'radius': 15000, 'en_name': 'Hong Kong',
             'address_keywords': ['香港', 'Hong Kong']},
    '澳門': {'lat': 22.1987, 'lng': 113.5439, 'radius': 10000, 'en_name': 'Macau',
             'address_keywords': ['澳門', 'Macau', 'Macao']},
    '上海': {'lat': 31.2304, 'lng': 121.4737, 'radius': 25000, 'en_name': 'Shanghai',
             'address_keywords': ['上海', 'Shanghai', 'China']},
    '北京': {'lat': 39.9042, 'lng': 116.4074, 'radius': 25000, 'en_name': 'Beijing',
             'address_keywords': ['北京', 'Beijing', 'China']},
    '成都': {'lat': 30.5723, 'lng': 104.0665, 'radius': 20000, 'en_name': 'Chengdu',
             'address_keywords': ['成都', 'Chengdu', 'China']},
    # 歐洲
    '巴黎': {'lat': 48.8566, 'lng': 2.3522, 'radius': 15000, 'en_name': 'Paris',
             'address_keywords': ['Paris', 'France', '法國']},
    '倫敦': {'lat': 51.5074, 'lng': -0.1278, 'radius': 20000, 'en_name': 'London',
             'address_keywords': ['London', 'UK', 'United Kingdom', '英國']},
    '羅馬': {'lat': 41.9028, 'lng': 12.4964, 'radius': 15000, 'en_name': 'Rome',
             'address_keywords': ['Roma', 'Rome', 'Italy', '義大利']},
    '巴塞隆納': {'lat': 41.3874, 'lng': 2.1686, 'radius': 15000, 'en_name': 'Barcelona',
               'address_keywords': ['Barcelona', 'Spain', '西班牙']},
    '米蘭': {'lat': 45.4642, 'lng': 9.1900, 'radius': 15000, 'en_name': 'Milan',
             'address_keywords': ['Milan', 'Milano', 'Italy']},
    '阿姆斯特丹': {'lat': 52.3676, 'lng': 4.9041, 'radius': 12000, 'en_name': 'Amsterdam',
                'address_keywords': ['Amsterdam', 'Netherlands', '荷蘭']},
    '柏林': {'lat': 52.5200, 'lng': 13.4050, 'radius': 15000, 'en_name': 'Berlin',
             'address_keywords': ['Berlin', 'Germany', '德國']},
    '維也納': {'lat': 48.2082, 'lng': 16.3738, 'radius': 12000, 'en_name': 'Vienna',
              'address_keywords': ['Wien', 'Vienna', 'Austria']},
    '布拉格': {'lat': 50.0755, 'lng': 14.4378, 'radius': 12000, 'en_name': 'Prague',
              'address_keywords': ['Praha', 'Prague', 'Czech']},
    '伊斯坦堡': {'lat': 41.0082, 'lng': 28.9784, 'radius': 20000, 'en_name': 'Istanbul',
               'address_keywords': ['Istanbul', 'İstanbul', 'Turkey', 'Türkiye']},
    # 美洲
    '紐約': {'lat': 40.7128, 'lng': -74.0060, 'radius': 20000, 'en_name': 'New York',
             'address_keywords': ['New York', 'NY', 'Manhattan', 'Brooklyn', 'NYC']},
    '洛杉磯': {'lat': 34.0522, 'lng': -118.2437, 'radius': 30000, 'en_name': 'Los Angeles',
              'address_keywords': ['Los Angeles', 'LA', 'California', 'CA']},
    '舊金山': {'lat': 37.7749, 'lng': -122.4194, 'radius': 15000, 'en_name': 'San Francisco',
              'address_keywords': ['San Francisco', 'SF', 'California']},
    '芝加哥': {'lat': 41.8781, 'lng': -87.6298, 'radius': 20000, 'en_name': 'Chicago',
              'address_keywords': ['Chicago', 'IL', 'Illinois']},
    '拉斯維加斯': {'lat': 36.1699, 'lng': -115.1398, 'radius': 15000, 'en_name': 'Las Vegas',
                'address_keywords': ['Las Vegas', 'NV', 'Nevada']},
    '溫哥華': {'lat': 49.2827, 'lng': -123.1207, 'radius': 15000, 'en_name': 'Vancouver',
              'address_keywords': ['Vancouver', 'BC', 'Canada']},
    '多倫多': {'lat': 43.6532, 'lng': -79.3832, 'radius': 15000, 'en_name': 'Toronto',
              'address_keywords': ['Toronto', 'ON', 'Ontario', 'Canada']},
    # 大洋洲
    '雪梨': {'lat': -33.8688, 'lng': 151.2093, 'radius': 20000, 'en_name': 'Sydney',
             'address_keywords': ['Sydney', 'NSW', 'Australia']},
    '墨爾本': {'lat': -37.8136, 'lng': 144.9631, 'radius': 20000, 'en_name': 'Melbourne',
              'address_keywords': ['Melbourne', 'VIC', 'Australia']},
    # 中東
    '杜拜': {'lat': 25.2048, 'lng': 55.2708, 'radius': 20000, 'en_name': 'Dubai',
             'address_keywords': ['Dubai', 'UAE', '杜拜']},
}

# ---------- Category classification ----------
FOOD_TYPES = {
    'restaurant', 'food', 'cafe', 'bakery', 'bar', 'meal_takeaway',
    'meal_delivery', 'night_club',
}

ATTRACTION_TYPES = {
    'tourist_attraction', 'park', 'museum', 'amusement_park', 'aquarium',
    'art_gallery', 'zoo', 'campground', 'stadium', 'bowling_alley',
    'church', 'hindu_temple', 'mosque', 'synagogue',
}

SHOPPING_TYPES = {
    'shopping_mall', 'department_store',
}

ACCOMMODATION_TYPES = {
    'lodging',
}

SPA_TYPES = {
    'spa', 'beauty_salon', 'hair_care',
}

# Google Places types that are valid for our purposes
VALID_PLACE_TYPES = (
    FOOD_TYPES | ATTRACTION_TYPES | SHOPPING_TYPES | ACCOMMODATION_TYPES |
    SPA_TYPES | {'point_of_interest', 'establishment', 'store'}
)

# Google Places types that should be REJECTED
REJECT_PLACE_TYPES = {
    'locality', 'political', 'administrative_area_level_1',
    'administrative_area_level_2', 'administrative_area_level_3',
    'country', 'postal_code', 'route', 'street_address',
    'transit_station', 'bus_station', 'train_station', 'subway_station',
    'airport', 'parking', 'car_repair', 'car_dealer', 'car_wash',
    'gas_station', 'insurance_agency', 'lawyer', 'local_government_office',
    'police', 'fire_station', 'hospital', 'doctor', 'dentist',
    'pharmacy', 'veterinary_care', 'cemetery', 'funeral_home',
    'post_office', 'bank', 'atm', 'accounting', 'real_estate_agency',
    'moving_company', 'storage', 'plumber', 'electrician',
    'roofing_contractor', 'painter', 'locksmith',
    'school', 'university', 'primary_school', 'secondary_school',
    'library', 'courthouse', 'city_hall', 'embassy',
}

# Category name keywords for search query enhancement
CATEGORY_KEYWORDS = {
    '美食': ['餐廳', '美食', '小吃', '料理'],
    '甜點': ['甜點', '蛋糕', '甜品', '下午茶', '糕點'],
    '咖啡': ['咖啡', '咖啡廳', 'cafe', 'coffee'],
    '景點': ['景點', '觀光', '遊覽', '參觀', '拍照'],
    '夜市': ['夜市', '小吃', '夜間'],
    '酒吧': ['酒吧', '餐酒館', 'bar', '調酒'],
    '火鍋': ['火鍋', '鍋物', '麻辣鍋'],
    '拉麵': ['拉麵', '麵食'],
    '早午餐': ['早午餐', 'brunch', '早餐'],
    '素食': ['素食', '蔬食', 'vegan'],
}


def get_site_name(url):
    """Extract a human-readable site name from a URL."""
    domain = urlparse(url).netloc
    domain = re.sub(r'^www\.', '', domain)
    site_map = {
        'supertaste.tvbs.com.tw': '食尚玩家',
        'udn.com': '聯合新聞網',
        'travel.ettoday.net': 'ETtoday旅遊雲',
        'www.walkerland.com.tw': 'WalkerLand窩客島',
        'ifoodie.tw': '愛食記',
        'boo2k.com': '波波黛莉',
        'girlstyle.com': 'GirlStyle女生日常',
        'beauty321.com': 'Beauty美人圈',
    }
    return site_map.get(domain, domain)


def detect_city_from_keyword(keyword):
    """Detect which city the user is searching for from the keyword using query_parser."""
    parsed = parse_query(keyword)
    return parsed.city


def classify_category(types_set, place_name=''):
    """
    Determine the category of a place based on Google Places types.
    Priority: Food > Attraction > Shopping > Spa > Accommodation > default
    """
    types = set(types_set)

    # Food keywords in name override types
    food_name_hints = ['餐', '食', '麵', '飯', '鍋', '燒', '烤', '壽司', '拉麵',
                       'cafe', 'coffee', 'kitchen', 'bistro', 'bar', 'grill',
                       '咖啡', '茶', '甜點', '蛋糕', '麵包', '小吃', '牛排',
                       '披薩', 'pizza', 'pasta', '料理', '酒', 'dining']
    attraction_name_hints = ['公園', '博物館', '紀念', '觀景', '文化', '園區',
                             '美術館', '動物園', '水族', '遊樂', 'museum', 'park',
                             '古蹟', '寺', '廟', '教堂', '步道', '瀑布']

    name_lower = place_name.lower()

    # Check types first (most reliable)
    has_food = bool(types & FOOD_TYPES)
    has_attraction = bool(types & ATTRACTION_TYPES)
    has_shopping = bool(types & SHOPPING_TYPES)
    has_spa = bool(types & SPA_TYPES)
    has_accommodation = bool(types & ACCOMMODATION_TYPES)

    # Direct food type → 美食
    if has_food and not has_attraction:
        return '美食'

    # Direct attraction type → 景點
    if has_attraction and not has_food:
        return '景點'

    # Both food + attraction → decide by name
    if has_food and has_attraction:
        if any(hint in name_lower for hint in food_name_hints):
            return '美食'
        return '景點'

    # Shopping
    if has_shopping:
        return '購物'

    # Spa
    if has_spa:
        return '休閒'

    # Accommodation
    if has_accommodation:
        return '住宿'

    # Fallback: check name for hints
    if any(hint in name_lower for hint in food_name_hints):
        return '美食'
    if any(hint in name_lower for hint in attraction_name_hints):
        return '景點'

    # If only point_of_interest/establishment, check store type
    if 'store' in types:
        return '購物'

    return '美食'  # Default


def enhance_search_query(keyword, city='台北'):
    """Legacy wrapper — uses query_parser for smart enhancement."""
    parsed = parse_query(keyword)
    return parsed.to_chinese_query()


def get_google_place_type_query(keyword, city='台北'):
    """
    Build a Google Places type parameter based on the search keyword.
    Returns a type string for narrower results.
    """
    # Map keywords to Google Places types for direct search
    type_map = {
        '餐廳': 'restaurant', '美食': 'restaurant', '料理': 'restaurant',
        '小吃': 'restaurant', '火鍋': 'restaurant', '拉麵': 'restaurant',
        '牛排': 'restaurant', '燒肉': 'restaurant', '壽司': 'restaurant',
        '早午餐': 'restaurant', '素食': 'restaurant',
        '咖啡': 'cafe', '咖啡廳': 'cafe', 'cafe': 'cafe', 'coffee': 'cafe',
        '甜點': 'bakery', '蛋糕': 'bakery', '麵包': 'bakery',
        '酒吧': 'bar', '餐酒館': 'bar',
        '景點': 'tourist_attraction', '觀光': 'tourist_attraction',
        '公園': 'park', '博物館': 'museum',
    }

    for kw, place_type in type_map.items():
        if kw in keyword:
            return place_type
    return None


# ---------- Step 1: Search DuckDuckGo for article URLs ----------
def search_articles(keyword, max_articles=5):
    """Search DuckDuckGo Lite and return a list of article dicts."""
    print(f"[Step 1] Searching DuckDuckGo for articles: '{keyword}'")
    search_url = "https://lite.duckduckgo.com/lite/"
    payload = {'q': keyword}
    article_urls = []

    try:
        response = requests.post(search_url, data=payload, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        title_links = soup.find_all('a', class_='result-link')

        for link in title_links:
            href = link.get('href', '')
            title = link.text.strip()
            if any(skip in href for skip in ['duckduckgo.com/y.js', 'ad_domain', 'ad_provider', 'bing.com/aclick']):
                continue
            if any(skip in title.lower() for skip in ['more info', 'sponsored']):
                continue
            if href.startswith('http'):
                article_urls.append({'url': href, 'title': title, 'site_name': get_site_name(href)})
            if len(article_urls) >= max_articles:
                break

        print(f"  Found {len(article_urls)} articles")
    except Exception as e:
        print(f"  DuckDuckGo search failed: {e}")

    return article_urls


# ---------- Step 2: Visit article and extract names + recommendation sentences ----------
def extract_places_from_article(url, max_names=5):
    """
    Visit an article and extract restaurant/place names along with
    a contextual recommendation sentence for each.
    """
    print(f"[Step 2] Scraping article: {url[:80]}...")
    results = []

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove non-content elements
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'aside',
                                   'header', 'form', 'iframe', 'noscript']):
            tag.decompose()

        # Find heading candidates
        heading_candidates = []
        for tag in soup.find_all(['h2', 'h3', 'h4']):
            text = tag.get_text(strip=True)
            if text:
                heading_candidates.append({'tag_obj': tag, 'text': text})

        # Also check strong/b tags more selectively
        for tag in soup.find_all(['strong', 'b']):
            text = tag.get_text(strip=True)
            parent = tag.parent
            if parent and parent.name in ['p', 'li', 'div', 'td']:
                if text and 4 <= len(text) <= 40:
                    heading_candidates.append({'tag_obj': tag, 'text': text})

        seen_names = set()
        for candidate in heading_candidates:
            if len(results) >= max_names:
                break

            raw_text = candidate['text']
            # Clean up numbering
            cleaned = re.sub(r'^[\d#①②③④⑤⑥⑦⑧⑨⑩\.\)、\s：:]+', '', raw_text).strip()
            cleaned = re.sub(r'[【】\[\]「」『』《》〈〉]+', '', cleaned).strip()
            cleaned = re.sub(r'[\|｜\-–—]\s*.*$', '', cleaned).strip()

            if not cleaned or len(cleaned) < 3 or len(cleaned) > 35:
                continue

            skip_patterns = [
                '推薦', '必吃', '攻略', '總整理', '懶人包', '目錄', '前言', '結語', '總結',
                '延伸閱讀', '相關文章', '留言', '分享', '目次', '營業時間', '結論',
                '地址', '電話', '價格', '菜單', '評價', '最新', '更新', '介紹',
                '分類', '近期文章', '搜尋', '標籤', '彙整', '關於', '首頁',
                '訂閱', '追蹤', '聯絡', '隱私權', '版權', '免責', '廣告',
                '側邊欄', '回到頂端', '上一篇', '下一篇', '熱門文章', '文章導覽',
                'more', 'share', 'comment', 'copyright', 'menu', 'navigation',
                'sidebar', 'footer', 'header', 'widget', 'category',
                'recent', 'popular', 'archive', 'tag', 'about', 'contact',
                'subscribe', 'follow', 'search', 'login', 'sign',
                '台灣', '交通', '怎麼去', '捷運', '公車', '停車',
                '咖啡廳推薦', '餐廳推薦', '景點推薦', '夜市推薦',
                '住宿', '飯店', '旅館', '民宿',
                '工作', '職缺', '薪資', '保險', '貸款', '投資', '理財',
                '新聞', '政治', '科技', '教育', '健康', '醫療',
                '店家資訊', '用餐資訊', '基本資訊', '注意事項',
                '閱讀更多', '更多', '看更多', '點我', '此文', '有幫助',
                '這裡去', '這裡看', '繼續閱讀', '回目錄', '回首頁',
                '喜歡', '收藏', '按讚', '複製連結', '檢舉', '回報',
                '相關推薦', '你可能也喜歡', '猜你喜歡', '也想看',
                '常見問題', 'FAQ', '問答', 'Q&A',
            ]
            if any(skip in cleaned.lower() for skip in skip_patterns):
                continue

            city_names = ['台北', '台中', '高雄', '台南', '新竹', '桃園', '花蓮',
                          '宜蘭', '嘉義', '彰化', '屏東', '基隆', '苗栗', '南投',
                          '信義區', '大安區', '中山區', '松山區', '中正區', '萬華區',
                          '士林區', '內湖區', '南港區', '文山區', '北投區', '大同區']
            if cleaned in city_names:
                continue

            if not (re.search(r'[\u4e00-\u9fff]', cleaned) or re.search(r'[A-Z][a-z]', cleaned)):
                continue

            if cleaned in seen_names:
                continue
            seen_names.add(cleaned)

            recommendation = extract_nearby_text(candidate['tag_obj'], cleaned)

            results.append({
                'name': cleaned,
                'recommendation': recommendation
            })

        print(f"  Extracted {len(results)} places: {[r['name'] for r in results[:3]]}...")

    except Exception as e:
        print(f"  Failed to scrape article: {e}")

    return results


def extract_nearby_text(tag_obj, place_name):
    """Find paragraph text near a heading to generate a recommendation sentence."""
    sentences = []

    for sibling in tag_obj.find_next_siblings():
        if sibling.name in ['h2', 'h3', 'h4']:
            break
        if sibling.name == 'p':
            text = sibling.get_text(strip=True)
            if text and len(text) > 10:
                sentences.append(text)
                if len(sentences) >= 2:
                    break

    if sentences:
        full_text = ' '.join(sentences)
        sentence_list = re.split(r'[。！？!?\n]', full_text)
        for s in sentence_list:
            s = s.strip()
            if len(s) > 10 and len(s) < 120:
                return s
        return full_text[:100] + '...' if len(full_text) > 100 else full_text

    parent = tag_obj.parent
    if parent:
        for sibling in parent.find_next_siblings():
            if sibling.name == 'p':
                text = sibling.get_text(strip=True)
                if text and len(text) > 10:
                    return text[:100] + '...' if len(text) > 100 else text
            if sibling.name in ['h2', 'h3', 'h4']:
                break

    return f"來自部落客推薦的人氣{place_name}，值得一訪！"


# ---------- Step 3: Google Places API with location bias + type validation ----------
def lookup_google_place(place_name, city='台北'):
    """
    Use Google Places Text Search with location bias.
    Validates type and address.
    """
    config = CITY_CONFIG.get(city, CITY_CONFIG['台北'])
    query = f"{place_name} {city}"

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        'query': query,
        'key': GOOGLE_API_KEY,
        'language': 'zh-TW',
        'region': 'tw',
        'location': f"{config['lat']},{config['lng']}",
        'radius': config['radius'],
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if data.get('status') != 'OK' or not data.get('results'):
            print(f"  Google Places: No result for '{place_name}' (status: {data.get('status')})")
            return {'found': False, 'reject_reason': 'no_results'}

        for place in data['results'][:3]:
            types = set(place.get('types', []))
            address = place.get('formatted_address', '')
            name = place.get('name', '')

            if types & REJECT_PLACE_TYPES:
                print(f"  ⚠️  Skipping '{name}': rejected type {types & REJECT_PLACE_TYPES}")
                continue

            if not (types & VALID_PLACE_TYPES):
                print(f"  ⚠️  Skipping '{name}': no valid type in {types}")
                continue

            address_keywords = config['address_keywords']
            if not any(kw in address for kw in address_keywords):
                print(f"  ⚠️  Skipping '{name}': wrong location '{address}' (expected {city})")
                continue

            rating = place.get('rating', 0)
            if rating < 1.0 and place.get('user_ratings_total', 0) < 5:
                print(f"  ⚠️  Skipping '{name}': too few reviews or no rating")
                continue

            photo_url = ""
            if place.get('photos'):
                photo_ref = place['photos'][0].get('photo_reference', '')
                if photo_ref:
                    photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={photo_ref}&key={GOOGLE_API_KEY}"

            place_id = place.get('place_id', '')
            from urllib.parse import quote
            if place_id:
                maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(name)}&query_place_id={place_id}"
            else:
                maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(name + ' ' + city)}"

            return {
                'name': name,
                'address': address,
                'rating': rating,
                'user_ratings_total': place.get('user_ratings_total', 0),
                'photo_url': photo_url,
                'maps_url': maps_url,
                'place_id': place_id,
                'types': list(types),
                'found': True
            }

        print(f"  ❌ All results for '{place_name}' failed validation")
        return {'found': False, 'reject_reason': 'all_filtered'}

    except Exception as e:
        print(f"  Google Places API error: {e}")

    return {'found': False, 'reject_reason': 'api_error'}


# ---------- Google Places direct search (fallback) ----------
def google_places_direct_search(keyword, city='台北', limit=10):
    """
    Fallback: search Google Places directly when article scraping fails.
    Uses keyword as the query against Google Places Text Search.
    """
    print(f"\n[Fallback] Google Places direct search: '{keyword}' in {city}")
    config = CITY_CONFIG.get(city, CITY_CONFIG['台北'])
    query = f"{keyword} {city}"

    # Try to get a type hint from the keyword
    place_type = get_google_place_type_query(keyword, city)

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        'query': query,
        'key': GOOGLE_API_KEY,
        'language': 'zh-TW',
        'region': 'tw',
        'location': f"{config['lat']},{config['lng']}",
        'radius': config['radius'],
    }
    if place_type:
        params['type'] = place_type

    results = []
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if data.get('status') != 'OK':
            print(f"  Google Places direct: status={data.get('status')}")
            return results

        for place in data.get('results', []):
            if len(results) >= limit:
                break

            types = set(place.get('types', []))
            address = place.get('formatted_address', '')
            name = place.get('name', '')

            if types & REJECT_PLACE_TYPES:
                continue
            if not (types & VALID_PLACE_TYPES):
                continue

            address_keywords = config['address_keywords']
            if not any(kw in address for kw in address_keywords):
                continue

            rating = place.get('rating', 0)
            if rating < 3.0:
                continue

            photo_url = ""
            if place.get('photos'):
                photo_ref = place['photos'][0].get('photo_reference', '')
                if photo_ref:
                    photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={photo_ref}&key={GOOGLE_API_KEY}"

            place_id = place.get('place_id', '')
            from urllib.parse import quote
            if place_id:
                maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(name)}&query_place_id={place_id}"
            else:
                maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(name + ' ' + city)}"

            category = classify_category(types, name)
            price_range = "$" if rating < 4.0 else "$$" if rating < 4.5 else "$$$"

            results.append({
                'name': name,
                'category': category,
                'image': photo_url or 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1600',
                'influencer': 'Google 評論',
                'quote': f"Google 評分 {rating} 顆星，共 {place.get('user_ratings_total', 0)} 則評論",
                'rating': rating,
                'price_range': price_range,
                'location': city,
                'source_url': maps_url,
                'article_url': maps_url,
                'address': address
            })
            print(f"  ✅ [Direct] {name} ({rating}⭐) — {category}")

    except Exception as e:
        print(f"  Google Places direct search error: {e}")

    return results


# ---------- Step 4: Main scrape pipeline ----------
def scrape_data(keyword='台北 推薦 餐廳 網紅', limit=10, page=1):
    """
    Full pipeline: Search → Visit articles → Extract names+quotes → Google Places lookup.
    Supports pagination, bilingual search (Chinese + English), and smart query parsing.
    """
    print(f"\n{'='*60}")
    print(f"Starting deep scraper for: '{keyword}' (target: {limit}, page: {page})")
    print(f"{'='*60}\n")

    # Smart query parsing
    parsed = parse_query(keyword)
    city = parsed.city
    print(f"[City detected] {city}")

    # Generate bilingual queries
    zh_query = parsed.to_chinese_query()
    en_query = parsed.to_english_query()
    print(f"[Chinese query] {zh_query}")
    print(f"[English query] {en_query}")

    # Calculate offset for pagination — collect 1 extra to determine has_more
    offset = (page - 1) * limit
    total_needed = offset + limit + 1  # +1 to probe if more exist

    # Step 1: Find articles — bilingual DuckDuckGo search
    max_articles = min(5 + (page - 1) * 2, 10)
    half = max(max_articles // 2, 2)

    # Search in Chinese
    articles_zh = search_articles(zh_query, max_articles=half)
    # Search in English
    articles_en = search_articles(en_query, max_articles=half)

    # Merge and deduplicate by URL
    seen_urls = set()
    articles = []
    for a in articles_zh + articles_en:
        if a['url'] not in seen_urls:
            seen_urls.add(a['url'])
            articles.append(a)

    print(f"[Bilingual search] {len(articles_zh)} zh + {len(articles_en)} en = {len(articles)} total unique articles")

    # Step 2: Extract place names from articles
    all_places = []
    for article in articles:
        extracted = extract_places_from_article(article['url'])
        for place in extracted:
            if not any(p['name'] == place['name'] for p in all_places):
                all_places.append({
                    'name': place['name'],
                    'recommendation': place['recommendation'],
                    'article_title': article['title'],
                    'article_url': article['url'],
                    'site_name': article['site_name']
                })
        if len(all_places) >= total_needed * 3:
            break

    print(f"\n[Summary] Collected {len(all_places)} unique place names from articles")

    # Step 3: Enrich with Google Places API
    all_results = []
    skipped = 0
    for place_info in all_places:
        if len(all_results) >= total_needed:
            break  # We have enough (including probe)

        print(f"\n[Step 3] Looking up: '{place_info['name']}'")
        place_data = lookup_google_place(place_info['name'], city=city)

        if not place_data.get('found'):
            skipped += 1
            continue

        types = set(place_data.get('types', []))
        category = classify_category(types, place_data['name'])

        rating = place_data.get('rating', 4.0)
        price_range = "$" if rating < 4.0 else "$$" if rating < 4.5 else "$$$"

        all_results.append({
            'name': place_data['name'],
            'category': category,
            'image': place_data.get('photo_url', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1600'),
            'influencer': place_info['site_name'],
            'quote': place_info['recommendation'],
            'rating': rating,
            'price_range': price_range,
            'location': city,
            'source_url': place_data.get('maps_url', ''),
            'article_url': place_info['article_url'],
            'address': place_data.get('address', '')
        })
        print(f"  ✅ {place_data['name']} ({rating}⭐) — {category} — from {place_info['site_name']}")

    # Fallback: If too few results, use Google Places direct search
    if len(all_results) < total_needed:
        shortfall = total_needed - len(all_results)
        print(f"\n[Fallback] Only {len(all_results)} results, need {shortfall} more from Google Places directly")
        direct_results = google_places_direct_search(zh_query, city, limit=shortfall + 5)

        # Deduplicate
        existing_names = {r['name'] for r in all_results}
        for dr in direct_results:
            if dr['name'] not in existing_names and len(all_results) < total_needed:
                all_results.append(dr)
                existing_names.add(dr['name'])

    # Determine has_more before slicing
    has_more = len(all_results) > offset + limit

    # Apply pagination: return only the page's slice
    page_results = all_results[offset:offset + limit]

    print(f"\n{'='*60}")
    print(f"Deep scraper complete: {len(all_results)} total, returning {len(page_results)} (page {page})")
    print(f"{'='*60}\n")

    return page_results, has_more


def init_db_if_needed():
    if not os.path.exists(DB_NAME):
        import database
        database.init_db()


def save_to_db(items, append=False):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if not append:
        c.execute('DELETE FROM recommendations')

    count = 0
    for item in items:
        c.execute('SELECT id FROM recommendations WHERE name = ?', (item['name'],))
        if not c.fetchone():
            c.execute('''
                INSERT INTO recommendations (name, category, image, influencer, quote, rating, price_range, location, source_url, article_url, address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item['name'], item['category'], item.get('image', ''),
                item.get('influencer', ''), item.get('quote', ''),
                item.get('rating', 4.5), item.get('price_range', '$$'),
                item.get('location', 'Taipei'), item.get('source_url', ''),
                item.get('article_url', ''), item.get('address', '')
            ))
            count += 1

    conn.commit()
    conn.close()
    print(f"Saved {count} recommendations to database.")


if __name__ == "__main__":
    init_db_if_needed()
    data, _ = scrape_data()
    save_to_db(data)
    print("Done.")
